// Upgrade a disposable local database, preserving representative legacy data.
import assert from "node:assert/strict";
import { config } from "dotenv";
import { Client } from "pg";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, readdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const api=resolve(dirname(fileURLToPath(import.meta.url)),"..");
config({path:[resolve(api,"../../.env"),resolve(api,"../../.env.local")],quiet:true});
const url=new URL(process.env.DATABASE_URL);
if (!["localhost","127.0.0.1","[::1]"].includes(url.hostname)) throw new Error("Catalog tests require local PostgreSQL");
const database=`topgsm_catalog_test_${randomUUID().replaceAll("-","")}`;
const administration=new URL(url); administration.pathname="/postgres";
const admin=new Client({connectionString:administration.toString(),connectionTimeoutMillis:5000});
url.pathname=`/${database}`;
const environment={...process.env,DATABASE_URL:url.toString(),NODE_ENV:"test"};
const require=createRequire(import.meta.url);
const prisma=resolve(dirname(require.resolve("prisma/package.json")),"build/index.js");
const temporary=resolve(api,"tmp",database);
const migrations=resolve(api,"src/prisma/schema/migrations");
mkdirSync(resolve(temporary,"migrations"),{recursive:true});
for(const entry of readdirSync(migrations)) if(entry<"20260924170000" || entry==="migration_lock.toml") cpSync(resolve(migrations,entry),resolve(temporary,"migrations",entry),{recursive:true});
writeFileSync(resolve(temporary,"prisma.config.mjs"),`import {defineConfig} from "prisma/config"; export default defineConfig({schema:${JSON.stringify(resolve(api,"src/prisma/schema/schema.prisma"))},migrations:{path:${JSON.stringify(resolve(temporary,"migrations"))}},datasource:{url:process.env.DATABASE_URL}});`);
function migrate(configuration){
  try { execFileSync(process.execPath,[prisma,"migrate","deploy",...(configuration?["--config",configuration]:[])],{cwd:api,env:environment,stdio:"pipe",windowsHide:true}); }
  catch(error){ console.error(error.stdout?.toString(),error.stderr?.toString()); throw new Error("Disposable catalog migration failed"); }
}
await admin.connect();
let created=false,client;
try {
  await admin.query(`CREATE DATABASE "${database}"`); created=true;
  migrate(resolve(temporary,"prisma.config.mjs"));
  client=new Client({connectionString:url.toString()}); await client.connect();
  const ids=Array.from({length:9},()=>randomUUID());
  const [user,seller,product,other,variant,listing,offer,option,value]=ids;
  await client.query("INSERT INTO users(id,full_name,email,role) VALUES($1,'Catalog test','catalog@example.test','seller_admin')",[user]);
  await client.query("INSERT INTO sellers(id,user_id,shop_name,approved) VALUES($1,$2,'Catalog test',true)",[seller,user]);
  await client.query("BEGIN");
  await client.query("INSERT INTO products(id,created_by_seller_id,title,slug,type,category) VALUES($1,$3,'Migration product','migration-product','physical','Repair   Tools'),($2,$3,'Second product','second-product','physical','repair tools')",[product,other,seller]);
  await client.query("INSERT INTO product_options(id,product_id,name,normalized_name,position) VALUES($1,$2,'Color','color',0)",[option,product]);
  await client.query("INSERT INTO product_option_values(id,option_id,value,normalized_value,position) VALUES($1,$2,'Black','black',0)",[value,option]);
  await client.query("INSERT INTO product_variants(id,product_id,option_signature) VALUES($1,$2,$3)",[variant,product,"a".repeat(64)]);
  await client.query("INSERT INTO product_variant_values(variant_id,option_id,option_value_id) VALUES($1,$2,$3)",[variant,option,value]);
  await client.query("INSERT INTO seller_listings(id,seller_id,product_id) VALUES($1,$2,$3)",[listing,seller,product]);
  await client.query("INSERT INTO seller_offers(id,listing_id,variant_id,price,currency) VALUES($1,$2,$3,100,'TOMAN')",[offer,listing,variant]);
  await client.query("INSERT INTO seller_offer_physical(offer_id,stock,weight_grams) VALUES($1,8,100)",[offer]);
  await client.query("INSERT INTO product_translations(product_id,locale,draft_title,draft_description,draft_category,published_title,published_description,published_category,published_at,updated_by) VALUES($1,'en','Tools','Description','Tools','Tools','Description','Tools',now(),$2)",[product,user]);
  await client.query("COMMIT");
  const grants=await client.query("SELECT c.relname,c.relacl::text FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='ai_reporting' AND c.relkind='v' ORDER BY c.relname");
  await client.query("INSERT INTO products(id,created_by_seller_id,title,slug,type) VALUES('invalid-legacy-id',$1,'Invalid legacy ID','invalid-legacy-id','physical')",[seller]);
  await assert.rejects(client.query(readFileSync(resolve(migrations,"20260924170000_catalog_native_uuids/migration.sql"),"utf8")),/UUID/i);
  await client.query("ROLLBACK");
  assert.equal((await client.query("SELECT pg_typeof(id)::text AS type FROM products LIMIT 1")).rows[0].type,"text");
  await client.query("DELETE FROM products WHERE id='invalid-legacy-id'");
  migrate();
  assert.deepEqual((await client.query("SELECT c.relname,c.relacl::text FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='ai_reporting' AND c.relkind='v' ORDER BY c.relname")).rows,grants.rows);
  const rows=await client.query("SELECT p.id,p.category_id,c.name FROM products p JOIN product_categories c ON c.id=p.category_id ORDER BY p.slug");
  assert.equal(rows.rowCount,2); assert.equal(rows.rows[0].category_id,rows.rows[1].category_id);
  assert.equal((await client.query("SELECT pg_typeof(id)::text AS type FROM products LIMIT 1")).rows[0].type,"uuid");
  assert.equal((await client.query("SELECT pg_typeof(offer_id)::text AS type,stock FROM seller_offer_physical WHERE offer_id=$1",[offer])).rows[0].stock,8);
  assert.equal((await client.query("SELECT product_id FROM product_slug_routes WHERE slug='migration-product'")).rows[0].product_id,product);
  await client.query("UPDATE seller_offer_physical SET stock=stock-1 WHERE offer_id=$1",[offer]);
  await client.query("UPDATE products SET slug='renamed-product' WHERE id=$1",[product]);
  assert.equal((await client.query("SELECT count(*)::integer AS count FROM product_slug_routes WHERE product_id=$1",[product])).rows[0].count,2);
  await assert.rejects(client.query("UPDATE seller_offers SET variant_id=$1 WHERE id=$2",[randomUUID(),offer]));
  for (const view of grants.rows) await client.query(`SELECT * FROM ai_reporting."${view.relname}" LIMIT 1`);
  console.log("PASS populated upgrade: stable identifiers, category deduplication, views/grants, slug history, fulfillment triggers and foreign keys.");
  // Isolate application suites from the legacy migration fixture.
  await client.query("DELETE FROM seller_listings WHERE seller_id=$1",[seller]);
  await client.query("DELETE FROM products WHERE created_by_seller_id=$1",[seller]);
  await client.query("DELETE FROM product_categories");
  await client.query("DELETE FROM sellers WHERE id=$1",[seller]);
  await client.query("DELETE FROM users WHERE id=$1",[user]);
  // Exercise application queries against the upgraded graph, including UUID parameters.
  execFileSync(process.execPath,["--test","--test-concurrency=1",...process.argv.slice(2),"dist/modules/product/catalog-architecture.integration.spec.js","dist/modules/product/seo.integration.spec.js","dist/modules/checkout/checkout.integration.spec.js"],{cwd:api,env:environment,stdio:"inherit",windowsHide:true});
} finally {
  if(client) await client.end();
  if(created) await admin.query(`DROP DATABASE "${database}" WITH (FORCE)`);
  await admin.end();
  // temporary is an explicitly named child of apps/api/tmp created above.
  rmSync(temporary,{recursive:true,force:true});
}
