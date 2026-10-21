import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pnpmInvocation } from "./pnpm-invocation.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const apiRoot = resolve(root, "apps/api");
const migrationsDir = resolve(apiRoot, "src/prisma/schema/migrations");
const migrationsStampPath = resolve(apiRoot, "src/generated/prisma/.migrations.sha256");
const forcePrepare =
  process.argv.includes("--prepare") || process.env.TOPGSM_DEV_PREPARE === "1";
const pnpm = pnpmInvocation();

function log(message) {
  console.log(`[api-dev] ${message}`);
}

function migrationsHash() {
  const names = readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  return createHash("sha256").update(`${names.join("\n")}\n`).digest("hex");
}

function run(label, args, options = {}) {
  log(label);
  return new Promise((resolvePromise, reject) => {
    const child = spawn(pnpm.command, [...pnpm.args, ...args], {
      cwd: options.cwd ?? root,
      env: {
        ...process.env,
        ...(options.env ?? {})
      },
      stdio: "inherit",
      shell: pnpm.shell
    });
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (signal) {
        reject(new Error(`${label} terminated by ${signal}`));
        return;
      }
      if (code !== 0) {
        reject(new Error(`${label} exited with code ${code ?? 1}`));
        return;
      }
      resolvePromise();
    });
  });
}

function withConnectTimeout(databaseUrl) {
  if (!databaseUrl || /[?&]connect_timeout=/.test(databaseUrl)) return databaseUrl;
  return `${databaseUrl}${databaseUrl.includes("?") ? "&" : "?"}connect_timeout=5`;
}

async function main() {
  await run("Ensuring Prisma client", [
    "--filter",
    "topgsm-api",
    "run",
    "prisma:generate"
  ]);

  const nextMigrationsHash = migrationsHash();
  const previousMigrationsHash = existsSync(migrationsStampPath)
    ? readFileSync(migrationsStampPath, "utf8").trim()
    : "";
  const needsDbPrepare = forcePrepare || previousMigrationsHash !== nextMigrationsHash;

  if (needsDbPrepare) {
    const databaseUrl = withConnectTimeout(process.env.DATABASE_URL);
    await run("Applying database migrations", ["--filter", "topgsm-api", "run", "prisma:migrate"], {
      env: databaseUrl ? { DATABASE_URL: databaseUrl } : undefined
    });
    await run("Seeding development data", ["--filter", "topgsm-api", "run", "prisma:seed:dev"], {
      env: databaseUrl ? { DATABASE_URL: databaseUrl } : undefined
    });
    writeFileSync(migrationsStampPath, `${nextMigrationsHash}\n`, "utf8");
  } else {
    log("Migrations unchanged; skipping migrate/seed (pass --prepare or TOPGSM_DEV_PREPARE=1 to force).");
  }

  log("Starting Nest in watch mode");
  await run(
    "nest start --watch",
    ["--filter", "topgsm-api", "exec", "nest", "start", "--watch", "--preserveWatchOutput"],
    { cwd: apiRoot }
  );
}

main().catch((error) => {
  console.error(`[api-dev] ${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
