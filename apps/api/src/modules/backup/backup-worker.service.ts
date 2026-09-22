import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../prisma/prisma.service";
import { BackupCreatorService } from "./backup-creator.service";
import { BackupDestinationService } from "./backup-destination.service";
import { BackupRunService } from "./backup-run.service";
import { BackupSettingsService } from "./backup-settings.service";
import { readSystemStatus } from "./backup-maintenance";

const POLL_MS = 30_000;
const STALE_RUN_MS = 2 * 60 * 60 * 1000;

@Injectable()
export class BackupWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BackupWorkerService.name);
  private timer?: NodeJS.Timeout;
  private busy = false;
  private readonly safetyRetentionDays: number;

  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly creator: BackupCreatorService,
    private readonly destinationService: BackupDestinationService,
    private readonly runs: BackupRunService,
    private readonly settingsService: BackupSettingsService
  ) {
    const configured = Number(config.get<string>("BACKUP_SAFETY_RETENTION_DAYS"));
    this.safetyRetentionDays = Number.isSafeInteger(configured) && configured >= 7 ? configured : 7;
  }

  onModuleInit() {
    this.timer = setInterval(() => void this.tick(), POLL_MS);
    this.timer.unref();
    setTimeout(() => void this.tick(), 2_000).unref();
  }

  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }

  async tick() {
    if (this.busy) return;
    this.busy = true;
    try {
      if ((await readSystemStatus()).maintenance) return;
      await this.queueScheduledIfDue();
      await this.processOne();
      await this.processPendingDelivery();
    } catch (error) {
      this.logger.error(`Backup worker tick failed: ${this.errorCode(error)}`);
    } finally { this.busy = false; }
  }

  private async queueScheduledIfDue() {
    const now = new Date();
    const token = randomUUID();
    const claimed = await this.prisma.backup_settings.updateMany({ where: {
      id: 1, automation_enabled: true, next_run_at: { lte: now }, OR: [{ run_token: null }, { updated_at: { lte: new Date(now.getTime() - 15 * 60_000) } }]
    }, data: { run_token: token, updated_at: now } });
    if (claimed.count !== 1) return;
    try {
      const settings = await this.prisma.backup_settings.findFirstOrThrow({ where: { id: 1, run_token: token } });
      await this.runs.queue([
        ...(settings.include_database ? ["database" as const] : []), ...(settings.include_uploads ? ["uploads" as const] : [])
      ], null, "scheduled");
      const nextRunAt = this.settingsService.nextRun({
        frequency: settings.frequency as "daily" | "weekly", weekdays: settings.weekdays,
        localTime: settings.local_time, timezone: settings.timezone
      }, (await import("luxon")).DateTime.utc()).toJSDate();
      await this.prisma.backup_settings.update({ where: { id: 1 }, data: { next_run_at: nextRunAt, run_token: null, last_run_status: "queued" } });
    } catch (error) {
      await this.prisma.backup_settings.updateMany({ where: { id: 1, run_token: token }, data: { run_token: null, last_run_status: "failed", last_failure_at: new Date() } });
      if ((error as { status?: number }).status !== 409) throw error;
    }
  }

  private async processOne() {
    const token = randomUUID();
    const claimed = await this.prisma.$queryRaw<Array<{ id: string }>>`
      WITH candidate AS (
        SELECT id FROM backup_runs
        WHERE status = 'queued' OR (status = 'running' AND started_at <= ${new Date(Date.now() - STALE_RUN_MS)})
        ORDER BY created_at ASC, id ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      )
      UPDATE backup_runs AS run
      SET status = 'running', claim_token = ${token}::uuid, started_at = CURRENT_TIMESTAMP, error_code = NULL
      FROM candidate
      WHERE run.id = candidate.id
      RETURNING run.id
    `;
    if (!claimed[0]) return;
    const run = await this.prisma.backup_runs.findFirstOrThrow({ where: { id: claimed[0].id, claim_token: token }, include: { deliveries: true } });
    try {
      const created = await this.creator.create(run.id, run.components as Array<"database" | "uploads">, run.trigger as "manual" | "scheduled" | "pre_restore");
      await this.prisma.backup_runs.update({ where: { id: run.id }, data: {
        archive_name: created.archiveName, archive_path: created.archivePath, archive_bytes: BigInt(created.archiveBytes),
        archive_sha256: created.archiveSha256, manifest: created.manifest
      } });
      let failures = 0;
      for (const delivery of run.deliveries) {
        const destination = delivery.destination_id ? await this.prisma.backup_destinations.findUnique({ where: { id: delivery.destination_id } }) : null;
        if (!destination || !destination.enabled || !destination.verified_at) {
          failures += 1;
          await this.failDelivery(delivery.id, "DESTINATION_UNAVAILABLE", 0);
          continue;
        }
        let delivered = false;
        for (let attempt = 1; attempt <= 3 && !delivered; attempt += 1) {
          await this.prisma.backup_deliveries.update({ where: { id: delivery.id }, data: { status: "uploading", attempts: attempt, started_at: new Date(), error_code: null } });
          try {
            const remotePath = await this.destinationService.upload(destination, created.archivePath, created.archiveName);
            await this.prisma.backup_deliveries.update({ where: { id: delivery.id }, data: { status: "success", remote_path: remotePath, completed_at: new Date() } });
            delivered = true;
          } catch (error) {
            if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 1_000));
            else { failures += 1; await this.failDelivery(delivery.id, this.errorCode(error), attempt); }
          }
        }
      }
      const status = failures ? "partial" : "success";
      await this.prisma.$transaction([
        this.prisma.backup_runs.update({ where: { id: run.id }, data: { status, completed_at: new Date(), claim_token: null } }),
        this.prisma.backup_settings.update({ where: { id: 1 }, data: {
          last_run_status: status, last_success_at: new Date(), ...(failures ? { last_failure_at: new Date() } : {})
        } })
      ]);
      await this.applyLocalRetention();
    } catch (error) {
      const errorCode = this.errorCode(error);
      await this.prisma.$transaction([
        this.prisma.backup_runs.update({ where: { id: run.id }, data: { status: "failed", error_code: errorCode, completed_at: new Date(), claim_token: null } }),
        this.prisma.backup_settings.update({ where: { id: 1 }, data: { last_run_status: "failed", last_failure_at: new Date() } })
      ]);
      this.logger.error(`Backup ${run.id} failed: ${errorCode}`);
    }
  }

  private async failDelivery(id: string, errorCode: string, attempts: number) {
    await this.prisma.backup_deliveries.update({ where: { id }, data: { status: "failed", error_code: errorCode, attempts, completed_at: new Date() } });
  }

  private async processPendingDelivery() {
    await this.prisma.backup_deliveries.updateMany({
      where: { run: { status: { in: ["success", "partial"] } }, status: "uploading", attempts: { gte: 3 }, started_at: { lte: new Date(Date.now() - STALE_RUN_MS) } },
      data: { status: "failed", error_code: "DELIVERY_WORKER_INTERRUPTED", completed_at: new Date() }
    });
    const claimed = await this.prisma.$queryRaw<Array<{ id: string }>>`
      WITH candidate AS (
        SELECT delivery.id
        FROM backup_deliveries AS delivery
        JOIN backup_runs AS run ON run.id = delivery.run_id
        WHERE run.archive_path IS NOT NULL
          AND run.status IN ('success', 'partial')
          AND delivery.destination_id IS NOT NULL
          AND delivery.attempts < 3
          AND (
            (delivery.status = 'pending' AND (delivery.next_attempt_at IS NULL OR delivery.next_attempt_at <= CURRENT_TIMESTAMP))
            OR (delivery.status = 'uploading' AND delivery.started_at <= ${new Date(Date.now() - STALE_RUN_MS)})
          )
        ORDER BY delivery.next_attempt_at ASC NULLS FIRST, delivery.id ASC
        FOR UPDATE OF delivery SKIP LOCKED
        LIMIT 1
      )
      UPDATE backup_deliveries AS delivery
      SET status = 'uploading', attempts = delivery.attempts + 1, started_at = CURRENT_TIMESTAMP, error_code = NULL
      FROM candidate
      WHERE delivery.id = candidate.id
      RETURNING delivery.id
    `;
    if (!claimed[0]) return;
    const delivery = await this.prisma.backup_deliveries.findUniqueOrThrow({
      where: { id: claimed[0].id }, include: { destination: true, run: true }
    });
    try {
      if (!delivery.destination?.enabled || !delivery.destination.verified_at || !delivery.run.archive_path || !delivery.run.archive_name) {
        throw new Error("DESTINATION_UNAVAILABLE");
      }
      const remotePath = await this.destinationService.upload(delivery.destination, delivery.run.archive_path, delivery.run.archive_name);
      await this.prisma.backup_deliveries.update({ where: { id: delivery.id }, data: {
        status: "success", remote_path: remotePath, completed_at: new Date(), next_attempt_at: null
      } });
    } catch (error) {
      const exhausted = delivery.attempts >= 3;
      await this.prisma.backup_deliveries.update({ where: { id: delivery.id }, data: exhausted ? {
        status: "failed", error_code: this.errorCode(error), completed_at: new Date(), next_attempt_at: null
      } : {
        status: "pending", error_code: this.errorCode(error), next_attempt_at: new Date(Date.now() + delivery.attempts * 5_000)
      } });
    }
    const remaining = await this.prisma.backup_deliveries.groupBy({ by: ["status"], where: { run_id: delivery.run_id }, _count: { _all: true } });
    const statuses = new Set(remaining.map((item) => item.status));
    if (!statuses.has("pending") && !statuses.has("uploading")) {
      await this.prisma.backup_runs.update({ where: { id: delivery.run_id }, data: { status: statuses.has("failed") ? "partial" : "success" } });
    }
  }

  private async applyLocalRetention() {
    const settings = await this.prisma.backup_settings.findUniqueOrThrow({ where: { id: 1 }, select: { local_retention_count: true } });
    const expired = await this.prisma.backup_runs.findMany({
      where: { status: { in: ["success", "partial"] }, trigger: { not: "pre_restore" }, archive_path: { not: null } },
      select: { id: true, archive_path: true }, orderBy: [{ completed_at: "desc" }, { id: "desc" }], skip: settings.local_retention_count
    });
    for (const item of expired) {
      if (!item.archive_path) continue;
      await Promise.all([rm(item.archive_path, { force: true }), rm(`${item.archive_path}.meta.json`, { force: true })]);
      await this.prisma.backup_runs.update({ where: { id: item.id }, data: { archive_path: null } });
    }
    const safetyExpired = await this.prisma.backup_runs.findMany({
      where: { trigger: "pre_restore", archive_path: { not: null }, completed_at: { lt: new Date(Date.now() - this.safetyRetentionDays * 86_400_000) } },
      select: { id: true, archive_path: true }
    });
    for (const item of safetyExpired) {
      if (!item.archive_path) continue;
      await Promise.all([rm(item.archive_path, { force: true }), rm(`${item.archive_path}.meta.json`, { force: true })]);
      await this.prisma.backup_runs.update({ where: { id: item.id }, data: { archive_path: null } });
    }
  }

  private errorCode(error: unknown) {
    return (error instanceof Error ? `${error.name}:${error.message}` : "UNKNOWN_ERROR").replace(/[^A-Za-z0-9:_-]/g, "_").slice(0, 64).toUpperCase();
  }
}
