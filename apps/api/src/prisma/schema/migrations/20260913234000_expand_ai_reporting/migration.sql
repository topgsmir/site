-- Expand the owner-only AI surface with deliberately masked business views.
-- Credentials, hashes, tokens, provider references, contact details, free-form
-- private payloads, and buyer identities remain outside ai_reporting.

CREATE VIEW "ai_reporting"."seller_products" AS
SELECT l."seller_id",
       s."shop_name",
       l."id" AS "listing_id",
       p."id" AS "product_id",
       p."title" AS "product_title",
       p."category",
       p."kind"::text AS "product_kind",
       p."type"::text AS "product_type",
       p."status"::text AS "product_status",
       l."status"::text AS "listing_status",
       o."id" AS "offer_id",
       v."name" AS "variant_name",
       o."price",
       o."currency",
       o."status"::text AS "offer_status",
       ph."stock",
       sv."service_type",
       sv."estimated_hours",
       l."created_at"
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
SELECT o."id" AS "order_id",
       o."seller_id",
       s."shop_name",
       o."created_at"::date AS "day",
       o."status"::text AS "status",
       o."currency",
       o."total_amount",
       i."offer_id",
       i."product_title",
       i."product_type"::text AS "product_type",
       i."quantity",
       i."unit_price"
FROM "orders" o
JOIN "sellers" s ON s."id" = o."seller_id"
LEFT JOIN "order_items" i ON i."order_id" = o."id";

CREATE VIEW "ai_reporting"."payment_refund_summary" AS
SELECT r."created_at"::date AS "day",
       a."provider",
       r."status"::text AS "status",
       a."currency",
       COUNT(*)::bigint AS "refund_count",
       COALESCE(SUM(a."amount"), 0)::numeric(20,4) AS "amount"
FROM "payment_refunds" r
JOIN "payment_attempts" a ON a."id" = r."payment_attempt_id"
GROUP BY 1, 2, 3, 4;

CREATE VIEW "ai_reporting"."bridge_connection_health" AS
SELECT c."id" AS "connection_id",
       c."seller_id",
       s."shop_name",
       c."name" AS "connection_name",
       c."provider"::text AS "provider",
       c."status"::text AS "status",
       c."last_tested_at",
       c."last_synced_at",
       c."last_error_code"
FROM "bridge_connections" c
JOIN "sellers" s ON s."id" = c."seller_id";

CREATE VIEW "ai_reporting"."blog_summary" AS
SELECT b."id" AS "post_id",
       b."seller_id",
       s."shop_name",
       b."title",
       b."status"::text AS "status",
       b."published_at",
       b."created_at"
FROM "blog_posts" b
LEFT JOIN "sellers" s ON s."id" = b."seller_id";

CREATE VIEW "ai_reporting"."coupon_summary" AS
SELECT c."seller_id",
       s."shop_name",
       c."currency",
       c."active",
       c."starts_at",
       c."expires_at",
       COUNT(*)::bigint AS "coupon_count",
       COALESCE(SUM(c."redeemed_count"), 0)::bigint AS "redeemed_count"
FROM "coupons" c
JOIN "sellers" s ON s."id" = c."seller_id"
GROUP BY 1, 2, 3, 4, 5, 6;

CREATE VIEW "ai_reporting"."user_role_summary" AS
SELECT u."role"::text AS "role", COUNT(*)::bigint AS "user_count"
FROM "users" u
GROUP BY 1;

REVOKE ALL ON ALL TABLES IN SCHEMA "ai_reporting" FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'topgsm_ai_reader') THEN
    GRANT SELECT ON ALL TABLES IN SCHEMA "ai_reporting" TO topgsm_ai_reader;
  END IF;
END
$$;
