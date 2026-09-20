BEGIN;
-- Monetary values previously stored as IRR are converted exactly to toman.
-- Apply with application writes paused; this migration rewrites money tables.
SET LOCAL lock_timeout = '10s';

-- Currency column types are referenced by reporting views. Restore their
-- definitions and reader grants before this transaction commits.
DROP VIEW IF EXISTS "ai_reporting"."daily_sales";
DROP VIEW IF EXISTS "ai_reporting"."product_performance";
DROP VIEW IF EXISTS "ai_reporting"."seller_performance";
DROP VIEW IF EXISTS "ai_reporting"."payout_summary";
DROP VIEW IF EXISTS "ai_reporting"."payment_health";
DROP VIEW IF EXISTS "ai_reporting"."fulfillment_health";
DROP VIEW IF EXISTS "ai_reporting"."seller_products";
DROP VIEW IF EXISTS "ai_reporting"."specialist_directory";
DROP VIEW IF EXISTS "ai_reporting"."order_summary";
DROP VIEW IF EXISTS "ai_reporting"."payment_refund_summary";
DROP VIEW IF EXISTS "ai_reporting"."bridge_connection_health";
DROP VIEW IF EXISTS "ai_reporting"."blog_summary";
DROP VIEW IF EXISTS "ai_reporting"."coupon_summary";
DROP VIEW IF EXISTS "ai_reporting"."user_role_summary";

ALTER TABLE "seller_offers" DROP CONSTRAINT "seller_offers_currency_check";
ALTER TABLE "coupons" DROP CONSTRAINT "coupons_currency_check";
ALTER TABLE "orders" DROP CONSTRAINT "orders_currency_check";
ALTER TABLE "payout_ledger" DROP CONSTRAINT "payout_ledger_irr_scale_check";
ALTER TABLE "payment_attempts" DROP CONSTRAINT "payment_attempts_currency_check";
ALTER TABLE "checkouts" DROP CONSTRAINT "checkouts_currency_check";
ALTER TABLE "checkout_payment_groups" DROP CONSTRAINT "checkout_payment_groups_currency_check";

ALTER TABLE "coupons" ALTER COLUMN "currency" TYPE VARCHAR(5);
ALTER TABLE "seller_offers" ALTER COLUMN "currency" TYPE VARCHAR(5);
ALTER TABLE "orders" ALTER COLUMN "currency" TYPE VARCHAR(5);
ALTER TABLE "payout_ledger" ALTER COLUMN "currency" TYPE VARCHAR(5);
ALTER TABLE "payment_attempts" ALTER COLUMN "currency" TYPE VARCHAR(5);
ALTER TABLE "checkouts" ALTER COLUMN "currency" TYPE VARCHAR(5);
ALTER TABLE "checkout_payment_groups" ALTER COLUMN "currency" TYPE VARCHAR(5);
ALTER TABLE "seller_offers" ALTER COLUMN "price" TYPE DECIMAL(21,5);
ALTER TABLE "coupons" ALTER COLUMN "discount_value" TYPE DECIMAL(21,5), ALTER COLUMN "minimum_order_amount" TYPE DECIMAL(21,5);

-- Temporarily relax integer checks so historical rial values not divisible by
-- ten can be represented as a tenth of a toman without loss of value.
ALTER TABLE "orders" DROP CONSTRAINT "orders_total_amount_check";
ALTER TABLE "order_items" DROP CONSTRAINT "order_items_amount_check";
ALTER TABLE "payout_ledger" DROP CONSTRAINT "payout_ledger_amounts_check";
ALTER TABLE "payment_attempts" DROP CONSTRAINT "payment_attempts_amount_check";
ALTER TABLE "checkouts" DROP CONSTRAINT "checkouts_total_amount_check";
ALTER TABLE "checkout_payment_groups" DROP CONSTRAINT "checkout_payment_groups_amount_check";
ALTER TABLE "checkout_payment_group_orders" DROP CONSTRAINT "checkout_payment_group_orders_amount_check";

UPDATE "seller_offers" SET "price" = "price" / 10, "currency" = 'TOMAN' WHERE "currency" = 'IRR';
UPDATE "coupons" SET
  "discount_value" = CASE WHEN "discount_type" = 'fixed' THEN "discount_value" / 10 ELSE "discount_value" END,
  "minimum_order_amount" = "minimum_order_amount" / 10,
  "currency" = 'TOMAN'
WHERE "currency" = 'IRR';
UPDATE "order_items" SET "unit_price" = "unit_price" / 10, "total_amount" = "total_amount" / 10;
UPDATE "orders" SET "total_amount" = "total_amount" / 10, "currency" = 'TOMAN' WHERE "currency" = 'IRR';
UPDATE "payout_ledger" SET
  "gross_amount" = "gross_amount" / 10,
  "commission_amount" = "commission_amount" / 10,
  "holdback_amount" = "holdback_amount" / 10,
  "payable_amount" = "payable_amount" / 10,
  "currency" = 'TOMAN'
