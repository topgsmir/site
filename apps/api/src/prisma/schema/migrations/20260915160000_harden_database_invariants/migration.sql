SET lock_timeout = '5s';
SET statement_timeout = '120s';

-- Prisma maps unannotated DateTime to timestamp without time zone. Existing values
-- were written as UTC, so preserve their instant while making that contract explicit.
-- Reporting views bind to the source column types, so recreate them around the
-- conversion and restore their least-privilege grants afterwards.
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

DO $migration$
DECLARE
  column_record RECORD;
BEGIN
  FOR column_record IN
    SELECT columns.table_schema, columns.table_name, columns.column_name,
           columns.data_type, columns.datetime_precision
    FROM information_schema.columns AS columns
    JOIN information_schema.tables AS tables
      USING (table_schema, table_name)
    WHERE columns.table_schema = 'public'
      AND tables.table_type = 'BASE TABLE'
      AND columns.data_type IN ('timestamp without time zone', 'timestamp with time zone')
  LOOP
    IF column_record.data_type = 'timestamp without time zone' THEN
      EXECUTE format(
        'ALTER TABLE %I.%I ALTER COLUMN %I TYPE TIMESTAMPTZ(3) USING %I AT TIME ZONE ''UTC''',
        column_record.table_schema,
        column_record.table_name,
        column_record.column_name,
        column_record.column_name
      );
    ELSIF column_record.datetime_precision IS DISTINCT FROM 3 THEN
      EXECUTE format(
        'ALTER TABLE %I.%I ALTER COLUMN %I TYPE TIMESTAMPTZ(3)',
        column_record.table_schema,
        column_record.table_name,
        column_record.column_name
      );
    END IF;
  END LOOP;
END
$migration$;

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

-- Repair an audit table that can be absent when an older, already-applied migration
-- was changed after deployment.
CREATE TABLE IF NOT EXISTS "payment_method_config_events" (
  "id" TEXT NOT NULL,
  "provider_code" VARCHAR(32) NOT NULL,
  "actor_user_id" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL,
  "changed_fields" TEXT[] NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payment_method_config_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "payment_method_config_events_provider_code_fkey"
    FOREIGN KEY ("provider_code") REFERENCES "payment_method_configs"("provider_code") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "payment_method_config_events_actor_user_id_fkey"
    FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "payment_method_config_events_provider_code_created_at_id_idx"
  ON "payment_method_config_events"("provider_code", "created_at" DESC, "id" DESC);
CREATE INDEX IF NOT EXISTS "payment_method_config_events_actor_user_id_created_at_id_idx"
  ON "payment_method_config_events"("actor_user_id", "created_at" DESC, "id" DESC);

-- Fail clearly before adding uniqueness if legacy data is ambiguous.
DO $migration$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "seller_memberships"
    WHERE "active"
    GROUP BY "user_id"
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot enforce one active seller membership per user: duplicate active memberships exist';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "platform_staff_invitations"
    WHERE "status"::text = 'pending'
    GROUP BY lower(btrim("email"))
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot enforce one pending staff invitation per email: duplicates exist';
  END IF;
END
$migration$;

CREATE UNIQUE INDEX IF NOT EXISTS "seller_memberships_one_active_per_user_key"
  ON "seller_memberships"("user_id") WHERE "active";
CREATE UNIQUE INDEX IF NOT EXISTS "platform_staff_invitations_one_pending_email_key"
  ON "platform_staff_invitations" (lower(btrim("email"))) WHERE "status" = 'pending';

-- Scope provider references to their payment provider. Different gateways can issue
-- the same authority/reference value without colliding.
ALTER TABLE "payment_attempts" ALTER COLUMN "authority" TYPE VARCHAR(128);
DROP INDEX IF EXISTS "payment_attempts_authority_key";
DROP INDEX IF EXISTS "payment_attempts_provider_ref_id_key";
CREATE UNIQUE INDEX IF NOT EXISTS "payment_attempts_id_provider_key"
  ON "payment_attempts"("id", "provider");
CREATE UNIQUE INDEX IF NOT EXISTS "payment_attempts_provider_authority_key"
  ON "payment_attempts"("provider", "authority");
CREATE UNIQUE INDEX IF NOT EXISTS "payment_attempts_provider_provider_ref_id_key"
  ON "payment_attempts"("provider", "provider_ref_id");

ALTER TABLE "payment_refunds" ADD COLUMN IF NOT EXISTS "provider" VARCHAR(32);
UPDATE "payment_refunds" AS refund
SET "provider" = attempt."provider"
FROM "payment_attempts" AS attempt
WHERE attempt."id" = refund."payment_attempt_id"
  AND refund."provider" IS NULL;

DO $migration$
BEGIN
  IF EXISTS (SELECT 1 FROM "payment_refunds" WHERE "provider" IS NULL) THEN
    RAISE EXCEPTION 'Cannot backfill payment_refunds.provider: orphaned payment attempt exists';
  END IF;
END
$migration$;

ALTER TABLE "payment_refunds" ALTER COLUMN "provider" SET NOT NULL;
DROP INDEX IF EXISTS "payment_refunds_provider_ref_id_key";
CREATE UNIQUE INDEX IF NOT EXISTS "payment_refunds_provider_provider_ref_id_key"
  ON "payment_refunds"("provider", "provider_ref_id");

DO $migration$
BEGIN
  ALTER TABLE "payment_refunds"
    DROP CONSTRAINT IF EXISTS "payment_refunds_payment_attempt_id_fkey";
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payment_refunds_payment_attempt_id_provider_fkey'
  ) THEN
    ALTER TABLE "payment_refunds"
      ADD CONSTRAINT "payment_refunds_payment_attempt_id_provider_fkey"
      FOREIGN KEY ("payment_attempt_id", "provider")
      REFERENCES "payment_attempts"("id", "provider")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END
