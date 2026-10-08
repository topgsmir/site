import { createRequire } from "node:module";
import { resolve } from "node:path";
import { createHash } from "node:crypto";

const root = resolve(import.meta.dirname, "..");
const require = createRequire(resolve(root, "apps/api/package.json"));
require("dotenv").config({ path: [resolve(root, ".env"), resolve(root, ".env.local")], quiet: true });
if (!process.argv.includes("--development") || process.env.NODE_ENV === "production") {
  throw new Error("Dashboard demo seed requires --development and a non-production environment");
}
const databaseUrl = new URL(process.env.DATABASE_URL ?? "");
if (!["localhost", "127.0.0.1", "[::1]"].includes(databaseUrl.hostname)) {
  throw new Error("Dashboard demo seed only supports local PostgreSQL");
}
const { Client } = require("pg");
const database = new Client({ connectionString: databaseUrl.toString(), connectionTimeoutMillis: 5000 });
const marker = "dashboard-demo";
const names = ["رضا محمدی", "علی کریمی", "پیمان احمدی", "محمد حسینی", "سارا رضایی", "حسن مرادی", "مهدی صادقی", "امیر موسوی", "نرگس احمدی", "حسین رضایی"];
const amounts = ["2250000", "1900000", "1500000", "1100000", "800000", "600000", "500000", "400000", "300000", "200000"];
function fixtureId(label) {
  const digest = createHash("sha256").update("topgsm-dashboard-demo:" + label).digest("hex");
  return digest.slice(0, 8) + "-" + digest.slice(8, 12) + "-4" + digest.slice(13, 16) + "-a" + digest.slice(17, 20) + "-" + digest.slice(20, 32);
}
const sellerUserId = fixtureId("seller-user");
const sellerId = fixtureId("seller");
const productId = fixtureId("product");
const variantId = fixtureId("variant");
const listingId = fixtureId("listing");
const offerId = fixtureId("offer");
const timestamp = new Date();
let createdUsers = 0;
let createdOrders = 0;

async function createUser(label, fullName, role) {
  const userId = fixtureId(label);
  const email = label + "@dashboard-demo.invalid";
  const existing = await database.query("SELECT email, role FROM users WHERE id = $1", [userId]);
  if (existing.rowCount) {
    if (existing.rows[0].email !== email || existing.rows[0].role !== role) throw new Error("Fixture user identity collision");
    return userId;
  }
  await database.query(
    "INSERT INTO users (id, full_name, username, email, role, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $6)",
    [userId, fullName, "dashboard_demo_" + label.replaceAll("-", "_"), email, role, timestamp],
  );
  if (role === "buyer") createdUsers++;
  return userId;
}

