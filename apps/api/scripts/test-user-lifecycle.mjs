import { config } from "dotenv";
import { Client } from "pg";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pnpmInvocation } from "../../../scripts/pnpm-invocation.mjs";

const api = resolve(dirname(fileURLToPath(import.meta.url)), "..");
config({ path: [resolve(api, "../../.env"), resolve(api, "../../.env.local")], quiet: true });
const source = new URL(process.env.DATABASE_URL);
if (!["localhost", "127.0.0.1", "[::1]"].includes(source.hostname)) throw new Error("Lifecycle tests require local PostgreSQL");
const name = `topgsm_lifecycle_test_${randomUUID().replaceAll("-", "")}`;
const administration = new URL(source); administration.pathname = "/postgres";
const database = new URL(source); database.pathname = `/${name}`; database.search = "";
const client = new Client({ connectionString: administration.toString(), connectionTimeoutMillis: 5000 });
const environment = { ...process.env, DATABASE_URL: database.toString(), NODE_ENV: "test", DISABLE_BACKGROUND_WORKERS: "true" };
const pm = pnpmInvocation();
function run(args) {
  const quiet = args.includes("migrate");
  const result = spawnSync(pm.command, [...pm.args, ...args], { cwd: api, env: environment, stdio: quiet ? "pipe" : "inherit", encoding: "utf8", shell: pm.shell, windowsHide: true });
  if (quiet) console.log(result.status === 0 ? "All migrations applied to disposable database." : result.stderr + result.stdout);
  if (result.status !== 0) throw new Error(`Lifecycle check failed: ${args.join(" ")}`);
}
await client.connect(); let created = false;
try {
  await client.query(`CREATE DATABASE "${name}"`); created = true;
  console.log(`Created disposable lifecycle database ${name}`);
  run(["exec", "prisma", "migrate", "deploy"]);
  run(["exec", "tsc", "-p", "scripts/lifecycle-tsconfig.json"]);
  run(["exec", "node", "--test", "--test-concurrency=1", "tmp/lifecycle-dist/modules/admin-users/user-lifecycle.integration.spec.js"]);
} finally {
  if (created) { await client.query(`DROP DATABASE "${name}" WITH (FORCE)`); console.log("Removed disposable lifecycle database"); }
  await client.end();
}
