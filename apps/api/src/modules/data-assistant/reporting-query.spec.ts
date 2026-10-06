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

for (const [name, sql] of [
  ["comma-separated private table", "SELECT * FROM ai_reporting.daily_sales, public.users"],
  ["unqualified comma-separated private table", "SELECT * FROM ai_reporting.daily_sales, users"],
  ["comma-separated system catalog", "SELECT * FROM ai_reporting.daily_sales, pg_catalog.pg_authid"],
  ["explicit private join", "SELECT * FROM ai_reporting.daily_sales JOIN public.users ON true"],
  ["private derived table", "SELECT * FROM ai_reporting.daily_sales, (SELECT * FROM public.users) AS status"],
  ["private scalar subquery", "SELECT (SELECT count(*) FROM public.users) FROM ai_reporting.daily_sales"],
  ["private subquery in join condition", "SELECT * FROM ai_reporting.daily_sales AS a JOIN ai_reporting.order_summary AS b ON (SELECT count(*) FROM public.users) > 0"],
  ["CTE text inside a string", "SELECT 'with users as (' AS title FROM ai_reporting.daily_sales JOIN users ON true"],
  ["reporting reference inside a string", "SELECT 'from ai_reporting.daily_sales' AS title"],
  ["CTE self-name falling through to a base table", "WITH users AS (SELECT * FROM users), totals AS (SELECT * FROM ai_reporting.daily_sales) SELECT * FROM users"],
  ["CTE forward reference", "WITH totals AS (SELECT * FROM users), users AS (SELECT * FROM ai_reporting.daily_sales) SELECT * FROM totals"],
  ["CTE name leaking out of a derived table", "SELECT * FROM (WITH users AS (SELECT * FROM ai_reporting.daily_sales) SELECT * FROM users) AS totals JOIN users ON true"],
  ["CTE name leaking across union branches", "SELECT * FROM (WITH users AS (SELECT * FROM ai_reporting.daily_sales) SELECT * FROM users) AS totals UNION ALL SELECT * FROM users"],
  ["CTE name spoofing a schema-qualified base table", "WITH users AS (SELECT * FROM ai_reporting.daily_sales) SELECT * FROM public.users"],
  ["quoted CTE case mismatch", 'WITH "Users" AS (SELECT * FROM ai_reporting.daily_sales) SELECT * FROM users'],
  ["quoted schema case mismatch", 'SELECT * FROM "AI_REPORTING".daily_sales'],
  ["quoted view case mismatch", 'SELECT * FROM ai_reporting."DAILY_SALES"'],
  ["private table in a shadowing CTE", "WITH totals AS (SELECT * FROM ai_reporting.daily_sales) SELECT * FROM (WITH totals AS (SELECT * FROM public.users) SELECT * FROM totals) AS status"],
  ["private right union branch", "SELECT * FROM ai_reporting.daily_sales UNION ALL SELECT * FROM public.users"],
  ["private left union branch", "SELECT * FROM public.users UNION SELECT * FROM ai_reporting.daily_sales"],
  ["private nested union branch", "SELECT * FROM (SELECT * FROM ai_reporting.daily_sales UNION ALL SELECT * FROM public.users) AS totals"],
  ["private window partition subquery", "SELECT count(*) OVER (PARTITION BY (SELECT count(*) FROM public.users)) FROM ai_reporting.daily_sales"],
  ["private window ordering subquery", "SELECT count(*) OVER (ORDER BY (SELECT count(*) FROM public.users)) FROM ai_reporting.daily_sales"],
  ["private DISTINCT ON subquery", "SELECT DISTINCT ON ((SELECT count(*) FROM public.users)) status FROM ai_reporting.daily_sales"],
  ["unsafe DISTINCT ON function", "SELECT DISTINCT ON (pg_read_file('/dummy')) status FROM ai_reporting.daily_sales"],
  ["table function", "SELECT * FROM ai_reporting.daily_sales, count(1)"],
  ["duplicate local CTE names", "WITH totals AS (SELECT * FROM ai_reporting.daily_sales), totals AS (SELECT * FROM ai_reporting.order_summary) SELECT * FROM totals"],
  ["recursive CTE", "WITH RECURSIVE totals(status) AS (SELECT status FROM ai_reporting.daily_sales UNION ALL SELECT status FROM totals) SELECT * FROM totals"]
]) {
  test(`rejects unauthorized AST relations: ${name}`, async (t) => {
    const queries = service();
    t.after(() => queries.onModuleDestroy());
    assert.throws(() => queries.validate(sql!), BadRequestException);
  });
}

for (const [name, sql] of [
  ["comma-separated reporting views", "SELECT * FROM ai_reporting.daily_sales, ai_reporting.order_summary"],
  ["explicit reporting join", "SELECT a.status FROM ai_reporting.daily_sales AS a JOIN ai_reporting.order_summary AS b ON a.status = b.status"],
  ["nested reporting select", "SELECT * FROM (SELECT status FROM ai_reporting.daily_sales) AS totals"],
  ["scalar reporting subquery", "SELECT (SELECT count(*) FROM ai_reporting.order_summary) FROM ai_reporting.daily_sales"],
  ["sequential CTE dependencies", "WITH totals AS (SELECT * FROM ai_reporting.daily_sales), summary AS (SELECT * FROM totals) SELECT * FROM summary"],
  ["quoted CTE identifiers", 'WITH "Totals" AS (SELECT * FROM "ai_reporting"."daily_sales") SELECT * FROM "Totals"'],
  ["a safe CTE named after a private table", "WITH users AS (SELECT * FROM ai_reporting.daily_sales) SELECT * FROM users"],
  ["nested CTE inheriting its outer scope", "WITH totals AS (SELECT * FROM ai_reporting.daily_sales) SELECT * FROM (WITH summary AS (SELECT * FROM totals) SELECT * FROM summary) AS status"],
  ["nested CTE shadowing with an outer dependency", "WITH totals AS (SELECT * FROM ai_reporting.daily_sales) SELECT * FROM (WITH totals AS (SELECT * FROM totals) SELECT * FROM totals) AS status"],
  ["union of reporting views", "SELECT status FROM ai_reporting.daily_sales UNION SELECT status FROM ai_reporting.order_summary"],
  ["union all within a CTE", "WITH totals AS (SELECT status FROM ai_reporting.daily_sales UNION ALL SELECT status FROM ai_reporting.order_summary) SELECT * FROM totals"],
  ["window expressions over reporting columns", "SELECT sum(gross_amount) OVER (PARTITION BY currency ORDER BY day) FROM ai_reporting.daily_sales"],
  ["window subquery over a reporting view", "SELECT count(*) OVER (ORDER BY (SELECT count(*) FROM ai_reporting.order_summary)) FROM ai_reporting.daily_sales"],
  ["DISTINCT ON reporting columns", "SELECT DISTINCT ON (status) status FROM ai_reporting.daily_sales ORDER BY status"],
  ["DISTINCT ON reporting subquery", "SELECT DISTINCT ON ((SELECT count(*) FROM ai_reporting.order_summary)) status FROM ai_reporting.daily_sales"]
]) {
  test(`accepts authorized AST relations: ${name}`, async (t) => {
    const queries = service();
    t.after(() => queries.onModuleDestroy());
    assert.equal(queries.validate(sql!), sql);
  });
}
