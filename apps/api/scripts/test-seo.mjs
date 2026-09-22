import { config } from "dotenv";
import { Client } from "pg";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pnpmInvocation } from "../../../scripts/pnpm-invocation.mjs";

const api = resolve(dirname(fileURLToPath(import.meta.url)), "..");
config({ path: [resolve(api, "../../.env"), resolve(api, "../../.env.local")], quiet: true });
const source = new URL(process.env.DATABASE_URL);
if (!["localhost", "127.0.0.1", "[::1]"].includes(source.hostname)) throw new Error("SEO tests require a local PostgreSQL server");
const name = `topgsm_seo_test_${randomUUID().replaceAll("-", "")}`;
const administration = new URL(source); administration.pathname = "/postgres";
const test = new URL(source); test.pathname = `/${name}`; test.search = "";
const client = new Client({ connectionString: administration.toString(), connectionTimeoutMillis: 5000 });
const environment = { ...process.env, DATABASE_URL: test.toString(), NODE_ENV: "test" };
const pm = pnpmInvocation();
function run(args) {
  const result = spawnSync(pm.command, [...pm.args, ...args], { cwd: api, env: environment, stdio: "inherit", shell: pm.shell, windowsHide: true });
  if (result.status !== 0) throw new Error(`SEO check failed: ${args.join(" ")}`);
}
const work = resolve(api, "tmp/seo");
mkdirSync(work, { recursive: true });
writeFileSync(resolve(work, "tsconfig.json"), JSON.stringify({
  extends: "../../tsconfig.json", compilerOptions: { outDir: "../seo-dist", incremental: false },
  include: ["../../src/modules/product/seo.integration.spec.ts", "../../src/modules/product/product.service.spec.ts", "../../src/modules/blog/blog.service.spec.ts"],
  exclude: ["../../node_modules", "../../dist"]
}, null, 2));
await client.connect();
let created = false;
try {
  await client.query(`CREATE DATABASE "${name}"`); created = true;
  console.log(`Created disposable SEO test database ${name}`);
  run(["exec", "prisma", "migrate", "deploy"]);
  run(["exec", "tsc", "-p", "tmp/seo/tsconfig.json"]);
  run(["exec", "node", "--test", "--test-concurrency=1", "tmp/seo-dist/modules/product/seo.integration.spec.js", "tmp/seo-dist/modules/product/product.service.spec.js", "tmp/seo-dist/modules/blog/blog.service.spec.js"]);
} finally {
  if (created) {
    await client.query(`DROP DATABASE "${name}" WITH (FORCE)`);
    console.log("Removed disposable SEO test database");
  }
  await client.end();
}