await database.connect();
try {
  await database.query("BEGIN");
  await database.query("SET LOCAL statement_timeout = '10s'");
  await database.query("SELECT pg_advisory_xact_lock(hashtext('topgsm-dashboard-demo-seed'))");
  await createUser("seller-user", "فروشنده آزمایشی داشبورد", "seller_admin");
  const seller = await database.query("SELECT user_id FROM sellers WHERE id = $1", [sellerId]);
  if (seller.rowCount && seller.rows[0].user_id !== sellerUserId) throw new Error("Fixture seller identity collision");
  await database.query(
    "INSERT INTO sellers (id, user_id, shop_name, invited, approved, commission, created_at, updated_at) VALUES ($1, $2, $3, false, false, 0.1, $4, $4) ON CONFLICT (id) DO NOTHING",
    [sellerId, sellerUserId, "فروشگاه آزمایشی داشبورد", timestamp],
  );
  const product = await database.query("SELECT slug FROM products WHERE id = $1", [productId]);
  if (product.rowCount && product.rows[0].slug !== "dashboard-demo-training") throw new Error("Fixture product identity collision");
  await database.query(
    "INSERT INTO products (id, created_by_seller_id, title, slug, type, status, tags, created_at, updated_at) VALUES ($1, $2, $3, $4, 'service', 'archived', $5, $6, $6) ON CONFLICT (id) DO NOTHING",
    [productId, sellerId, "آموزش تخصصی تعمیرات موبایل — داده آزمایشی", "dashboard-demo-training", [marker], timestamp],
  );
  await database.query(
    "INSERT INTO product_variants (id, product_id, option_signature, created_at, updated_at) VALUES ($1, $2, $3, $4, $4) ON CONFLICT (id) DO NOTHING",
    [variantId, productId, createHash("sha256").update(marker).digest("hex"), timestamp],
  );
  await database.query(
    "INSERT INTO seller_listings (id, seller_id, product_id, status, created_at, updated_at) VALUES ($1, $2, $3, 'draft', $4, $4) ON CONFLICT (id) DO NOTHING",
    [listingId, sellerId, productId, timestamp],
  );
  await database.query(
    "INSERT INTO seller_offers (id, listing_id, variant_id, price, currency, status, created_at, updated_at) VALUES ($1, $2, $3, $4, 'TOMAN', 'draft', $5, $5) ON CONFLICT (id) DO NOTHING",
    [offerId, listingId, variantId, amounts[0], timestamp],
  );
  await database.query(
    "INSERT INTO seller_offer_service (offer_id, estimated_hours, service_type, instructions) VALUES ($1, 1, $2, $3) ON CONFLICT (offer_id) DO NOTHING",
    [offerId, marker, "داده آزمایشی داشبورد؛ این سرویس قابل خرید نیست."],
  );
  for (const [buyerIndex, fullName] of names.entries()) {
    const buyerId = await createUser("buyer-" + (buyerIndex + 1), fullName, "buyer");
    for (let purchaseIndex = 0; purchaseIndex < 2; purchaseIndex++) {
      const label = "purchase-" + buyerIndex + "-" + purchaseIndex;
      const orderId = fixtureId(label);
      const amount = amounts[buyerIndex];
      const commission = (BigInt(amount) / 10n).toString();
      const payable = (BigInt(amount) - BigInt(commission)).toString();
      const createdAt = new Date(timestamp.getTime() - (buyerIndex * 2 + purchaseIndex + 1) * 86400000);
      const requestHash = createHash("sha256").update(label).digest("hex");
      const existing = await database.query("SELECT buyer_id, traffic_source FROM orders WHERE id = $1", [orderId]);
      if (existing.rowCount) {
        if (existing.rows[0].buyer_id !== buyerId || existing.rows[0].traffic_source !== marker) throw new Error("Fixture order identity collision");
        continue;
      }
      await database.query(
        "INSERT INTO orders (id, buyer_id, seller_id, status, currency, total_amount, commission_rate, holdback_rate, idempotency_key, request_hash, traffic_source, created_at, updated_at) VALUES ($1, $2, $3, 'delivered', 'TOMAN', $4, 0.1, 0, $5, $6, $7, $8, $8)",
        [orderId, buyerId, sellerId, amount, fixtureId(label + "-order-key"), requestHash, marker, createdAt],
      );
      await database.query(
        "INSERT INTO order_items (id, order_id, offer_id, product_type, product_title, quantity, unit_price, total_amount) VALUES ($1, $2, $3, 'service', $4, 1, $5, $5)",
        [fixtureId(label + "-item"), orderId, offerId, "آموزش تخصصی تعمیرات موبایل — داده آزمایشی", amount],
      );
      await database.query(
        "INSERT INTO payment_attempts (id, order_id, provider, status, amount, currency, idempotency_key, authority, provider_ref_id, verified_at, created_at, updated_at) VALUES ($1, $2, $3, 'succeeded', $4, 'TOMAN', $5, $6, $6, $7, $7, $7)",
        [fixtureId(label + "-payment"), orderId, marker, amount, fixtureId(label + "-payment-key"), label, createdAt],
      );
      await database.query(
        "INSERT INTO payout_ledger (id, order_id, seller_id, gross_amount, commission_amount, holdback_amount, payable_amount, currency, status, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, 0, $6, 'TOMAN', 'draft', $7, $7)",
        [fixtureId(label + "-ledger"), orderId, sellerId, amount, commission, payable, createdAt],
      );
      await database.query(
        "INSERT INTO order_events (id, order_id, actor_user_id, from_status, to_status, action, idempotency_key, request_hash, created_at) VALUES ($1, $2, $3, NULL, 'delivered', 'status_changed', $4, $5, $6)",
        [fixtureId(label + "-event"), orderId, sellerUserId, fixtureId(label + "-event-key"), requestHash, createdAt],
      );
      createdOrders++;
    }
  }
  const board = await database.query(
    "SELECT u.full_name AS name, (FLOOR(SUM(o.total_amount) / 1000) + SUM(oi.quantity) * 10)::text AS score, COUNT(DISTINCT o.id)::integer AS purchases FROM users u JOIN orders o ON o.buyer_id = u.id JOIN order_items oi ON oi.order_id = o.id WHERE o.traffic_source = $1 AND o.status = 'delivered' GROUP BY u.id, u.full_name ORDER BY FLOOR(SUM(o.total_amount) / 1000) + SUM(oi.quantity) * 10 DESC",
    [marker],
  );
  if (board.rows.length !== names.length || board.rows.some(row => row.purchases !== 2)) throw new Error("Incomplete dashboard fixtures");
  await database.query("COMMIT");
  console.log(JSON.stringify({ createdUsers, createdOrders, totalDemoBuyers: board.rows.length, totalDemoOrders: names.length * 2, leaderboard: board.rows }, null, 2));
} catch (error) {
  await database.query("ROLLBACK");
  throw error;
} finally {
  await database.end();
}