WHERE "currency" = 'IRR';
UPDATE "payment_attempts" SET "amount" = "amount" / 10, "currency" = 'TOMAN' WHERE "currency" = 'IRR';
UPDATE "checkout_payment_group_orders" SET "amount" = "amount" / 10;
UPDATE "checkout_payment_groups" SET "amount" = "amount" / 10, "currency" = 'TOMAN' WHERE "currency" = 'IRR';
UPDATE "checkouts" SET "total_amount" = "total_amount" / 10, "currency" = 'TOMAN' WHERE "currency" = 'IRR';

ALTER TABLE "seller_offers" ADD CONSTRAINT "seller_offers_currency_check" CHECK ("currency" IN ('TOMAN', 'USD'));
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_currency_check" CHECK ("currency" = 'TOMAN');
ALTER TABLE "orders" ADD CONSTRAINT "orders_currency_check" CHECK ("currency" = 'TOMAN');
ALTER TABLE "orders" ADD CONSTRAINT "orders_total_amount_check" CHECK ("total_amount" >= 0 AND "total_amount" * 10 = TRUNC("total_amount" * 10));
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_amount_check" CHECK (
  "unit_price" >= 0 AND "unit_price" * 10 = TRUNC("unit_price" * 10) AND "total_amount" = "unit_price" * "quantity"
);
ALTER TABLE "payout_ledger" ADD CONSTRAINT "payout_ledger_amounts_check" CHECK (
  "gross_amount" >= 0 AND "commission_amount" >= 0 AND "holdback_amount" >= 0 AND "payable_amount" >= 0 AND
  "commission_amount" + "holdback_amount" + "payable_amount" = "gross_amount"
);
ALTER TABLE "payout_ledger" ADD CONSTRAINT "payout_ledger_toman_scale_check" CHECK (
  "currency" = 'TOMAN' AND "gross_amount" * 10 = TRUNC("gross_amount" * 10) AND "commission_amount" * 10 = TRUNC("commission_amount" * 10) AND
  "holdback_amount" * 10 = TRUNC("holdback_amount" * 10) AND "payable_amount" * 10 = TRUNC("payable_amount" * 10)
);
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_amount_check" CHECK ("amount" > 0 AND "amount" * 10 = TRUNC("amount" * 10));
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_currency_check" CHECK ("currency" = 'TOMAN');
ALTER TABLE "checkouts" ADD CONSTRAINT "checkouts_total_amount_check" CHECK ("total_amount" > 0 AND "total_amount" * 10 = TRUNC("total_amount" * 10));
ALTER TABLE "checkouts" ADD CONSTRAINT "checkouts_currency_check" CHECK ("currency" = 'TOMAN');
ALTER TABLE "checkout_payment_groups" ADD CONSTRAINT "checkout_payment_groups_amount_check" CHECK ("amount" > 0 AND "amount" * 10 = TRUNC("amount" * 10));
ALTER TABLE "checkout_payment_groups" ADD CONSTRAINT "checkout_payment_groups_currency_check" CHECK ("currency" = 'TOMAN');
ALTER TABLE "checkout_payment_group_orders" ADD CONSTRAINT "checkout_payment_group_orders_amount_check" CHECK ("amount" > 0 AND "amount" * 10 = TRUNC("amount" * 10));
CREATE VIEW "ai_reporting"."daily_sales" AS
SELECT DATE_TRUNC('day', o."created_at")::date AS "day", o."currency", o."status"::text AS "status",
       COUNT(*)::bigint AS "order_count", COALESCE(SUM(o."total_amount"), 0)::numeric(20,4) AS "gross_amount"
FROM "orders" o GROUP BY 1, 2, 3;

CREATE VIEW "ai_reporting"."product_performance" AS
SELECT oi."offer_id", oi."product_title", oi."product_type"::text AS "product_type", o."currency",
       COUNT(*)::bigint AS "order_count", COALESCE(SUM(oi."quantity"), 0)::bigint AS "units",
       COALESCE(SUM(oi."total_amount"), 0)::numeric(20,4) AS "gross_amount",
       COUNT(*) FILTER (WHERE o."status" = 'cancelled')::bigint AS "cancelled_orders"
FROM "order_items" oi JOIN "orders" o ON o."id" = oi."order_id"
GROUP BY 1, 2, 3, 4;

CREATE VIEW "ai_reporting"."seller_performance" AS
SELECT s."id" AS "seller_id", s."shop_name", s."approved", (s."suspended_at" IS NOT NULL) AS "suspended",
       o."currency", COUNT(o."id")::bigint AS "order_count",
       COALESCE(SUM(o."total_amount"), 0)::numeric(20,4) AS "gross_amount",
       COUNT(o."id") FILTER (WHERE o."status" = 'cancelled')::bigint AS "cancelled_orders"
FROM "sellers" s LEFT JOIN "orders" o ON o."seller_id" = s."id"
GROUP BY 1, 2, 3, 4, 5;

CREATE VIEW "ai_reporting"."payout_summary" AS
SELECT p."currency", p."status"::text AS "status", COUNT(*)::bigint AS "payout_count",
       COALESCE(SUM(p."gross_amount"), 0)::numeric(20,4) AS "gross_amount",
       COALESCE(SUM(p."commission_amount"), 0)::numeric(20,4) AS "commission_amount",
       COALESCE(SUM(p."payable_amount"), 0)::numeric(20,4) AS "payable_amount"
