import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { DeletionImpact } from "@topgsm/shared-types";
import { Prisma } from "../../prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { resolveUserId } from "../../common/user-reference";
import { AuthService } from "../auth/auth.service";
import { assertMutable, identifier, lifecycleUserSelect, lockAdministration, lockEntity, preserveAdmin, reason, recipientSeller } from "./user-lifecycle.policy";
import { mapDeletionJob, phaseQuery, TRANSFER_PHASES } from "./user-transfer.definition";
import type { CreateDeletionDto } from "./dto/user-lifecycle.dto";
import { commercialBlockers } from "./user-commercial-blockers";

@Injectable()
export class UserDeletionService {
  constructor(private readonly prisma: PrismaService, private readonly auth: AuthService) {}
  async impact(id: string, replacementUserId?: string, tx: Prisma.TransactionClient = this.prisma): Promise<DeletionImpact> {
    id = await resolveUserId(tx, id);
    if (replacementUserId) replacementUserId = await resolveUserId(tx, replacementUserId);
    const user = await tx.users.findUnique({ where: { id }, select: lifecycleUserSelect });
    if (!user) throw new NotFoundException("User not found");
    const source = user.sellers[0]?.id ?? null;
    let destination: string | null = null;
    let replacementLabel: string | null = null;
    if (replacementUserId) {
      if (replacementUserId === id) throw new BadRequestException("Replacement must be a different user");
      const replacement = await tx.users.findUnique({ where: { id: replacementUserId }, select: lifecycleUserSelect });
      if (!replacement) throw new NotFoundException("Replacement not found");
      replacementLabel = `${replacement.full_name} · ${identifier(replacement)}`;
      if (source && !replacement.email) throw new ConflictException("Add an email address to the replacement before transferring seller ownership");
      destination = recipientSeller(replacement);
      if (await tx.user_lifecycle_locks.count({ where: { OR: [{ entity_type: "user", entity_id: replacement.id }, ...(destination ? [{ entity_type: "seller", entity_id: destination }] : [])] } })) throw new ConflictException("Replacement is involved in another transfer");
      if (source && destination === source) destination = null; // existing staff can receive canonical ownership
      if (destination) {
        const seller = await tx.sellers.findUnique({ where: { id: destination }, select: { approved: true, invited: true, suspended_at: true, merged_into_seller_id: true } });
        if (!seller?.approved || seller.invited || seller.suspended_at || seller.merged_into_seller_id) throw new ConflictException("Destination seller must be active");
      }
    }
    const mode = source ? (destination ? "merge" : "handoff") : "content";
    const context = { user_id: id, source_seller_id: source, destination_seller_id: destination, replacement_user_id: replacementUserId ?? null, mode };
    const counts: Record<string, number> = {};
    for (const phase of TRANSFER_PHASES) {
      if (phase === "finalize") continue;
      const q = phaseQuery(phase, context);
      const [row] = await tx.$queryRaw<{ count: number }[]>(Prisma.sql`SELECT count(*)::int AS count FROM ${Prisma.raw(q.table)} WHERE ${q.where}`);
      counts[phase] = row.count;
    }
    // Handoff retains product/listing identity, but the preview must still show its size.
    counts.sellerProducts = source ? await tx.products.count({ where: { created_by_seller_id: source } }) : 0;
    counts.sellerListings = source ? await tx.seller_listings.count({ where: { seller_id: source } }) : 0;
    const blockers = await commercialBlockers(tx, id, source);
    const conflicts: Record<string, number> = {};
    if (mode === "merge") {
      const [row] = await tx.$queryRaw<{ listings: number; coupons: number; bridge: number }[]>(Prisma.sql`
        SELECT (SELECT count(*)::int FROM seller_listings s WHERE s.seller_id=${source} AND EXISTS (SELECT 1 FROM seller_listings d WHERE d.seller_id=${destination} AND d.product_id=s.product_id)) AS listings,
        (SELECT count(*)::int FROM coupons s WHERE s.seller_id=${source} AND EXISTS (SELECT 1 FROM coupons d WHERE d.seller_id=${destination} AND d.code=s.code)) AS coupons,
        (SELECT count(*)::int FROM seller_listings s JOIN products p ON p.id=s.product_id WHERE s.seller_id=${source} AND p.type='bridge') AS bridge`);
      Object.assign(conflicts, row);
    }
    return { counts, blockers, replacementLabel, replacementRequired: Boolean(source || counts.articles || counts.articleMedia || counts.comments), sourceSellerId: source, destinationSellerId: destination, mode, conflicts, identifier: identifier(user) };
  }

