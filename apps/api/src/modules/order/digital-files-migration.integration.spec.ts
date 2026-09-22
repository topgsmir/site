import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { it } from "node:test";
import { Client } from "pg";
import { assertDedicatedTestDatabase } from "../../test/test-database";

assertDedicatedTestDatabase();
it("migrates legacy URLs and counters without losing existing purchases", async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  const schema = `digital_migration_test_${randomUUID().replaceAll("-", "")}`;
  await client.connect();
  try {
    await client.query(`CREATE SCHEMA ${schema}; SET search_path TO ${schema};
      CREATE TABLE seller_offer_digital (file_reference TEXT NOT NULL);
      CREATE TABLE order_items (product_type TEXT, digital_delivery_url TEXT);
      CREATE TABLE digital_entitlements (order_item_id TEXT UNIQUE, download_count INTEGER);
      CREATE FUNCTION deferred_fulfillment_check() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END $$;
      CREATE CONSTRAINT TRIGGER seller_offer_digital_fulfillment_check
        AFTER INSERT OR UPDATE ON seller_offer_digital DEFERRABLE INITIALLY DEFERRED
        FOR EACH ROW EXECUTE FUNCTION deferred_fulfillment_check();
      CREATE CONSTRAINT TRIGGER order_items_snapshot_check
        AFTER INSERT OR UPDATE ON order_items DEFERRABLE INITIALLY DEFERRED
        FOR EACH ROW EXECUTE FUNCTION deferred_fulfillment_check();
      INSERT INTO seller_offer_digital VALUES ('https://uploads.example/legacy.zip'), ('old-draft-reference');
      INSERT INTO order_items VALUES ('digital', 'https://uploads.example/legacy.zip'), ('physical', NULL);
      INSERT INTO digital_entitlements VALUES ('existing-item', 3);`);
    await client.query(readFileSync("src/prisma/schema/migrations/20260922150000_multiple_digital_files/migration.sql", "utf8"));
    assert.deepEqual((await client.query("SELECT file_references FROM seller_offer_digital WHERE file_reference LIKE 'https:%'")).rows[0].file_references, ["https://uploads.example/legacy.zip"]);
    assert.deepEqual((await client.query("SELECT file_references FROM seller_offer_digital WHERE file_reference = 'old-draft-reference'")).rows[0].file_references, []);
    assert.deepEqual((await client.query("SELECT digital_delivery_urls FROM order_items WHERE product_type = 'digital'")).rows[0].digital_delivery_urls, ["https://uploads.example/legacy.zip"]);
    assert.deepEqual((await client.query("SELECT file_index, download_count FROM digital_entitlements")).rows[0], { file_index: 0, download_count: 3 });
    await client.query("INSERT INTO digital_entitlements VALUES ('existing-item', 0, 1)");
    await assert.rejects(client.query("INSERT INTO digital_entitlements VALUES ('existing-item', 0, 1)"), /unique/);
    await assert.rejects(client.query("INSERT INTO digital_entitlements VALUES ('existing-item', 0, 50)"), /check constraint/);
    for (const urls of [["http://uploads.example/a"], [null], Array(51).fill("https://uploads.example/a")]) {
      await assert.rejects(client.query("UPDATE seller_offer_digital SET file_references = $1", [urls]), /check constraint/);
    }
  } finally {
    await client.query("ROLLBACK");
    await client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await client.end();
  }
});
