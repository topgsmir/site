import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { AdminBackupOverview, AdminBackupRun, AdminBackupRunPage, BackupComponent } from "@topgsm/shared-types";
import { stat } from "node:fs/promises";
import { PrismaService } from "../../prisma/prisma.service";
import { BackupDestinationService } from "./backup-destination.service";
import { BackupPathsService } from "./backup-paths.service";
import { BackupSettingsService } from "./backup-settings.service";
import type { ListBackupRunsDto } from "./dto/backup.dto";
import { readSystemStatus } from "./backup-maintenance";

type RunWithRelations = Awaited<ReturnType<BackupRunService["findRun"]>>;

@Injectable()
export class BackupRunService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: BackupSettingsService,
    private readonly destinations: BackupDestinationService,
    private readonly paths: BackupPathsService
  ) {}

  async overview(): Promise<AdminBackupOverview> {
    const [settings, destinations, recentRows, recentRestores, active, storage] = await Promise.all([
      this.settings.get(), this.destinations.list(),
      this.prisma.backup_runs.findMany({ include: this.relations(), orderBy: [{ created_at: "desc" }, { id: "desc" }], take: 5 }),
      this.prisma.backup_restore_events.findMany({ orderBy: [{ created_at: "desc" }, { id: "desc" }], take: 10 }),
      this.prisma.backup_runs.findFirst({ where: { status: { in: ["queued", "running"] } }, select: { id: true }, orderBy: { created_at: "asc" } }),
      this.prisma.backup_runs.aggregate({ where: { status: { in: ["success", "partial"] }, archive_path: { not: null } }, _sum: { archive_bytes: true } })
    ]);
    return {
      settings, destinations, recentRuns: recentRows.map((row) => this.map(row)),
      recentRestores: recentRestores.map((row) => ({
        id: row.id, archiveId: row.archive_id, status: row.status as AdminBackupOverview["recentRestores"][number]["status"],
        phase: row.phase as AdminBackupOverview["recentRestores"][number]["phase"], errorCode: row.error_code, createdAt: row.created_at.toISOString()
      })),
      localArchiveBytes: Number(storage._sum.archive_bytes ?? 0n), activeRunId: active?.id ?? null
    };
  }

  async queue(components: BackupComponent[], actorUserId: string | null, trigger: "manual" | "scheduled" | "pre_restore" = "manual") {
    if ((await readSystemStatus()).maintenance) throw new ConflictException("Backups cannot start during restore maintenance");
    const normalized = [...new Set(components)];
    if (!normalized.length || normalized.some((item) => item !== "database" && item !== "uploads")) throw new ConflictException("Backup components are invalid");
    return this.prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT pg_advisory_xact_lock(8204211946)`;
      const activeRestore = await transaction.backup_restore_jobs.findFirst({ where: { status: { in: ["pending_restart", "restoring", "recovery_required"] } }, select: { id: true } });
      if (activeRestore) throw new ConflictException("Backups cannot start while a restore is active");
      const active = await transaction.backup_runs.findFirst({ where: { status: { in: ["queued", "running"] } }, select: { id: true } });
      if (active) throw new ConflictException("Another backup is already queued or running");
      const destinations = trigger === "pre_restore" ? [] : await transaction.backup_destinations.findMany({ where: { enabled: true, verified_at: { not: null } }, select: { id: true, name: true, protocol: true } });
      return transaction.backup_runs.create({ data: {
        trigger, components: normalized, actor_user_id: actorUserId,
        deliveries: { create: destinations.map((item) => ({ destination_id: item.id, destination_name: item.name, protocol: item.protocol })) }
      }, include: this.relations() });
    });
  }

  async list(query: ListBackupRunsDto): Promise<AdminBackupRunPage> {
    const cursor = query.cursor ? this.decodeCursor(query.cursor) : null;
    const rows = await this.prisma.backup_runs.findMany({
      where: cursor ? { OR: [{ created_at: { lt: cursor.createdAt } }, { created_at: cursor.createdAt, id: { lt: cursor.id } }] } : undefined,
      include: this.relations(), orderBy: [{ created_at: "desc" }, { id: "desc" }], take: query.limit + 1
    });
    const hasMore = rows.length > query.limit;
    const page = rows.slice(0, query.limit);
    const last = page.at(-1);
    return { items: page.map((row) => this.map(row)), nextCursor: hasMore && last ? this.encodeCursor(last.created_at, last.id) : null };
  }

  async get(id: string) {
    const row = await this.findRun(id);
    if (!row) throw new NotFoundException("Backup run was not found");
    return this.map(row);
  }

  async archiveForDownload(id: string) {
    const row = await this.prisma.backup_runs.findUnique({ where: { id }, select: { archive_name: true, archive_path: true, status: true } });
    if (!row?.archive_name || !row.archive_path || !["success", "partial"].includes(row.status)) throw new NotFoundException("Backup archive is unavailable");
    const expected = this.paths.archivePath(row.archive_name);
    if (expected !== row.archive_path || !(await stat(expected).catch(() => null))?.isFile()) throw new NotFoundException("Backup archive file is unavailable");
    return { name: row.archive_name, path: expected };
  }

  async retryDeliveries(id: string) {
    await this.archiveForDownload(id);
    const reset = await this.prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT pg_advisory_xact_lock(8204211946)`;
      return transaction.backup_deliveries.updateMany({
        where: { run_id: id, status: "failed", destination_id: { not: null } },
        data: { status: "pending", attempts: 0, error_code: null, next_attempt_at: new Date(), started_at: null, completed_at: null }
      });
    });
    if (!reset.count) throw new ConflictException("This backup has no failed remote deliveries to retry");
    return this.get(id);
  }

  findRun(id: string) {
    return this.prisma.backup_runs.findUnique({ where: { id }, include: this.relations() });
  }

  map(row: NonNullable<RunWithRelations>): AdminBackupRun {
    return {
      id: row.id, trigger: row.trigger as AdminBackupRun["trigger"], status: row.status as AdminBackupRun["status"],
      components: row.components as BackupComponent[], archiveName: row.archive_name, archiveBytes: row.archive_bytes === null ? null : Number(row.archive_bytes),
      archiveSha256: row.archive_sha256, errorCode: row.error_code, createdAt: row.created_at.toISOString(),
      startedAt: row.started_at?.toISOString() ?? null, completedAt: row.completed_at?.toISOString() ?? null,
      actor: row.actor ? { id: row.actor.id, name: row.actor.full_name } : null,
      deliveries: row.deliveries.map((delivery) => ({
        id: delivery.id, destinationId: delivery.destination_id ?? "", destinationName: delivery.destination_name,
        protocol: delivery.protocol as AdminBackupRun["deliveries"][number]["protocol"],
        status: delivery.status as AdminBackupRun["deliveries"][number]["status"], remotePath: delivery.remote_path,
        attempts: delivery.attempts, errorCode: delivery.error_code, completedAt: delivery.completed_at?.toISOString() ?? null
      }))
    };
  }

  private relations() {
    return {
      actor: { select: { id: true, full_name: true } },
      deliveries: { orderBy: [{ destination_name: "asc" as const }, { id: "asc" as const }] }
    };
  }

  private encodeCursor(createdAt: Date, id: string) {
    return Buffer.from(JSON.stringify({ v: 1, createdAt: createdAt.toISOString(), id }), "utf8").toString("base64url");
  }

  private decodeCursor(value: string) {
    try {
      const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as { v?: number; createdAt?: string; id?: string };
      const createdAt = new Date(parsed.createdAt ?? "");
      if (parsed.v !== 1 || Number.isNaN(createdAt.getTime()) || !parsed.id || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(parsed.id)) throw new Error("invalid");
      return { createdAt, id: parsed.id };
    } catch { throw new ConflictException("Backup cursor is invalid"); }
  }
}