  async enqueue(id: string, actorId: string, input: CreateDeletionDto) {
    if (id === actorId) throw new ForbiddenException("You cannot delete your own account");
    const auditReason = reason(input.reason);
    const verifiedHash = await this.auth.verifyCurrentPassword(actorId, input.currentPassword);
    id = await resolveUserId(this.prisma, id);
    if (id === actorId) throw new ForbiddenException("You cannot delete your own account");
    input = { ...input, replacementUserId: input.replacementUserId ? await resolveUserId(this.prisma, input.replacementUserId) : undefined };
    return this.prisma.$transaction(async tx => {
      await lockAdministration(tx, actorId, verifiedHash);
      const replay = await tx.user_deletion_jobs.findUnique({ where: { id: input.idempotencyKey } });
      if (replay) {
        if (replay.user_id !== id || replay.actor_user_id !== actorId || replay.replacement_user_id !== (input.replacementUserId ?? null) || replay.reason !== auditReason) throw new ConflictException("Idempotency key already used for a different request");
        return mapDeletionJob(replay);
      }
      for (const userId of [id, input.replacementUserId].filter((v): v is string => Boolean(v)).sort()) await lockEntity(tx, "user", userId);
      const user = await tx.users.findUnique({ where: { id }, select: lifecycleUserSelect });
      if (!user) throw new NotFoundException("User not found");
      assertMutable(user);
      if (![identifier(user), user.support_code, user.id].includes(input.confirmation)) throw new BadRequestException("Exact account identifier required");
      await preserveAdmin(tx, user, user.role, "deleted");
      const preliminary = await this.impact(id, input.replacementUserId, tx);
      for (const sellerId of [preliminary.sourceSellerId, preliminary.destinationSellerId].filter((v): v is string => Boolean(v)).sort()) await lockEntity(tx, "seller", sellerId);
      const impact = await this.impact(id, input.replacementUserId, tx);
      if (Object.values(impact.blockers).some(Boolean)) throw new ConflictException({ message: "Complete outstanding obligations before deletion", blockers: impact.blockers });
      if (impact.replacementRequired && !input.replacementUserId) throw new BadRequestException("Choose a replacement for owned content");
      const seller = user.sellers[0];
      const job = await tx.user_deletion_jobs.create({ data: {
        id: input.idempotencyKey, user_id: id, actor_user_id: actorId, replacement_user_id: input.replacementUserId ?? null,
        source_seller_id: impact.sourceSellerId, destination_seller_id: impact.destinationSellerId, mode: impact.mode,
        expected: impact.counts, conflict_report: impact.conflicts, reason: auditReason,
        seller_previous: seller ? { approved: seller.approved, invited: seller.invited, suspendedAt: seller.suspended_at?.toISOString() ?? null } : {}
      } });
      const entities = [{ entity_type: "user", entity_id: id }, ...(input.replacementUserId ? [{ entity_type: "user", entity_id: input.replacementUserId }] : []), ...[impact.sourceSellerId, impact.destinationSellerId].filter((s): s is string => Boolean(s)).map(entity_id => ({ entity_type: "seller", entity_id }))];
      await tx.user_lifecycle_locks.createMany({ data: entities.map(e => ({ ...e, job_id: job.id })) });
      await tx.$queryRaw`SELECT set_config('topgsm.lifecycle_job', ${job.id}, true)`;
      await tx.users.update({ where: { id }, data: { account_status: "deletion_pending", deletion_requested_at: new Date() } });
      if (seller) await tx.sellers.update({ where: { id: seller.id }, data: { suspended_at: new Date() } });
      await tx.auth_sessions.updateMany({ where: { revoked_at: null, OR: [{ user_id: id }, ...(seller ? [{ user: { seller_memberships: { some: { seller_id: seller.id, active: true } } } }] : [])] }, data: { revoked_at: new Date() } });
      await tx.user_account_events.create({ data: { user_id: id, actor_user_id: actorId, action: "deletion_queued", reason: auditReason, after_data: { jobId: job.id, replacementUserId: input.replacementUserId ?? null, counts: impact.counts, conflicts: impact.conflicts } } });
      return mapDeletionJob(job);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30_000 });
  }

  async job(id: string, jobId: string) {
    id = await resolveUserId(this.prisma, id);
    const job = await this.prisma.user_deletion_jobs.findFirst({ where: { id: jobId, user_id: id } });
    if (!job) throw new NotFoundException("Deletion job not found");
    return mapDeletionJob(job);
  }
  async retry(id: string, jobId: string, actorId: string) {
    id = await resolveUserId(this.prisma, id);
    await this.prisma.$transaction(async tx => {
      await lockAdministration(tx, actorId);
      const changed = await tx.user_deletion_jobs.updateMany({ where: { id: jobId, user_id: id, status: "failed" }, data: { status: "queued", attempts: 0, error_code: null, next_attempt_at: new Date() } });
      if (changed.count !== 1) throw new ConflictException("Only failed jobs can be retried");
      await tx.user_account_events.create({ data: { user_id: id, actor_user_id: actorId, action: "deletion_retried", reason: "Retry verified ownership transfer", after_data: { jobId } } });
    });
    return this.job(id, jobId);
  }
}
