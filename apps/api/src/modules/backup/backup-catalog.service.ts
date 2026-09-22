import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import type { BackupComponent, BackupManifestSummary } from "@topgsm/shared-types";
import { readdir, readFile, rm, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { Prisma } from "../../prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { BackupArchiveService } from "./backup-archive.service";
import { readPendingRestore } from "./backup-maintenance";
import { BackupPathsService } from "./backup-paths.service";

const STALE_STAGING_MS = 24 * 60 * 60 * 1000;
const RESTORE_MONITOR_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const ARCHIVE_NAME = /^topgsm-[0-9]{8}T[0-9]{6}Z-([0-9a-f-]{36})[.]topgsm-backup$/i;

type Sidecar = {
  trigger?: "manual" | "scheduled" | "pre_restore";
  manifest: BackupManifestSummary;
  archiveBytes: number;
  archiveSha256: string;
};

@Injectable()
export class BackupCatalogService implements OnModuleInit {
  private readonly logger = new Logger(BackupCatalogService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly paths: BackupPathsService,
    private readonly archive: BackupArchiveService
  ) {}

  async onModuleInit() {
    await this.paths.ensure();
    await this.cleanStaleStaging();
    await this.cleanStaleRestoreMonitors();
    await this.reconcileLocalArchives();
  }

  private async reconcileLocalArchives() {
    const entries = await readdir(this.paths.archives, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".topgsm-backup.meta.json")) continue;
      const archiveName = entry.name.slice(0, -".meta.json".length);
      const match = ARCHIVE_NAME.exec(archiveName);
      if (!match?.[1]) continue;
      const archivePath = this.paths.archivePath(archiveName);
      try {
        const sidecar = this.parseSidecar(await readFile(resolve(this.paths.archives, entry.name), "utf8"), match[1]);
        const metadata = await stat(archivePath);
        if (!metadata.isFile() || metadata.size !== sidecar.archiveBytes || await this.archive.sha256(archivePath) !== sidecar.archiveSha256) {
          this.logger.warn(`Ignored local backup with invalid sidecar: ${archiveName}`);
          continue;
        }
        const createdAt = new Date(sidecar.manifest.createdAt);
        await this.prisma.backup_runs.upsert({
          where: { id: sidecar.manifest.archiveId },
          create: {
            id: sidecar.manifest.archiveId, trigger: sidecar.trigger ?? "manual", status: "success",
            components: sidecar.manifest.components, archive_name: archiveName, archive_path: archivePath,
            archive_bytes: BigInt(sidecar.archiveBytes), archive_sha256: sidecar.archiveSha256,
            manifest: sidecar.manifest as unknown as Prisma.InputJsonValue,
            created_at: createdAt, started_at: createdAt, completed_at: createdAt
          },
          update: {
            archive_name: archiveName, archive_path: archivePath, archive_bytes: BigInt(sidecar.archiveBytes),
            archive_sha256: sidecar.archiveSha256, manifest: sidecar.manifest as unknown as Prisma.InputJsonValue
          }
        });
        await this.prisma.backup_runs.updateMany({
          where: { id: sidecar.manifest.archiveId, status: { in: ["queued", "running"] } },
          data: { status: "success", error_code: null, claim_token: null, completed_at: createdAt }
        });
      } catch (error) {
        this.logger.warn(`Could not reconcile local backup ${archiveName}: ${this.errorCode(error)}`);
      }
    }
  }

  private async cleanStaleStaging() {
    const pending = await readPendingRestore();
    const entries = await readdir(this.paths.staging, { withFileTypes: true });
    const cutoff = Date.now() - STALE_STAGING_MS;
    for (const entry of entries) {
      const path = resolve(this.paths.staging, entry.name);
      if (pending?.archivePath === path) continue;
      const metadata = await stat(path).catch(() => null);
      if (metadata && metadata.mtimeMs < cutoff) await rm(path, { recursive: entry.isDirectory(), force: true });
    }
  }

  private async cleanStaleRestoreMonitors() {
    const pending = await readPendingRestore();
    const entries = await readdir(this.paths.state, { withFileTypes: true });
    const cutoff = Date.now() - RESTORE_MONITOR_RETENTION_MS;
    for (const entry of entries) {
      const match = /^restore-([0-9a-f-]{36})[.](json|token)$/i.exec(entry.name);
      if (!entry.isFile() || !match?.[1] || match[1] === pending?.id) continue;
      const path = resolve(this.paths.state, entry.name);
      const metadata = await stat(path).catch(() => null);
      if (metadata && metadata.mtimeMs < cutoff) await rm(path, { force: true });
    }
  }

  private parseSidecar(value: string, archiveId: string): Sidecar {
    const parsed = JSON.parse(value) as Partial<Sidecar>;
    const manifest = parsed.manifest;
    if (!manifest || manifest.formatVersion !== 1 || manifest.archiveId !== archiveId || Number.isNaN(Date.parse(manifest.createdAt)) ||
      !Array.isArray(manifest.components) || manifest.components.length < 1 || manifest.components.some((item) => item !== "database" && item !== "uploads") ||
      !Number.isSafeInteger(parsed.archiveBytes) || parsed.archiveBytes! <= 0 || typeof parsed.archiveSha256 !== "string" || !/^[0-9a-f]{64}$/.test(parsed.archiveSha256) ||
      parsed.trigger !== undefined && !["manual", "scheduled", "pre_restore"].includes(parsed.trigger)) {
      throw new Error("INVALID_SIDECAR");
    }
    manifest.components = [...new Set(manifest.components)] as BackupComponent[];
    return parsed as Sidecar;
  }

  private errorCode(error: unknown) {
    return error instanceof Error ? error.message.replace(/[^A-Za-z0-9:_-]/g, "_").slice(0, 64) : "UNKNOWN";
  }
}
