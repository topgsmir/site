import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const [branch, requestedPath] = process.argv.slice(2);

if (!branch) {
  fail("usage: pnpm worktree:create -- <branch> [path]");
}

run("git", ["check-ref-format", "--branch", branch]);
const destination = requestedPath
  ? resolve(root, requestedPath)
  : resolve(root, "..", `${basename(root)}-${branch.replace(/[^A-Za-z0-9._-]+/g, "-")}`);

if (existsSync(destination)) fail(`destination already exists: ${destination}`);

run("git", ["fetch", "--prune", "origin", "main"]);
run("git", ["worktree", "add", "-b", branch, destination, "origin/main"]);

const bootstrap = spawnSync(process.execPath, [resolve(destination, "scripts/worktree-bootstrap.mjs")], {
  cwd: destination,
  env: process.env,
  stdio: "inherit",
  shell: false
});
if (bootstrap.error) fail(bootstrap.error.message);
if (bootstrap.status !== 0) {
  fail(`worktree was created at ${destination}, but bootstrap failed`);
}

console.log(`Worktree ready: ${destination}`);

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: "inherit", shell: false });
  if (result.error) fail(result.error.message);
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function fail(message) {
  console.error(`Worktree creation failed: ${message}`);
  process.exit(1);
}
