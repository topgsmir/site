import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const branch = capture("git", ["branch", "--show-current"]);
if (!branch) fail("the worktree is on a detached HEAD");
if (branch === "main") fail("worktree:sync is for feature branches, not main");

const status = capture("git", ["status", "--porcelain=v1", "--untracked-files=normal"]);
if (status) fail("commit or stash worktree changes before syncing");

run("git", ["fetch", "--prune", "origin", "main"]);
run("git", ["merge", "--no-edit", "origin/main"]);
run(process.execPath, [resolve(root, "scripts/worktree-bootstrap.mjs")]);

console.log(`${branch} is synced with origin/main and bootstrapped.`);

function capture(command, args) {
  const result = spawnSync(command, args, { cwd: root, encoding: "utf8", shell: false });
  if (result.error) fail(result.error.message);
  if (result.status !== 0) fail((result.stderr || result.stdout).trim());
  return result.stdout.trim();
}

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: "inherit", shell: false });
  if (result.error) fail(result.error.message);
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function fail(message) {
  console.error(`Worktree sync failed: ${message}`);
  process.exit(1);
}
