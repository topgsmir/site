// Run against a disposable local database; never mutate the development users.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const api = resolve(root, "apps/api");
const require = createRequire(resolve(api, "package.json"));
require("dotenv").config({ path: [resolve(root, ".env"), resolve(root, ".env.local")], quiet: true });
const { Client, Pool } = require("pg");
const url = new URL(process.env.DATABASE_URL);
if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) throw new Error("Requires local PostgreSQL");
const database = `topgsm_support_codes_test_${randomUUID().replaceAll("-", "")}`;
const admin = new Client({ connectionString: url.toString(), connectionTimeoutMillis: 5000 });
await admin.connect();
let created = false;
let pool;
try {
  await admin.query(`CREATE DATABASE "${database}"`);
  created = true;
  url.pathname = `/${database}`;
  const env = { ...process.env, DATABASE_URL: url.toString(), NODE_ENV: "test" };
  const prisma = resolve(dirname(require.resolve("prisma/package.json")), "build/index.js");
  execFileSync(process.execPath, [prisma, "migrate", "deploy"], { cwd: api, env, stdio: "pipe" });
  pool = new Pool({ connectionString: url.toString(), max: 8, connectionTimeoutMillis: 5000 });
  const users = await Promise.all(Array.from({ length: 50 }, (_, index) => pool.query(
    "INSERT INTO users (id, full_name, email, role, updated_at) VALUES ($1, 'Support code test', $2, 'buyer', now()) RETURNING support_code",
    [randomUUID(), `support-${index}@example.test`]
  )));
  const codes = users.map(result => result.rows[0].support_code);
  assert.equal(new Set(codes).size, 50);
  for (const code of codes) assert.match(code, /^[0-9]{5}$/);
  console.log("Full migrations and 50 concurrent user creations passed.");

  const client = await pool.connect();
  try {
    // Exercise the actual old-to-new migration on populated legacy data,
    // including a numeric old code that must not be reassigned to another user.
    await client.query("CREATE SCHEMA legacy; SET search_path TO legacy");
    await client.query("CREATE TABLE users (id TEXT PRIMARY KEY)");
    const migrations = resolve(api, "src/prisma/schema/migrations");
    await client.query(readFileSync(resolve(migrations, "20260928120000_user_support_codes/migration.sql"), "utf8"));
    await client.query("INSERT INTO users (id, support_code) VALUES ('alpha', '7K4P9'), ('numeric', '23456')");
    await client.query("INSERT INTO user_support_code_reservations (code) VALUES ('7K4P9'), ('23456')");
    await client.query(readFileSync(resolve(migrations, "20261007120000_numeric_user_support_codes/migration.sql"), "utf8"));
    const migrated = await client.query("SELECT support_code FROM users");
    assert.equal(new Set(migrated.rows.map(row => row.support_code)).size, 2);
    for (const { support_code: code } of migrated.rows) {
      assert.match(code, /^[0-9]{5}$/);
      assert.notEqual(code, "23456");
    }
    for (const invalid of ["7K4P9", "1234", "123456", "12.34", "۱۲۳۴۵"]) {
      await assert.rejects(client.query("UPDATE users SET support_code = $1 WHERE id = 'alpha'", [invalid]), { code: "23514" });
      await assert.rejects(client.query("INSERT INTO user_support_code_reservations (code) VALUES ($1)", [invalid]), { code: "23514" });
    }
    await assert.rejects(client.query("UPDATE users SET support_code = (SELECT support_code FROM users WHERE id = 'numeric') WHERE id = 'alpha'"), { code: "23505" });
    const deletedCode = migrated.rows[0].support_code;
    await client.query("DELETE FROM users WHERE support_code = $1", [deletedCode]);
    assert.equal((await client.query("SELECT code FROM user_support_code_reservations WHERE code = $1", [deletedCode])).rowCount, 1);

    // Force random collisions with just one available code, then exhaust the pool.
    await client.query("INSERT INTO user_support_code_reservations (code) SELECT lpad(value::text, 5, '0') FROM generate_series(0, 99999) value ON CONFLICT DO NOTHING");
    await client.query("DELETE FROM user_support_code_reservations WHERE code = '00001'");
    assert.equal((await client.query("SELECT allocate_user_support_code() AS code")).rows[0].code, "00001");
    await assert.rejects(client.query("SELECT allocate_user_support_code()"), /capacity exhausted/);
    console.log("Legacy backfill, numeric constraints, uniqueness, non-reuse, near-capacity allocation and exhaustion passed.");
  } finally {
    client.release();
  }
} finally {
  if (pool) await pool.end();
  if (created) await admin.query(`DROP DATABASE "${database}" WITH (FORCE)`);
  await admin.end();
}
