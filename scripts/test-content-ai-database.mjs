// Creates and removes a dedicated local test database. Never migrates the app database.
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const api = resolve(root, "apps/api");
const require = createRequire(resolve(api, "package.json"));
require("dotenv").config({ path: [resolve(root, ".env"), resolve(root, ".env.local")], quiet: true });
const { Client } = require("pg");
const url = new URL(process.env.DATABASE_URL);
if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) throw new Error("This test runner requires a local PostgreSQL server");
const database = `topgsm_content_ai_test_${randomUUID().replaceAll("-", "")}`;
const admin = new Client({ connectionString: url.toString(), connectionTimeoutMillis: 5000 });
await admin.connect();
let created = false;
try {
  await admin.query(`CREATE DATABASE "${database}"`); created = true;
  url.pathname = `/${database}`;
  const env = { ...process.env, DATABASE_URL: url.toString(), NODE_ENV: "test" };
  const prisma = resolve(dirname(require.resolve("prisma/package.json")), "build/index.js");
  execFileSync(process.execPath, [prisma, "migrate", "deploy"], { cwd: api, env, stdio: "pipe" });
  console.log("All migrations applied to a disposable database.");
  execFileSync(process.execPath, ["--test", "dist/modules/content-ai/content-ai.integration.spec.js"], { cwd: api, env, stdio: "inherit" });
} finally {
  if (created) await admin.query(`DROP DATABASE "${database}" WITH (FORCE)`);
  await admin.end();
}
