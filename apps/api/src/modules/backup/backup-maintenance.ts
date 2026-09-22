import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import type { BackupRestoreProgress, PublicSystemStatus } from "@topgsm/shared-types";

export type PendingRestore = {
  version: 1;
  id: string;
  actorUserId: string;
  challengeId: string;
  archivePath: string;
  archiveId: string;
  monitorTokenHash: string;
  requestedAt: string;
};

const root = () => {
  const configured = process.env.BACKUP_ROOT?.trim() || "var/backups";
  return isAbsolute(configured) ? resolve(configured) : resolve(process.cwd(), configured);
};

const stateDir = () => resolve(root(), "state");
const maintenancePath = () => resolve(stateDir(), "maintenance.json");
const pendingPath = () => resolve(stateDir(), "pending-restore.json");
const progressPath = (id: string) => resolve(stateDir(), `restore-${id}.json`);
const monitorPath = (id: string) => resolve(stateDir(), `restore-${id}.token`);

async function atomicJson(path: string, value: unknown) {
  await mkdir(stateDir(), { recursive: true });
  const temporary = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporary, JSON.stringify(value), { flag: "wx", mode: 0o600 });
  await rename(temporary, path);
}

async function readJson<T>(path: string): Promise<T | null> {
  try { return JSON.parse(await readFile(path, "utf8")) as T; }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export async function readSystemStatus(): Promise<PublicSystemStatus> {
  const value = await readJson<{ restoreId: string; updatedAt: string }>(maintenancePath());
  return value
    ? { maintenance: true, reason: "restore", restoreId: value.restoreId, updatedAt: value.updatedAt }
    : { maintenance: false, reason: null, restoreId: null, updatedAt: null };
}

export async function writePendingRestore(value: PendingRestore) {
  const updatedAt = new Date().toISOString();
  await atomicJson(progressPath(value.id), {
    id: value.id, status: "pending_restart", phase: "validating", message: "Restore is waiting for the maintenance restart.", updatedAt
  } satisfies BackupRestoreProgress);
  await atomicJson(pendingPath(), value);
  await writeFile(monitorPath(value.id), value.monitorTokenHash, { flag: "wx", mode: 0o600 });
  await atomicJson(maintenancePath(), { restoreId: value.id, updatedAt });
}

export const readPendingRestore = () => readJson<PendingRestore>(pendingPath());
export const readRestoreProgress = (id: string) => /^[0-9a-f-]{36}$/i.test(id) ? readJson<BackupRestoreProgress>(progressPath(id)) : Promise.resolve(null);
export const writeRestoreProgress = (value: BackupRestoreProgress) => atomicJson(progressPath(value.id), value);

export async function verifyRestoreMonitorToken(id: string, token: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id) || !/^[A-Za-z0-9_-]{43}$/.test(token)) return false;
  const expected = await readFile(monitorPath(id), "utf8").catch(() => "");
  const actual = hashMonitorToken(token);
  return expected.length === actual.length && timingSafeEqual(Buffer.from(expected), Buffer.from(actual));
}

export async function clearPendingRestore() {
  await Promise.all([rm(pendingPath(), { force: true }), rm(maintenancePath(), { force: true })]);
}

export function hashMonitorToken(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
