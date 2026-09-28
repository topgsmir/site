import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { TransferCount } from "@topgsm/shared-types";
import { Prisma, type user_deletion_jobs } from "../../prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { emptyCount, phaseQuery, processed, TRANSFER_PHASES, type TransferPhase } from "./user-transfer.definition";
import { commercialBlockers } from "./user-commercial-blockers";

const BATCH_SIZE = 200;
@Injectable()
export class UserTransferWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(UserTransferWorker.name);
  private timer?: NodeJS.Timeout;
  private running = false;
  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {}
  onModuleInit() {
    if (this.config.get<string>("DISABLE_BACKGROUND_WORKERS") === "true") return;
    this.timer = setInterval(() => {
      void this.tick().catch(() => this.logger.error("User transfer worker could not persist its checkpoint; it will retry from durable state"));
    }, 500);
    this.timer.unref();
  }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }
  async tick(onFailure?: (error: unknown) => void) {
    if (this.running) return false;
    this.running = true;
    let claimed: { id: string; version: string } | undefined;
    try {
      return await this.prisma.$transaction(async tx => {
        // Hold the claim through the batch commit; a crash rolls the entire
        // batch back and releases the row lock. No stale lease can double-run.
        const jobs = await tx.$queryRaw<(user_deletion_jobs & { claim_version: string })[]>`
          SELECT *, xmin::text AS claim_version FROM user_deletion_jobs WHERE status IN ('queued','running')
          AND next_attempt_at <= now() ORDER BY created_at, id FOR UPDATE SKIP LOCKED LIMIT 1`;
        const job = jobs[0]; if (!job) return false;
        claimed = { id: job.id, version: job.claim_version };
        await tx.$queryRaw`SELECT set_config('topgsm.lifecycle_job', ${job.id}, true)`;
        const phase = TRANSFER_PHASES[job.phase];
        if (!phase) throw new Error("INVALID_PHASE");
        if (phase === "finalize") { await this.finalize(tx, job); return true; }
        const query = phaseQuery(phase, job);
        const key = Prisma.raw(query.key); const table = Prisma.raw(query.table);
        const after = job.cursor ? Prisma.sql`AND ${key} > ${job.cursor}${Prisma.raw(query.uuid ? "::uuid" : "::text")}` : Prisma.empty;
        const rows = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
          SELECT ${key}::text AS id FROM ${table} WHERE ${query.where} ${after}
          ORDER BY ${key} LIMIT ${BATCH_SIZE} FOR UPDATE`);
        const progress = job.progress as unknown as Record<string, TransferCount>;
        const total = progress[phase] ?? emptyCount();
        if (!rows.length) {
          if (processed(total) !== (job.expected as Record<string, number>)[phase]) throw new Error("COUNT_MISMATCH");
          await tx.user_deletion_jobs.update({ where: { id: job.id }, data: { status: "running", phase: job.phase + 1, cursor: null, attempts: 0, error_code: null } });
          return true;
        }
        const ids = rows.map(r => r.id);
        const result = await this.batch(tx, job, phase, ids);
        progress[phase] = { transferred: total.transferred + result.transferred, archived: total.archived + result.archived, skipped: total.skipped + result.skipped, conflicted: total.conflicted + result.conflicted };
        await tx.user_deletion_jobs.update({ where: { id: job.id }, data: {
          status: "running", cursor: ids.at(-1), progress: progress as unknown as Prisma.InputJsonValue, attempts: 0, error_code: null
        } });
        return true;
      }, { timeout: 30_000 });
    } catch (error) {
      const code = error instanceof Error && ["COUNT_MISMATCH", "INVALID_PHASE", "REMAINING_OWNERSHIP", "REPLACEMENT_UNAVAILABLE", "UNFINISHED_OBLIGATIONS"].includes(error.message) ? error.message : "TRANSFER_BATCH_FAILED";
      this.logger.error(`User transfer batch failed: ${code}`);
      if (claimed) {
        // Serialize failure accounting with claims. Successful work is never
        // reverted; the persisted phase/cursor is the retry position.
        await this.prisma.$executeRaw`
          UPDATE user_deletion_jobs SET attempts=attempts+1, error_code=${code},
          status=CASE WHEN attempts+1 >= 3 OR ${code} <> 'TRANSFER_BATCH_FAILED' THEN 'failed' ELSE 'queued' END,
          next_attempt_at=now()+interval '5 seconds', updated_at=now()
          WHERE id=${claimed.id}::uuid AND xmin::text=${claimed.version} AND status IN ('queued','running')`;
      }
      onFailure?.(error);
      return false;
    } finally { this.running = false; }
  }

  private async batch(tx: Prisma.TransactionClient, job: user_deletion_jobs, phase: TransferPhase, ids: string[]): Promise<TransferCount> {
    const count = emptyCount(); const target = job.replacement_user_id;
    const source = job.source_seller_id; const destination = job.destination_seller_id;
    if (phase === "products") {
      count.transferred = (await tx.products.updateMany({ where: { id: { in: ids }, created_by_seller_id: source! }, data: { created_by_seller_id: destination! } })).count;
    } else if (phase === "listings") {
      const rows = await tx.$queryRaw<{ id: string; conflict: boolean }[]>(Prisma.sql`
        SELECT s.id::text AS id, (p.type='bridge' OR EXISTS(SELECT 1 FROM seller_listings d WHERE d.seller_id=${destination} AND d.product_id=s.product_id)) AS conflict
        FROM seller_listings s JOIN products p ON p.id=s.product_id WHERE s.id IN (${Prisma.join(ids.map(id => Prisma.sql`${id}::uuid`))})`);
      const conflicts = rows.filter(r => r.conflict).map(r => r.id);
      const movable = rows.filter(r => !r.conflict).map(r => r.id);
      count.archived = (await tx.seller_listings.updateMany({ where: { id: { in: conflicts } }, data: { status: "archived" } })).count;
      count.conflicted = count.archived;
      count.transferred = (await tx.seller_listings.updateMany({ where: { id: { in: movable } }, data: { seller_id: destination! } })).count;
    } else if (phase === "coupons") {
      const rows = await tx.$queryRaw<{ id: string; conflict: boolean }[]>(Prisma.sql`
        SELECT s.id, EXISTS(SELECT 1 FROM coupons d WHERE d.seller_id=${destination} AND d.code=s.code) AS conflict FROM coupons s WHERE s.id IN (${Prisma.join(ids)})`);
      const conflicts = rows.filter(r => r.conflict).map(r => r.id);
      count.archived = (await tx.coupons.updateMany({ where: { id: { in: conflicts } }, data: { active: false } })).count;
      count.conflicted = count.archived;
      count.transferred = (await tx.coupons.updateMany({ where: { id: { in: rows.filter(r => !r.conflict).map(r => r.id) } }, data: { seller_id: destination! } })).count;
    } else if (phase === "articles") {
      count.transferred = await tx.$executeRaw(Prisma.sql`
        UPDATE blog_posts SET creator_user_id=CASE WHEN creator_user_id=${job.user_id} THEN ${target} ELSE creator_user_id END,
        seller_id=CASE WHEN seller_id=${job.mode === "merge" ? source : null} THEN ${destination} ELSE seller_id END
        WHERE id IN (${Prisma.join(ids)})`);
    } else if (phase === "articleMedia") {
      count.transferred = await tx.$executeRaw(Prisma.sql`
        UPDATE blog_media_assets SET owner_user_id=CASE WHEN owner_user_id=${job.user_id} THEN ${target} ELSE owner_user_id END,
        seller_id=CASE WHEN seller_id=${job.mode === "merge" ? source : null} THEN ${destination} ELSE seller_id END
        WHERE id IN (${Prisma.join(ids)})`);
    } else if (phase === "comments") {
      count.transferred = (await tx.comments.updateMany({ where: { id: { in: ids } }, data: { author_user_id: target } })).count;
    } else if (phase === "assignments") {
      count.transferred = await tx.$executeRaw(Prisma.sql`
        UPDATE comment_assignments s SET seller_id=${destination}, assignee_key=${"seller:" + destination}
        WHERE s.seller_id=${source} AND s.replied_at IS NULL
        AND s.comment_id IN (${Prisma.join(ids.map(id => Prisma.sql`${id}::uuid`))})
        AND NOT EXISTS(SELECT 1 FROM comment_assignments d WHERE d.comment_id=s.comment_id AND d.assignee_key=${"seller:" + destination})`);
      count.skipped = ids.length - count.transferred;
    } else if (phase === "privateAi") {
      count.archived = (await tx.ai_conversations.deleteMany({ where: { id: { in: ids } } })).count;
    } else if (phase === "profileHistory") {
      count.archived = (await tx.admin_user_profile_changes.updateMany({ where: { id: { in: ids } }, data: { before_data: { redacted: true }, after_data: { redacted: true } } })).count;
    } else if (phase === "otp") {
      count.archived = (await tx.otp_challenges.deleteMany({ where: { id: { in: ids } } })).count;
    } else if (phase === "communications") {
      count.archived = (await tx.sms_deliveries.deleteMany({ where: { id: { in: ids } } })).count;
    }
    if (processed(count) !== ids.length) throw new Error("COUNT_MISMATCH");
    return count;
  }

  private async finalize(tx: Prisma.TransactionClient, job: user_deletion_jobs) {
    if (Object.values(await commercialBlockers(tx, job.user_id, job.source_seller_id)).some(Boolean)) throw new Error("UNFINISHED_OBLIGATIONS");
    const progress = job.progress as unknown as Record<string, TransferCount>;
    const expected = job.expected as Record<string, number>;
    for (const phase of TRANSFER_PHASES) {
      if (phase === "finalize") continue;
      const total = progress[phase] ?? emptyCount();
      if (processed(total) !== expected[phase]) throw new Error("COUNT_MISMATCH");
      const q = phaseQuery(phase, job);
      const [row] = await tx.$queryRaw<{ count: number }[]>(Prisma.sql`SELECT count(*)::int AS count FROM ${Prisma.raw(q.table)} WHERE ${q.where}`);
      const allowed = phase === "listings" || phase === "coupons" || phase === "profileHistory" ? total.archived : phase === "assignments" ? total.skipped : 0;
      if (row.count !== allowed) throw new Error("REMAINING_OWNERSHIP");
    }
    if (job.replacement_user_id) {
      const replacement = await tx.users.findUnique({ where: { id: job.replacement_user_id }, select: { account_status: true } });
      if (replacement?.account_status !== "active") throw new Error("REPLACEMENT_UNAVAILABLE");
    }
    await tx.seller_memberships.updateMany({ where: { user_id: job.user_id, active: true }, data: { active: false } });
    if (job.source_seller_id) {
      if (job.mode === "handoff") {
        if (await tx.products.count({ where: { created_by_seller_id: job.source_seller_id } }) !== expected.sellerProducts ||
            await tx.seller_listings.count({ where: { seller_id: job.source_seller_id } }) !== expected.sellerListings) throw new Error("COUNT_MISMATCH");
        progress.sellerProducts = { ...emptyCount(), transferred: expected.sellerProducts };
        progress.sellerListings = { ...emptyCount(), transferred: expected.sellerListings };
        const previous = job.seller_previous as { approved: boolean; invited: boolean; suspendedAt: string | null };
        await tx.sellers.update({ where: { id: job.source_seller_id }, data: {
          user_id: job.replacement_user_id!, approved: previous.approved, invited: previous.invited,
          suspended_at: previous.suspendedAt ? new Date(previous.suspendedAt) : null
        } });
        await tx.users.update({ where: { id: job.replacement_user_id! }, data: { role: "seller_admin" } });
        await tx.seller_memberships.updateMany({ where: { user_id: job.replacement_user_id!, active: true }, data: { active: false } });
        await tx.seller_memberships.upsert({ where: { seller_id_user_id: { seller_id: job.source_seller_id, user_id: job.replacement_user_id! } },
          create: { seller_id: job.source_seller_id, user_id: job.replacement_user_id!, role: "admin" }, update: { active: true, role: "admin" } });
        await tx.auth_sessions.updateMany({ where: { user_id: job.replacement_user_id!, revoked_at: null }, data: { revoked_at: new Date() } });
      } else {
        if (await tx.seller_listings.count({ where: { seller_id: job.source_seller_id, status: { not: "archived" } } }) ||
            await tx.coupons.count({ where: { seller_id: job.source_seller_id, active: true } })) throw new Error("REMAINING_OWNERSHIP");
        await tx.seller_memberships.updateMany({ where: { seller_id: job.source_seller_id }, data: { active: false } });
        await tx.sellers.update({ where: { id: job.source_seller_id }, data: { merged_into_seller_id: job.destination_seller_id, merged_at: new Date(), suspended_at: new Date() } });
      }
    }
    await tx.platform_staff_permissions.deleteMany({ where: { user_id: job.user_id } });
    await tx.auth_sessions.deleteMany({ where: { user_id: job.user_id } });
    await tx.admin_user_notes.updateMany({ where: { user_id: job.user_id }, data: { body: "[redacted]" } });
    await tx.users.update({ where: { id: job.user_id }, data: {
      account_status: "deleted", deleted_at: new Date(), full_name: "Deleted user", username: null, email: null, phone_number: null, password_hash: null
    } });
    await tx.user_account_events.create({ data: { user_id: job.user_id, actor_user_id: job.actor_user_id, action: "deleted", reason: job.reason,
      after_data: { jobId: job.id, replacementUserId: job.replacement_user_id, progress: job.progress } } });
    await tx.user_deletion_jobs.update({ where: { id: job.id }, data: { status: "completed", completed_at: new Date(), error_code: null, progress: progress as unknown as Prisma.InputJsonValue } });
    await tx.user_lifecycle_locks.deleteMany({ where: { job_id: job.id } });
  }
}