$migration$;

-- Ensure payout ownership is derived from the order rather than trusting an
-- independently supplied seller id.
CREATE UNIQUE INDEX IF NOT EXISTS "orders_id_seller_id_key" ON "orders"("id", "seller_id");

DO $migration$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "order_items" item
    JOIN "orders" orders ON orders."id" = item."order_id"
    JOIN "seller_offers" offer ON offer."id" = item."offer_id"
    JOIN "seller_listings" listing ON listing."id" = offer."listing_id"
    WHERE orders."seller_id" <> listing."seller_id"
  ) THEN
    RAISE EXCEPTION 'Cannot enforce order item ownership: offer seller does not match order seller';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "payout_ledger" payout
    JOIN "orders" orders ON orders."id" = payout."order_id"
    WHERE payout."seller_id" <> orders."seller_id"
  ) THEN
    RAISE EXCEPTION 'Cannot enforce payout ownership: payout seller does not match order seller';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payout_ledger_order_id_seller_id_fkey'
  ) THEN
    ALTER TABLE "payout_ledger"
      DROP CONSTRAINT IF EXISTS "payout_ledger_order_id_fkey";
    ALTER TABLE "payout_ledger"
      ADD CONSTRAINT "payout_ledger_order_id_seller_id_fkey"
      FOREIGN KEY ("order_id", "seller_id")
      REFERENCES "orders"("id", "seller_id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END
$migration$;

CREATE OR REPLACE FUNCTION enforce_order_item_seller_ownership()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  order_seller TEXT;
  offer_seller TEXT;
BEGIN
  SELECT "seller_id" INTO order_seller FROM "orders" WHERE "id" = NEW."order_id";
  SELECT listing."seller_id" INTO offer_seller
  FROM "seller_offers" offer
  JOIN "seller_listings" listing ON listing."id" = offer."listing_id"
  WHERE offer."id" = NEW."offer_id";

  IF order_seller IS NULL OR offer_seller IS NULL OR order_seller <> offer_seller THEN
    RAISE EXCEPTION 'Order item offer seller must match order seller';
  END IF;
  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS "order_items_enforce_seller_ownership" ON "order_items";
CREATE TRIGGER "order_items_enforce_seller_ownership"
BEFORE INSERT OR UPDATE OF "order_id", "offer_id" ON "order_items"
FOR EACH ROW EXECUTE FUNCTION enforce_order_item_seller_ownership();

CREATE OR REPLACE FUNCTION prevent_order_seller_mismatch()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW."seller_id" IS DISTINCT FROM OLD."seller_id" AND EXISTS (
    SELECT 1
    FROM "order_items" item
    JOIN "seller_offers" offer ON offer."id" = item."offer_id"
    JOIN "seller_listings" listing ON listing."id" = offer."listing_id"
    WHERE item."order_id" = NEW."id" AND listing."seller_id" <> NEW."seller_id"
  ) THEN
    RAISE EXCEPTION 'Order seller must match every order item offer seller';
  END IF;
  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS "orders_prevent_seller_mismatch" ON "orders";
CREATE TRIGGER "orders_prevent_seller_mismatch"
BEFORE UPDATE OF "seller_id" ON "orders"
FOR EACH ROW EXECUTE FUNCTION prevent_order_seller_mismatch();

CREATE OR REPLACE FUNCTION prevent_offer_seller_reparenting()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF TG_TABLE_NAME = 'seller_offers' AND NEW."listing_id" IS DISTINCT FROM OLD."listing_id" AND EXISTS (
    SELECT 1
    FROM "order_items" item
    JOIN "orders" orders ON orders."id" = item."order_id"
    JOIN "seller_listings" listing ON listing."id" = NEW."listing_id"
    WHERE item."offer_id" = OLD."id" AND orders."seller_id" <> listing."seller_id"
  ) THEN
    RAISE EXCEPTION 'Cannot move an offer to a seller that does not own its existing orders';
  ELSIF TG_TABLE_NAME = 'seller_listings' AND NEW."seller_id" IS DISTINCT FROM OLD."seller_id" AND EXISTS (
    SELECT 1
    FROM "seller_offers" offer
    JOIN "order_items" item ON item."offer_id" = offer."id"
    JOIN "orders" orders ON orders."id" = item."order_id"
    WHERE offer."listing_id" = OLD."id" AND orders."seller_id" <> NEW."seller_id"
  ) THEN
    RAISE EXCEPTION 'Cannot move a listing to a seller that does not own its existing orders';
  END IF;
  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS "seller_offers_prevent_seller_reparenting" ON "seller_offers";
CREATE TRIGGER "seller_offers_prevent_seller_reparenting"
BEFORE UPDATE OF "listing_id" ON "seller_offers"
FOR EACH ROW EXECUTE FUNCTION prevent_offer_seller_reparenting();
DROP TRIGGER IF EXISTS "seller_listings_prevent_seller_reparenting" ON "seller_listings";
CREATE TRIGGER "seller_listings_prevent_seller_reparenting"
BEFORE UPDATE OF "seller_id" ON "seller_listings"
FOR EACH ROW EXECUTE FUNCTION prevent_offer_seller_reparenting();

-- Blog pointer and moderation rows must refer to a revision owned by the same post.
CREATE UNIQUE INDEX IF NOT EXISTS "blog_posts_working_revision_id_key" ON "blog_posts"("working_revision_id");
CREATE UNIQUE INDEX IF NOT EXISTS "blog_posts_published_revision_id_key" ON "blog_posts"("published_revision_id");
CREATE UNIQUE INDEX IF NOT EXISTS "blog_revisions_id_post_id_key" ON "blog_revisions"("id", "post_id");

DO $migration$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "blog_posts" post
    JOIN "blog_revisions" revision
      ON revision."id" IN (post."working_revision_id", post."published_revision_id")
    WHERE revision."post_id" <> post."id"
  ) OR EXISTS (
    SELECT 1
    FROM "blog_moderation_events" event
    JOIN "blog_revisions" revision ON revision."id" = event."revision_id"
    WHERE revision."post_id" <> event."post_id"
  ) THEN
    RAISE EXCEPTION 'Cannot enforce blog revision ownership: mismatched rows exist';
  END IF;