FROM "payout_ledger" p GROUP BY 1, 2;

CREATE VIEW "ai_reporting"."payment_health" AS
SELECT DATE_TRUNC('day', p."created_at")::date AS "day", p."provider", p."status"::text AS "status", p."currency",
       COUNT(*)::bigint AS "attempt_count", COALESCE(SUM(p."amount"), 0)::numeric(20,4) AS "amount"
FROM "payment_attempts" p GROUP BY 1, 2, 3, 4;

CREATE VIEW "ai_reporting"."fulfillment_health" AS
SELECT DATE_TRUNC('day', f."created_at")::date AS "day", f."mode"::text AS "mode", f."status"::text AS "status",
       COUNT(*)::bigint AS "fulfillment_count", COALESCE(AVG(f."submit_attempts"), 0)::numeric(10,2) AS "average_submit_attempts"
FROM "bridge_fulfillments" f GROUP BY 1, 2, 3;

CREATE VIEW "ai_reporting"."seller_products" AS
SELECT l."seller_id", s."shop_name", l."id" AS "listing_id", p."id" AS "product_id",
       p."title" AS "product_title", p."category", p."kind"::text AS "product_kind",
       p."type"::text AS "product_type", p."status"::text AS "product_status",
       l."status"::text AS "listing_status", o."id" AS "offer_id", v."name" AS "variant_name",
       o."price", o."currency", o."status"::text AS "offer_status", ph."stock",
       sv."service_type", sv."estimated_hours", l."created_at"
FROM "seller_listings" l
JOIN "sellers" s ON s."id" = l."seller_id"
JOIN "products" p ON p."id" = l."product_id"
LEFT JOIN "seller_offers" o ON o."listing_id" = l."id"
LEFT JOIN "product_variants" v ON v."id" = o."variant_id"
LEFT JOIN "seller_offer_physical" ph ON ph."offer_id" = o."id"
LEFT JOIN "seller_offer_service" sv ON sv."offer_id" = o."id";

CREATE VIEW "ai_reporting"."specialist_directory" AS
SELECT a."id" AS "specialist_id", a."name", a."specialty", a."rating", a."available", a."created_at"
FROM "seller_agents" a;

CREATE VIEW "ai_reporting"."order_summary" AS
SELECT o."id" AS "order_id", o."seller_id", s."shop_name", o."created_at"::date AS "day",
       o."status"::text AS "status", o."currency", o."total_amount", i."offer_id",
       i."product_title", i."product_type"::text AS "product_type", i."quantity", i."unit_price"
FROM "orders" o
JOIN "sellers" s ON s."id" = o."seller_id"
LEFT JOIN "order_items" i ON i."order_id" = o."id";

CREATE VIEW "ai_reporting"."payment_refund_summary" AS
SELECT r."created_at"::date AS "day", a."provider", r."status"::text AS "status", a."currency",
       COUNT(*)::bigint AS "refund_count", COALESCE(SUM(a."amount"), 0)::numeric(20,4) AS "amount"
FROM "payment_refunds" r
JOIN "payment_attempts" a ON a."id" = r."payment_attempt_id"
GROUP BY 1, 2, 3, 4;

CREATE VIEW "ai_reporting"."bridge_connection_health" AS
SELECT c."id" AS "connection_id", c."seller_id", s."shop_name", c."name" AS "connection_name",
       c."provider"::text AS "provider", c."status"::text AS "status", c."last_tested_at",
       c."last_synced_at", c."last_error_code"
FROM "bridge_connections" c
JOIN "sellers" s ON s."id" = c."seller_id";

CREATE VIEW "ai_reporting"."blog_summary" AS
SELECT b."id" AS "post_id", b."seller_id", s."shop_name", b."title", b."status"::text AS "status",
       b."published_at", b."created_at"
FROM "blog_posts" b
LEFT JOIN "sellers" s ON s."id" = b."seller_id";

CREATE VIEW "ai_reporting"."coupon_summary" AS
SELECT c."seller_id", s."shop_name", c."currency", c."active", c."starts_at", c."expires_at",
       COUNT(*)::bigint AS "coupon_count", COALESCE(SUM(c."redeemed_count"), 0)::bigint AS "redeemed_count"
FROM "coupons" c
JOIN "sellers" s ON s."id" = c."seller_id"
GROUP BY 1, 2, 3, 4, 5, 6;

CREATE VIEW "ai_reporting"."user_role_summary" AS
SELECT u."role"::text AS "role", COUNT(*)::bigint AS "user_count"
FROM "users" u GROUP BY 1;

REVOKE ALL ON ALL TABLES IN SCHEMA "ai_reporting" FROM PUBLIC;
DO $migration$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'topgsm_ai_reader') THEN
    GRANT SELECT ON ALL TABLES IN SCHEMA "ai_reporting" TO topgsm_ai_reader;
  END IF;
END
$migration$;

COMMIT;
