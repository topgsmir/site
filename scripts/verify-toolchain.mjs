import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
const expectedPnpm = manifest.packageManager?.match(/^pnpm@(.+)$/)?.[1];
const expectedNode = manifest.engines?.node;

if (!expectedPnpm || !/^\d+\.\d+\.\d+$/.test(expectedNode)) {
  fail("package.json must declare packageManager and engines.node");
}

if (process.versions.node !== expectedNode) {
  fail(`Node ${expectedNode} is required; found ${process.version}`);
}

const pnpmVersion = currentPnpmVersion();
if (pnpmVersion !== expectedPnpm) {
  fail(`pnpm ${expectedPnpm} is required; found ${pnpmVersion || "no pnpm executable"}`);
}

console.log(`Toolchain OK: Node ${process.versions.node}, pnpm ${pnpmVersion}`);

function currentPnpmVersion() {
  const userAgentVersion = process.env.npm_config_user_agent?.match(/^pnpm\/([^\s]+)/)?.[1];
  if (userAgentVersion) return userAgentVersion;

  const command = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
  const result = spawnSync(command, ["--version"], {
    cwd: root,
    encoding: "utf8",
    shell: process.platform === "win32"
  });
  return result.status === 0 ? result.stdout.trim() : undefined;
}

function fail(message) {
  console.error(`Toolchain check failed: ${message}`);
  console.error(`Remediation: activate Node ${expectedNode ?? "24.20.0"}, then run corepack enable && corepack install --global pnpm@${expectedPnpm ?? "12.3.4"}`);
  process.exit(1);
}