END
$migration$;

CREATE OR REPLACE FUNCTION enforce_blog_revision_ownership()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF TG_TABLE_NAME = 'blog_posts' THEN
    IF NEW."working_revision_id" IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM "blog_revisions" WHERE "id" = NEW."working_revision_id" AND "post_id" = NEW."id"
    ) THEN
      RAISE EXCEPTION 'Working revision must belong to its blog post';
    END IF;
    IF NEW."published_revision_id" IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM "blog_revisions" WHERE "id" = NEW."published_revision_id" AND "post_id" = NEW."id"
    ) THEN
      RAISE EXCEPTION 'Published revision must belong to its blog post';
    END IF;
  ELSIF TG_TABLE_NAME = 'blog_moderation_events' AND NOT EXISTS (
    SELECT 1 FROM "blog_revisions" WHERE "id" = NEW."revision_id" AND "post_id" = NEW."post_id"
  ) THEN
    RAISE EXCEPTION 'Moderated revision must belong to its blog post';
  END IF;
  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS "blog_posts_enforce_revision_ownership" ON "blog_posts";
CREATE TRIGGER "blog_posts_enforce_revision_ownership"
BEFORE INSERT OR UPDATE OF "id", "working_revision_id", "published_revision_id" ON "blog_posts"
FOR EACH ROW EXECUTE FUNCTION enforce_blog_revision_ownership();
DROP TRIGGER IF EXISTS "blog_moderation_events_enforce_revision_ownership" ON "blog_moderation_events";
CREATE TRIGGER "blog_moderation_events_enforce_revision_ownership"
BEFORE INSERT OR UPDATE OF "post_id", "revision_id" ON "blog_moderation_events"
FOR EACH ROW EXECUTE FUNCTION enforce_blog_revision_ownership();

