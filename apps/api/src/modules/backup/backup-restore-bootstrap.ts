import { ConfigService } from "@nestjs/config";
import type { BackupRestoreProgress } from "@topgsm/shared-types";
import { spawn } from "node:child_process";
import { createServer, type Server } from "node:http";
import { cp, mkdir, rename, rm, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { Client } from "pg";
import { CredentialCryptoService } from "../../common/security/credential-crypto.service";
import { BackupArchiveService } from "./backup-archive.service";
import { BackupCreatorService } from "./backup-creator.service";
import {
  clearPendingRestore,
  readPendingRestore,
  readRestoreProgress,
  readSystemStatus,
  verifyRestoreMonitorToken,
  writeRestoreProgress
} from "./backup-maintenance";
import { BackupPathsService } from "./backup-paths.service";

export async function runPendingRestoreBeforeBootstrap() {
  const pending = await readPendingRestore();
  if (!pending) return;
  const config = new ConfigService(process.env);
  const paths = new BackupPathsService(config);
  const crypto = new CredentialCryptoService(config);
  const archive = new BackupArchiveService(config, crypto);
  const creator = new BackupCreatorService(config, paths, archive);
  await paths.ensure();
  const server = await startMaintenanceServer(config);
  const plain = paths.stagingPath(pending.id, "boot-plain");
  const extracted = paths.stagingPath(pending.id, "boot-extracted");
  const mediaStage = resolve(dirname(paths.mediaRoot), `.topgsm-restore-${pending.id}`);
  const mediaOld = resolve(dirname(paths.mediaRoot), `.topgsm-rollback-${pending.id}`);
  let databaseChanged = false;
  let mediaChanged = false;
  let safety: Awaited<ReturnType<BackupCreatorService["create"]>> | null = null;
  try {
    await recordRestoreJob(pending.id, pending.archiveId, "restoring", "validating");
    await progress(pending.id, "restoring", "validating", "Validating the encrypted backup package.");
    const envelope = await archive.decrypt(pending.archivePath, plain);
    const manifest = await archive.extractPlainArchive(plain, extracted);
    if (envelope.archiveId !== pending.archiveId || manifest.archiveId !== pending.archiveId) throw new Error("ARCHIVE_ID_MISMATCH");
    await progress(pending.id, "restoring", "safety_backup", "Creating the pre-restore safety backup.");
    safety = await creator.create(cryptoRandomId(), ["database", "uploads"], "pre_restore");
    if (manifest.components.includes("database")) {
      await progress(pending.id, "restoring", "database", "Restoring the PostgreSQL database.");
      await pgRestore(resolve(extracted, "database.dump"));
      databaseChanged = true;
      await progress(pending.id, "restoring", "migrations", "Applying compatible database migrations.");
      await runCommand(process.env.PNPM_BIN?.trim() || "pnpm", ["-C", "apps/api", "prisma:migrate"], process.env, 30 * 60_000);
      const database = new Client({ connectionString: requiredDatabaseUrl(), connectionTimeoutMillis: 10_000 });
      await database.connect();
      try { await database.query("UPDATE auth_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE revoked_at IS NULL"); }
      finally { await database.end(); }
    }
    if (manifest.components.includes("uploads")) {
      await progress(pending.id, "restoring", "uploads", "Replacing the upload store atomically.");
      await rm(mediaStage, { force: true, recursive: true });
      await mkdir(mediaStage, { recursive: true });
      const extractedUploads = resolve(extracted, "uploads");
      if ((await stat(extractedUploads).catch(() => null))?.isDirectory()) await cp(extractedUploads, mediaStage, { recursive: true, errorOnExist: true });
      await rm(mediaOld, { force: true, recursive: true });
      if ((await stat(paths.mediaRoot).catch(() => null))?.isDirectory()) await rename(paths.mediaRoot, mediaOld);
      await rename(mediaStage, paths.mediaRoot);
      mediaChanged = true;
    }
    await progress(pending.id, "success", "complete", "Restore completed. The application is restarting.");
    await recordRestoreJob(pending.id, pending.archiveId, "success", "complete");
    await clearPendingRestore();
    await Promise.all([rm(mediaOld, { force: true, recursive: true }), rm(pending.archivePath, { force: true })]);
  } catch (error) {
    await progress(pending.id, "restoring", "rollback", "Restore failed. Rolling back to the safety backup.");
    let recovered = true;
    try {
      if (databaseChanged && safety) {
        const rollbackPlain = paths.stagingPath(pending.id, "rollback-plain");
        const rollbackExtracted = paths.stagingPath(pending.id, "rollback-extracted");
        try {
          await archive.decrypt(safety.archivePath, rollbackPlain);
          await archive.extractPlainArchive(rollbackPlain, rollbackExtracted);
          await pgRestore(resolve(rollbackExtracted, "database.dump"));
        } finally {
          await Promise.all([rm(rollbackPlain, { force: true }), rm(rollbackExtracted, { force: true, recursive: true })]);
        }
      }
      if (mediaChanged) {
        await rm(paths.mediaRoot, { force: true, recursive: true });
        if ((await stat(mediaOld).catch(() => null))?.isDirectory()) await rename(mediaOld, paths.mediaRoot);
      }
    } catch { recovered = false; }
    await progress(
      pending.id,
      recovered ? "failed" : "recovery_required",
      "rollback",
      recovered ? "Restore failed and the previous state was recovered." : "Restore and automatic recovery failed. Operator recovery is required."
    );
    await recordRestoreJob(pending.id, pending.archiveId, recovered ? "failed" : "recovery_required", "rollback").catch(() => undefined);
    if (recovered) await clearPendingRestore();
    else await new Promise<never>(() => undefined);
  } finally {
    await Promise.all([rm(plain, { force: true }), rm(extracted, { force: true, recursive: true }), rm(mediaStage, { force: true, recursive: true })]);
    await closeServer(server);
  }
}

async function recordRestoreJob(id: string, archiveId: string, status: "restoring" | "success" | "failed" | "recovery_required", phase: string) {
  const database = new Client({ connectionString: requiredDatabaseUrl(), connectionTimeoutMillis: 10_000 });
  await database.connect();
  try {
    await database.query(`
      INSERT INTO backup_restore_jobs (id, archive_id, status, phase, requested_at, updated_at)
      VALUES ($1::uuid, $2::uuid, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, phase = EXCLUDED.phase, updated_at = CURRENT_TIMESTAMP
    `, [id, archiveId, status, phase]);
    await database.query(`
      INSERT INTO backup_restore_events (id, archive_id, status, phase, metadata)
      VALUES ($5::uuid, $1::uuid, $2, $3, jsonb_build_object('restoreId', $4::text))
    `, [archiveId, status, phase, id, cryptoRandomId()]);
  } finally { await database.end(); }
}

async function progress(id: string, status: BackupRestoreProgress["status"], phase: BackupRestoreProgress["phase"], message: string) {
  await writeRestoreProgress({ id, status, phase, message, updatedAt: new Date().toISOString() });
}

async function pgRestore(dumpPath: string) {
  await runCommand(process.env.PG_RESTORE_BIN?.trim() || "pg_restore", [
    "--clean", "--if-exists", "--single-transaction", "--no-owner", "--no-privileges", "--exit-on-error", "--dbname", postgresConnectionArgument(), dumpPath
  ], postgresEnvironment(), 60 * 60_000);
}

function requiredDatabaseUrl() {
  const value = process.env.DATABASE_URL?.trim();
  if (!value) throw new Error("DATABASE_URL_REQUIRED");
  return value;
}

function postgresConnectionArgument() {
  return decodeURIComponent(new URL(requiredDatabaseUrl()).pathname.replace(/^\//, ""));
}

function postgresEnvironment() {
  const parsed = new URL(requiredDatabaseUrl());
  return {
    ...process.env,
    PGHOST: parsed.hostname,
    PGPORT: parsed.port || "5432",
    PGUSER: decodeURIComponent(parsed.username),
    PGPASSWORD: decodeURIComponent(parsed.password),
    PGDATABASE: decodeURIComponent(parsed.pathname.replace(/^\//, "")),
    ...(parsed.searchParams.get("sslmode") ? { PGSSLMODE: parsed.searchParams.get("sslmode")! } : {})
  };
}

function runCommand(command: string, args: string[], environment: NodeJS.ProcessEnv, timeoutMs: number) {
  return new Promise<void>((resolvePromise, reject) => {
    const child = spawn(command, args, { env: environment, shell: false, windowsHide: true, stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    const timeout = setTimeout(() => child.kill("SIGKILL"), timeoutMs);
    child.stderr.on("data", (chunk: Buffer) => { if (stderr.length < 8_000) stderr += chunk.toString("utf8"); });
    child.on("error", (error) => { clearTimeout(timeout); reject(error); });
    child.on("exit", (code) => {
      clearTimeout(timeout);
      if (code === 0) resolvePromise();
      else reject(new Error(`PROCESS_FAILED_${code ?? "SIGNAL"}:${stderr.replace(/password=[^\s]+/gi, "password=[REDACTED]").slice(0, 500)}`));
    });
  });
}

async function startMaintenanceServer(config: ConfigService) {
  const port = Number(config.get("API_PORT") || 4000);
  const host = config.get<string>("API_HOST")?.trim() || "0.0.0.0";
  const origins = new Set([config.get<string>("WEB_ORIGIN")?.trim(), config.get<string>("NEXT_PUBLIC_SITE_URL")?.trim()].filter(Boolean));
  const server = createServer(async (request, response) => {
    const origin = request.headers.origin;
    if (origin && origins.has(origin)) { response.setHeader("Access-Control-Allow-Origin", origin); response.setHeader("Access-Control-Allow-Credentials", "true"); }
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    if (request.method === "GET" && request.url === "/api/system/status") {
      response.end(JSON.stringify(await readSystemStatus()));
      return;
    }
    const match = request.method === "GET" ? /^\/api\/system\/restores\/([0-9a-f-]{36})$/i.exec(request.url ?? "") : null;
    const token = request.headers.authorization?.match(/^Bearer ([A-Za-z0-9_-]{43})$/)?.[1];
    if (match?.[1] && token && await verifyRestoreMonitorToken(match[1], token)) {
      const value = await readRestoreProgress(match[1]);
      response.statusCode = value ? 200 : 404;
      response.end(JSON.stringify(value ?? { message: "Restore status was not found" }));
      return;
    }
    response.statusCode = 503;
    response.setHeader("Retry-After", "30");
    response.end(JSON.stringify({ statusCode: 503, code: "MAINTENANCE", message: "Backup restoration is in progress" }));
  });
  await new Promise<void>((resolvePromise, reject) => { server.once("error", reject); server.listen(port, host, resolvePromise); });
  return server;
}

function closeServer(server: Server) {
  return new Promise<void>((resolvePromise) => server.close(() => resolvePromise()));
}

function cryptoRandomId() {
  return globalThis.crypto.randomUUID();
}
