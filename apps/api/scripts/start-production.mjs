import { access } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { config as loadEnvironment } from "dotenv";

const apiRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = resolve(apiRoot, "../..");
loadEnvironment({
  path: [resolve(repositoryRoot, ".env"), resolve(repositoryRoot, ".env.local"), resolve(apiRoot, ".env"), resolve(apiRoot, ".env.local")],
  quiet: true
});
const configuredBackupRoot = process.env.BACKUP_ROOT?.trim() || "var/backups";
const backupRoot = isAbsolute(configuredBackupRoot) ? configuredBackupRoot : resolve(apiRoot, configuredBackupRoot);
const pendingRestore = resolve(backupRoot, "state", "pending-restore.json");

if (!await exists(pendingRestore)) {
  await run(process.platform === "win32" ? "pnpm.cmd" : "pnpm", ["run", "prisma:migrate"]);
}

await run(process.execPath, [resolve(apiRoot, "dist", "main.js")], true);

async function exists(path) {
  try { await access(path, constants.F_OK); return true; }
  catch { return false; }
}

function run(command, args, forwardSignals = false) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { cwd: apiRoot, env: process.env, shell: false, stdio: "inherit", windowsHide: true });
    const forward = (signal) => { if (!child.killed) child.kill(signal); };
    if (forwardSignals) {
      process.once("SIGTERM", forward);
      process.once("SIGINT", forward);
    }
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (forwardSignals) {
        process.removeListener("SIGTERM", forward);
        process.removeListener("SIGINT", forward);
      }
      if (code === 0) resolvePromise();
      else reject(new Error(`${command} exited with ${code ?? signal ?? "unknown status"}`));
    });
  });
}
