import { Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { spawn } from "node:child_process";
import { mkdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { Client } from "pg";
import type { BackupComponent } from "@topgsm/shared-types";
import { BackupArchiveService, type BackupArchiveManifest } from "./backup-archive.service";
import { BackupPathsService } from "./backup-paths.service";
import { MEDIA_BACKUP_LOCK } from "../media/media-backup-lock";

type CreatedBackup = {
  manifest: BackupArchiveManifest;
  archiveName: string;
  archivePath: string;
  archiveBytes: number;
  archiveSha256: string;
};

@Injectable()
export class BackupCreatorService {
  private readonly logger = new Logger(BackupCreatorService.name);
  private readonly databaseUrl: string;
  private readonly pgDump: string;

  constructor(
    config: ConfigService,
    private readonly paths: BackupPathsService,
    private readonly archive: BackupArchiveService
  ) {
    const databaseUrl = config.get<string>("DATABASE_URL")?.trim();
    if (!databaseUrl) throw new Error("DATABASE_URL is required for backups");
    this.databaseUrl = databaseUrl;
    this.pgDump = config.get<string>("PG_DUMP_BIN")?.trim() || "pg_dump";
  }

  async create(archiveId: string, components: BackupComponent[], trigger: "manual" | "scheduled" | "pre_restore" = "manual"): Promise<CreatedBackup> {
    await this.paths.ensure();
    const work = this.paths.stagingPath(archiveId, "work");
    const plainPath = this.paths.stagingPath(archiveId, "tar.gz.partial");
    const encryptedPartial = this.paths.stagingPath(archiveId, "encrypted.partial");
    await Promise.all([rm(work, { force: true, recursive: true }), rm(plainPath, { force: true }), rm(encryptedPartial, { force: true })]);
    await mkdir(work, { recursive: false });
    const databasePath = resolve(work, "database.dump");
    const client = new Client({ connectionString: this.databaseUrl, connectionTimeoutMillis: 10_000 });
    try {
      await client.connect();
      await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
      await client.query("SELECT pg_advisory_xact_lock($1)", [MEDIA_BACKUP_LOCK]);
      const snapshot = (await client.query<{ snapshot: string }>("SELECT pg_export_snapshot() AS snapshot")).rows[0]?.snapshot;
      if (!snapshot) throw new ServiceUnavailableException("PostgreSQL snapshot could not be exported");
      const version = Number((await client.query<{ version: string }>("SHOW server_version_num")).rows[0]?.version ?? 0);
      const platformOwnerCount = Number((await client.query<{ count: string }>("SELECT COUNT(*)::text AS count FROM users WHERE role = 'platform_admin'")).rows[0]?.count ?? 0);
      if (platformOwnerCount < 1) throw new ServiceUnavailableException("Backup requires at least one platform owner");
      const migration = await client.query<{ migration_name: string }>(
        "SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY finished_at DESC, migration_name DESC LIMIT 1"
      ).catch(() => ({ rows: [] as Array<{ migration_name: string }> }));
      const uploads = components.includes("uploads") ? await this.readUploads(client) : [];
      if (components.includes("database")) {
        await this.run(this.pgDump, ["--format=custom", "--no-owner", "--no-privileges", `--snapshot=${snapshot}`, `--file=${databasePath}`], this.postgresEnvironment());
      }
      const uploadEntries: BackupArchiveManifest["uploads"] = [];
      for (const relativePath of uploads) {
        const source = this.safeMediaPath(relativePath);
        const metadata = await stat(source);
        if (!metadata.isFile()) throw new ServiceUnavailableException("A referenced upload is not a regular file");
        uploadEntries.push({ path: relativePath, bytes: metadata.size, sha256: await this.archive.sha256(source) });
      }
      const database = components.includes("database")
        ? { bytes: (await stat(databasePath)).size, sha256: await this.archive.sha256(databasePath) }
        : null;
      const manifest: BackupArchiveManifest = {
        formatVersion: 1,
        archiveId,
        createdAt: new Date().toISOString(),
        appVersion: process.env.BACKUP_APP_VERSION?.trim() || process.env.npm_package_version || "0.1.0",
        migrationId: migration.rows[0]?.migration_name ?? null,
        postgresMajor: Math.floor(version / 10_000),
        components,
        database,
        uploads: uploadEntries,
        uploadsBytes: uploadEntries.reduce((sum, item) => sum + item.bytes, 0),
        platformOwnerCount
      };
      await this.archive.packPlainArchive(plainPath, manifest, database ? databasePath : null, this.paths.mediaRoot, uploadEntries);
      await client.query("COMMIT");
      const encrypted = await this.archive.encrypt(plainPath, encryptedPartial, archiveId);
      const timestamp = manifest.createdAt.replace(/[-:]/g, "").replace(/[.][0-9]{3}/, "");
      const archiveName = `topgsm-${timestamp}-${archiveId}.topgsm-backup`;
      const archivePath = this.paths.archivePath(archiveName);
      await rename(encryptedPartial, archivePath);
      await writeFile(`${archivePath}.meta.json`, JSON.stringify({ trigger, manifest: this.summary(manifest), archiveBytes: encrypted.bytes, archiveSha256: encrypted.sha256 }), { flag: "wx", mode: 0o600 });
      return { manifest, archiveName, archivePath, archiveBytes: encrypted.bytes, archiveSha256: encrypted.sha256 };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      this.logger.error(`Backup creation failed: ${this.errorCode(error)}`);
      throw error;
    } finally {
      await client.end().catch(() => undefined);
      await Promise.all([rm(work, { force: true, recursive: true }), rm(plainPath, { force: true }), rm(encryptedPartial, { force: true })]);
    }
  }

  summary(manifest: BackupArchiveManifest) {
    return {
      formatVersion: 1 as const,
      archiveId: manifest.archiveId,
      createdAt: manifest.createdAt,
      appVersion: manifest.appVersion,
      migrationId: manifest.migrationId,
      postgresMajor: manifest.postgresMajor,
      components: manifest.components,
      databaseBytes: manifest.database?.bytes ?? 0,
      uploadsBytes: manifest.uploadsBytes,
      uploadCount: manifest.uploads.length,
      platformOwnerCount: manifest.platformOwnerCount
    };
  }

  private async readUploads(client: Client) {
    const rows = await client.query<{ path: string }>(`
      SELECT path FROM blog_media_variants
      UNION
      SELECT path FROM product_media_variants
      UNION
      SELECT path FROM seller_profile_media_assets
      ORDER BY path
    `);
    return rows.rows.map(({ path }) => path.replaceAll("\\", "/"));
  }

  private safeMediaPath(relative: string) {
    const root = resolve(this.paths.mediaRoot);
    const path = resolve(root, relative);
    if (path !== root && !path.startsWith(`${root}${sep}`)) throw new ServiceUnavailableException("A media path escapes MEDIA_ROOT");
    return path;
  }

  private postgresEnvironment() {
    const parsed = new URL(this.databaseUrl);
    return {
      ...process.env,
      PGHOST: parsed.hostname,
      PGPORT: parsed.port || "5432",
      PGUSER: decodeURIComponent(parsed.username),
      PGPASSWORD: decodeURIComponent(parsed.password),
      PGDATABASE: parsed.pathname.replace(/^\//, ""),
      ...(parsed.searchParams.get("sslmode") ? { PGSSLMODE: parsed.searchParams.get("sslmode")! } : {})
    };
  }

  private run(command: string, args: string[], environment: NodeJS.ProcessEnv) {
    return new Promise<void>((resolvePromise, reject) => {
      const child = spawn(command, args, { env: environment, shell: false, windowsHide: true, stdio: ["ignore", "ignore", "pipe"] });
      let stderr = "";
      const timeout = setTimeout(() => child.kill("SIGKILL"), 60 * 60 * 1000);
      child.stderr.on("data", (chunk: Buffer) => { if (stderr.length < 8_000) stderr += chunk.toString("utf8"); });
      child.on("error", (error) => { clearTimeout(timeout); reject(new ServiceUnavailableException(`Backup tool could not start: ${this.errorCode(error)}`)); });
      child.on("exit", (code) => {
        clearTimeout(timeout);
        if (code === 0) resolvePromise();
        else reject(new ServiceUnavailableException(`Backup tool failed (${code ?? "signal"}): ${this.cleanProcessError(stderr)}`));
      });
    });
  }

  private cleanProcessError(value: string) {
    return value.replaceAll(this.databaseUrl, "[REDACTED]").replace(/password=[^\s]+/gi, "password=[REDACTED]").trim().slice(0, 500) || "unknown error";
  }

  private errorCode(error: unknown) {
    return error instanceof Error ? error.name : "UNKNOWN_ERROR";
  }
}

export { MEDIA_BACKUP_LOCK } from "../media/media-backup-lock";
