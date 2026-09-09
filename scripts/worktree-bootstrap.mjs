import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pnpmInvocation } from "./pnpm-invocation.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const lockfile = resolve(root, "pnpm-lock.yaml");

run(process.execPath, [resolve(root, "scripts/verify-toolchain.mjs")]);

const lockfileBefore = sha256(lockfile);
const pnpm = pnpmInvocation();
run(pnpm.command, [
  ...pnpm.args,
  "install",
  "--frozen-lockfile"
], { CI: "true" }, pnpm.shell);

if (sha256(lockfile) !== lockfileBefore) {
  fail("pnpm-lock.yaml changed during a frozen install");
}

run(process.execPath, [resolve(root, "scripts/worktree-doctor.mjs")], {
  TOPGSM_BOOTSTRAP_LOCKFILE_SHA256: lockfileBefore
});

console.log("Worktree bootstrap complete.");

function run(command, args, extraEnvironment = {}, shell = false) {
  const result = spawnSync(command, args, {
    cwd: root,
    env: { ...process.env, ...extraEnvironment },
    stdio: "inherit",
    shell
  });
  if (result.error) fail(result.error.message);
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function fail(message) {
  console.error(`Bootstrap failed: ${message}`);
  process.exit(1);
}