CREATE OR REPLACE FUNCTION prevent_blog_revision_reparenting()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW."post_id" IS DISTINCT FROM OLD."post_id" AND (
    EXISTS (SELECT 1 FROM "blog_posts" WHERE "id" = OLD."post_id" AND ("working_revision_id" = OLD."id" OR "published_revision_id" = OLD."id"))
    OR EXISTS (SELECT 1 FROM "blog_moderation_events" WHERE "revision_id" = OLD."id" AND "post_id" <> NEW."post_id")
  ) THEN
    RAISE EXCEPTION 'Cannot move a referenced blog revision to another post';
  END IF;
  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS "blog_revisions_prevent_reparenting" ON "blog_revisions";
CREATE TRIGGER "blog_revisions_prevent_reparenting"
BEFORE UPDATE OF "post_id" ON "blog_revisions"
FOR EACH ROW EXECUTE FUNCTION prevent_blog_revision_reparenting();

-- AI run ownership and message links are tenant boundaries, not merely application
-- validation concerns.
CREATE UNIQUE INDEX IF NOT EXISTS "ai_conversations_id_owner_user_id_key"
  ON "ai_conversations"("id", "owner_user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "ai_messages_id_conversation_id_key"
  ON "ai_messages"("id", "conversation_id");

DO $migration$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "ai_runs" run
    JOIN "ai_conversations" conversation ON conversation."id" = run."conversation_id"
    JOIN "ai_messages" input_message ON input_message."id" = run."input_message_id"
    LEFT JOIN "ai_messages" output_message ON output_message."id" = run."output_message_id"
    WHERE conversation."owner_user_id" <> run."requester_id"
      OR input_message."conversation_id" <> run."conversation_id"
      OR (run."output_message_id" IS NOT NULL AND output_message."conversation_id" <> run."conversation_id")
  ) THEN
    RAISE EXCEPTION 'Cannot enforce AI run scope: cross-conversation or cross-owner links exist';
  END IF;
END
$migration$;

CREATE OR REPLACE FUNCTION enforce_ai_run_scope()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "ai_conversations"
    WHERE "id" = NEW."conversation_id" AND "owner_user_id" = NEW."requester_id"
  ) THEN
    RAISE EXCEPTION 'AI run requester must own the conversation';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM "ai_messages"
    WHERE "id" = NEW."input_message_id" AND "conversation_id" = NEW."conversation_id"
  ) THEN
    RAISE EXCEPTION 'AI run input message must belong to the conversation';
  END IF;
  IF NEW."output_message_id" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "ai_messages"
    WHERE "id" = NEW."output_message_id" AND "conversation_id" = NEW."conversation_id"
  ) THEN
    RAISE EXCEPTION 'AI run output message must belong to the conversation';
  END IF;
  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS "ai_runs_enforce_scope" ON "ai_runs";
CREATE TRIGGER "ai_runs_enforce_scope"
BEFORE INSERT OR UPDATE OF "conversation_id", "requester_id", "input_message_id", "output_message_id" ON "ai_runs"
FOR EACH ROW EXECUTE FUNCTION enforce_ai_run_scope();

CREATE OR REPLACE FUNCTION prevent_ai_scope_reparenting()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF TG_TABLE_NAME = 'ai_conversations' AND NEW."owner_user_id" IS DISTINCT FROM OLD."owner_user_id" AND EXISTS (
    SELECT 1 FROM "ai_runs" WHERE "conversation_id" = OLD."id" AND "requester_id" <> NEW."owner_user_id"
  ) THEN
    RAISE EXCEPTION 'Cannot change conversation owner while scoped AI runs exist';
  ELSIF TG_TABLE_NAME = 'ai_messages' AND NEW."conversation_id" IS DISTINCT FROM OLD."conversation_id" AND EXISTS (
    SELECT 1 FROM "ai_runs"
    WHERE ("input_message_id" = OLD."id" OR "output_message_id" = OLD."id")
      AND "conversation_id" <> NEW."conversation_id"
  ) THEN
    RAISE EXCEPTION 'Cannot move a message outside the conversation used by an AI run';
  END IF;
  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS "ai_conversations_prevent_scope_reparenting" ON "ai_conversations";
CREATE TRIGGER "ai_conversations_prevent_scope_reparenting"
BEFORE UPDATE OF "owner_user_id" ON "ai_conversations"
FOR EACH ROW EXECUTE FUNCTION prevent_ai_scope_reparenting();
DROP TRIGGER IF EXISTS "ai_messages_prevent_scope_reparenting" ON "ai_messages";
CREATE TRIGGER "ai_messages_prevent_scope_reparenting"
BEFORE UPDATE OF "conversation_id" ON "ai_messages"
FOR EACH ROW EXECUTE FUNCTION prevent_ai_scope_reparenting();
