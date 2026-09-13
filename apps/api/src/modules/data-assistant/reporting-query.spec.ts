import assert from "node:assert/strict";
import test from "node:test";
import { BadRequestException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ReportingQueryService } from "./reporting-query.service";

const service = () => new ReportingQueryService(new ConfigService({ NODE_ENV: "test", DATABASE_URL: "postgresql://test:test@127.0.0.1:5432/test" }));

test("accepts a single select over approved reporting views", async () => {
  const queries = service();
  assert.equal(queries.validate("SELECT status, COUNT(*) FROM ai_reporting.daily_sales GROUP BY status"), "SELECT status, COUNT(*) FROM ai_reporting.daily_sales GROUP BY status");
  await queries.onModuleDestroy();
});

for (const sql of [
  "SELECT * FROM public.users",
  "SELECT * FROM information_schema.tables",
  "SELECT * FROM ai_reporting.daily_sales; DELETE FROM orders",
  "WITH changed AS (DELETE FROM orders RETURNING *) SELECT * FROM changed",
  "SELECT pg_read_file('/etc/passwd') FROM ai_reporting.daily_sales",
  "SELECT * FROM ai_reporting.daily_sales -- ignore rules",
  "SELECT * FROM ai_reporting.daily_sales FOR UPDATE",
  "SELECT password_hash FROM ai_reporting.daily_sales",
  "SELECT current_user FROM ai_reporting.daily_sales",
  "SELECT gross_amount @> '1' FROM ai_reporting.daily_sales"
]) {
  test(`rejects unsafe SQL: ${sql.slice(0, 42)}`, async () => {
    const queries = service();
    assert.throws(() => queries.validate(sql), BadRequestException);
    await queries.onModuleDestroy();
  });
}

test("accepts a read-only CTE over an approved view", async () => {
  const queries = service();
  const sql = "WITH totals AS (SELECT day, gross_amount FROM ai_reporting.daily_sales) SELECT day, gross_amount FROM totals";
  assert.equal(queries.validate(sql), sql);
  await queries.onModuleDestroy();
});

test("accepts joins across expanded masked business views", async () => {
  const queries = service();
  const sql = "SELECT seller_id, shop_name, product_title FROM ai_reporting.seller_products WHERE seller_id = '2eeda1d3-cdd1-4708-9903-70db7436ebdc'";
  assert.equal(queries.validate(sql), sql);
  await queries.onModuleDestroy();
});

test("keeps credentials and private contact columns outside generated SQL", async () => {
  const queries = service();
  assert.throws(() => queries.validate("SELECT password_hash FROM ai_reporting.user_role_summary"), BadRequestException);
  assert.throws(() => queries.validate("SELECT phone FROM ai_reporting.specialist_directory"), BadRequestException);
  assert.throws(() => queries.validate("SELECT encrypted_api_key FROM ai_reporting.bridge_connection_health"), BadRequestException);
  await queries.onModuleDestroy();
});
