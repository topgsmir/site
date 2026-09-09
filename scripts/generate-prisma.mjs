import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const schemaPath = resolve(root, "apps/api/src/prisma/schema/schema.prisma");
const stampPath = resolve(root, "apps/api/src/generated/prisma/.schema.sha256");

const result = spawnSync(
  process.execPath,
  [
    resolve(root, "scripts/run-pnpm.mjs"),
    "--filter",
    "topgsm-api",
    "exec",
    "prisma",
    "generate",
    "--config",
    "prisma.config.ts"
  ],
  { cwd: root, env: process.env, stdio: "inherit" }
);

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
if (result.status !== 0) process.exit(result.status ?? 1);

writeFileSync(stampPath, `${normalizedSha256(schemaPath)}\n`, "utf8");

function normalizedSha256(path) {
  const normalized = readFileSync(path, "utf8").replace(/\r\n/g, "\n").trim();
  return createHash("sha256").update(normalized).digest("hex");
}
