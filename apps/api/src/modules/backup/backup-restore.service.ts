import { BadRequestException, ConflictException, Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { BackupRestorePreflight } from "@topgsm/shared-types";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { cp, mkdir, rm, stat, statfs } from "node:fs/promises";
import { Prisma } from "../../prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AuthService } from "../auth/auth.service";
import { BackupArchiveService, type BackupArchiveManifest } from "./backup-archive.service";
import { BackupCreatorService } from "./backup-creator.service";
import { BackupDestinationService } from "./backup-destination.service";
import { hashMonitorToken, writePendingRestore } from "./backup-maintenance";
import { BackupPathsService } from "./backup-paths.service";
import { BackupRunService } from "./backup-run.service";
import type { BackupRestorePreflightDto, ConfirmBackupRestoreDto } from "./dto/backup.dto";

@Injectable()
export class BackupRestoreService {
  private readonly restartEnabled: boolean;

  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly paths: BackupPathsService,
    private readonly archive: BackupArchiveService,
    private readonly creator: BackupCreatorService,
    private readonly runs: BackupRunService,
    private readonly destinations: BackupDestinationService
  ) {
    this.restartEnabled = config.get<string>("BACKUP_RESTART_ENABLED") === "true";
  }

  async preflight(input: BackupRestorePreflightDto, actorUserId: string): Promise<BackupRestorePreflight> {
    const remoteSelected = Boolean(input.destinationId || input.remoteName);
    if (Boolean(input.destinationId) !== Boolean(input.remoteName) || [Boolean(input.runId), Boolean(input.uploadId), remoteSelected].filter(Boolean).length !== 1) {
      throw new BadRequestException("Select exactly one backup source");
    }
    const [activeBackup, activeRestore] = await Promise.all([
      this.prisma.backup_runs.findFirst({ where: { status: { in: ["queued", "running"] } }, select: { id: true } }),
      this.prisma.backup_restore_jobs.findFirst({ where: { status: { in: ["pending_restart", "restoring", "recovery_required"] } }, select: { id: true } })
    ]);
    if (activeBackup) throw new ConflictException("Wait for the active backup to finish before restoring");
    if (activeRestore) throw new ConflictException("Another restore is already active");
    await this.paths.ensure();
    const challengeId = randomUUID();
    const stagedArchive = this.paths.stagingPath(challengeId, "restore-source");
    const plain = this.paths.stagingPath(challengeId, "restore-plain");
    const extracted = this.paths.stagingPath(challengeId, "restore-extracted");
    try {
      let sourceKind: "catalog" | "upload" | "remote";
      let sourceReference: string;
      if (input.runId) {
        const source = await this.runs.archiveForDownload(input.runId);
        await cp(source.path, stagedArchive, { force: false });
        sourceKind = "catalog";
        sourceReference = input.runId;
      } else if (input.uploadId) {
        const source = this.paths.stagingPath(input.uploadId!, "upload");
        if (!(await stat(source).catch(() => null))?.isFile()) throw new NotFoundException("Uploaded backup package was not found or expired");
        await cp(source, stagedArchive, { force: false });
        sourceKind = "upload";
        sourceReference = input.uploadId!;
      } else {
        const destination = await this.destinations.getStored(input.destinationId!);
        await this.downloadWithRetry(destination, input.remoteName!, stagedArchive);
        sourceKind = "remote";
        sourceReference = `${input.destinationId}:${input.remoteName}`;
      }
      const envelope = await this.archive.decrypt(stagedArchive, plain);
      const manifest = await this.archive.extractPlainArchive(plain, extracted);
      if (envelope.archiveId !== manifest.archiveId) throw new BadRequestException("Backup package archive identity does not match its manifest");
      await this.validateCompatibility(manifest, stagedArchive);
      const phrase = `RESTORE ${manifest.archiveId.slice(-8).toUpperCase()}`;
      const expiresAt = new Date(Date.now() + 5 * 60_000);
      await this.prisma.$transaction(async (transaction) => {
        await transaction.backup_restore_challenges.deleteMany({ where: { expires_at: { lt: new Date() } } });
        await transaction.backup_restore_challenges.create({ data: {
          id: challengeId, actor_user_id: actorUserId, source_kind: sourceKind, source_reference: sourceReference,
          staged_archive_path: stagedArchive, manifest: manifest as unknown as Prisma.InputJsonValue,
          phrase_hash: this.hashPhrase(phrase), expires_at: expiresAt
        } });
        await transaction.backup_restore_events.create({ data: {
          actor_user_id: actorUserId, archive_id: manifest.archiveId, status: "ready", phase: "validating", metadata: { challengeId, sourceKind }
        } });
      });
      return { challengeId, confirmationPhrase: phrase, expiresAt: expiresAt.toISOString(), manifest: this.creator.summary(manifest), safetyBackupRequired: true };
    } catch (error) {
      await rm(stagedArchive, { force: true });
      throw error;
    } finally {
      await Promise.all([rm(plain, { force: true }), rm(extracted, { force: true, recursive: true })]);
    }
  }

  async confirm(input: ConfirmBackupRestoreDto, actorUserId: string) {
    const challenge = await this.prisma.backup_restore_challenges.findFirst({ where: {
      id: input.challengeId, actor_user_id: actorUserId, consumed_at: null, expires_at: { gt: new Date() }
    } });
    if (!challenge || challenge.phrase_hash !== this.hashPhrase(input.phrase)) throw new ConflictException("Restore challenge is invalid, expired, or already used");
    await this.auth.verifyCurrentPassword(actorUserId, input.password);
    const manifest = challenge.manifest as unknown as BackupArchiveManifest;
    const restoreId = randomUUID();
    const monitorToken = randomBytes(32).toString("base64url");
    const consumed = await this.prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT pg_advisory_xact_lock(8204211946)`;
      const activeBackup = await transaction.backup_runs.findFirst({ where: { status: { in: ["queued", "running"] } }, select: { id: true } });
      if (activeBackup) throw new ConflictException("Wait for the active backup to finish before restoring");
      const activeRestore = await transaction.backup_restore_jobs.findFirst({ where: { status: { in: ["pending_restart", "restoring", "recovery_required"] } }, select: { id: true } });
      if (activeRestore) throw new ConflictException("Another restore is already active");
      const result = await transaction.backup_restore_challenges.updateMany({ where: {
        id: challenge.id, actor_user_id: actorUserId, consumed_at: null, expires_at: { gt: new Date() }
      }, data: { consumed_at: new Date() } });
      if (result.count !== 1) return false;
      await transaction.backup_restore_events.create({ data: {
        actor_user_id: actorUserId, archive_id: manifest.archiveId, status: "pending_restart", phase: "validating", metadata: { restoreId }
      } });
      await transaction.backup_restore_jobs.create({ data: {
        id: restoreId, actor_user_id: actorUserId, archive_id: manifest.archiveId, status: "pending_restart", phase: "validating", requested_at: new Date()
      } });
      return true;
    });
    if (!consumed) throw new ConflictException("Restore challenge is invalid, expired, or already used");
    try {
      await writePendingRestore({
        version: 1, id: restoreId, actorUserId, challengeId: challenge.id, archivePath: challenge.staged_archive_path,
        archiveId: manifest.archiveId, monitorTokenHash: hashMonitorToken(monitorToken), requestedAt: new Date().toISOString()
      });
    } catch (error) {
      await this.prisma.backup_restore_jobs.update({ where: { id: restoreId }, data: { status: "failed", phase: "validating", error_code: "MAINTENANCE_DESCRIPTOR_FAILED" } });
      throw error;
    }
    if (this.restartEnabled) setTimeout(() => process.kill(process.pid, "SIGTERM"), 750).unref();
    return { restoreId, monitorToken, status: "pending_restart" as const, restartScheduled: this.restartEnabled };
  }

  uploadedPath(uploadId: string) {
    return this.paths.stagingPath(uploadId, "upload");
  }

  private async validateCompatibility(manifest: BackupArchiveManifest, archivePath: string) {
    if (manifest.platformOwnerCount < 1) throw new BadRequestException("Backup contains no platform owner");
    const versionRows = await this.prisma.$queryRaw<Array<{ version: string }>>(Prisma.sql`SHOW server_version_num`);
    const currentMajor = Math.floor(Number(versionRows[0]?.version ?? 0) / 10_000);
    if (!currentMajor || manifest.postgresMajor > currentMajor) throw new BadRequestException("Backup requires a newer PostgreSQL major version");
    if (manifest.migrationId) {
      const latest = await this.prisma.$queryRaw<Array<{ migration_name: string }>>(Prisma.sql`
        SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
        ORDER BY migration_name DESC LIMIT 1
      `).catch(() => []);
      if (latest[0]?.migration_name && manifest.migrationId > latest[0].migration_name) throw new BadRequestException("Backup schema is newer than this application build");
    }
    const packageBytes = (await stat(archivePath)).size;
    const required = packageBytes + (manifest.database?.bytes ?? 0) + manifest.uploadsBytes;
    const backupSpace = await statfs(this.paths.root);
    if (backupSpace.bavail * backupSpace.bsize < required * 1.25) throw new ServiceUnavailableException("Backup volume does not have enough free space for restore staging");
    if (manifest.components.includes("uploads")) {
      await mkdir(this.paths.mediaRoot, { recursive: true });
      const mediaSpace = await statfs(this.paths.mediaRoot);
      if (mediaSpace.bavail * mediaSpace.bsize < manifest.uploadsBytes * 1.25) throw new ServiceUnavailableException("Media volume does not have enough free space for restore");
    }
  }

  private hashPhrase(value: string) {
    return createHash("sha256").update(value.trim().replace(/\s+/g, " ").toUpperCase()).digest("hex");
  }

  private async downloadWithRetry(destination: Awaited<ReturnType<BackupDestinationService["getStored"]>>, name: string, path: string) {
    let lastError: unknown;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try { await this.destinations.download(destination, name, path); return; }
      catch (error) {
        lastError = error;
        await rm(path, { force: true });
        if (attempt < 3) await new Promise((resolvePromise) => setTimeout(resolvePromise, attempt * 1_000));
      }
    }
    throw lastError;
  }
}
