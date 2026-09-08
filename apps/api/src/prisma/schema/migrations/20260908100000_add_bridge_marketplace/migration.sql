ALTER TYPE "product_type" ADD VALUE IF NOT EXISTS 'bridge';
ALTER TYPE "product_status" ADD VALUE IF NOT EXISTS 'pending_review' AFTER 'draft';
ALTER TYPE "seller_permission" ADD VALUE IF NOT EXISTS 'products_publish' AFTER 'products_manage';

CREATE TYPE "seller_membership_role" AS ENUM ('admin', 'staff');
CREATE TYPE "bridge_provider" AS ENUM ('dhru_legacy', 'dhru_new', 'webx');
CREATE TYPE "bridge_connection_status" AS ENUM ('active', 'inactive', 'error');
CREATE TYPE "bridge_service_kind" AS ENUM ('imei', 'server', 'file');
CREATE TYPE "bridge_grant_status" AS ENUM ('active', 'revoked');
CREATE TYPE "bridge_fulfillment_mode" AS ENUM ('automatic', 'manual');
CREATE TYPE "bridge_fulfillment_status" AS ENUM (
  'waiting_payment', 'queued', 'submitting', 'submitted', 'polling',
  'manual_required', 'succeeded', 'failed', 'refund_requested', 'refunded'
);
CREATE TYPE "payment_attempt_status" AS ENUM ('created', 'pending', 'succeeded', 'failed', 'refunded');
CREATE TYPE "otp_status" AS ENUM ('pending', 'consumed', 'expired');
CREATE TYPE "notification_status" AS ENUM ('pending', 'sending', 'sent', 'failed');
CREATE TYPE "outbox_delivery_status" AS ENUM ('pending', 'processing', 'delivered', 'failed');

ALTER TABLE "users" ADD COLUMN "phone_number" VARCHAR(16);
ALTER TABLE "users" ADD CONSTRAINT "users_phone_number_check"
  CHECK ("phone_number" IS NULL OR "phone_number" ~ '^\+989[0-9]{9}$');
CREATE UNIQUE INDEX "users_phone_number_key" ON "users"("phone_number");

CREATE TABLE "seller_memberships" (
  "seller_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "role" "seller_membership_role" NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "seller_memberships_pkey" PRIMARY KEY ("seller_id", "user_id")
);
CREATE INDEX "seller_memberships_user_id_active_idx" ON "seller_memberships"("user_id", "active");
ALTER TABLE "seller_memberships" ADD CONSTRAINT "seller_memberships_seller_id_fkey"
  FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "seller_memberships" ADD CONSTRAINT "seller_memberships_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Existing seller owners remain administrators. Existing product managers keep
-- their current seller membership relationship. The products_publish permission
-- backfill is intentionally deferred to the next migration: PostgreSQL does not
-- permit using a newly-added enum value until the adding transaction commits.
INSERT INTO "seller_memberships" ("seller_id", "user_id", "role")
SELECT "id", "user_id", 'admin'::"seller_membership_role" FROM "sellers"
ON CONFLICT DO NOTHING;

CREATE TABLE "product_review_events" (
  "id" TEXT NOT NULL,
  "product_id" TEXT NOT NULL,
  "reviewer_id" TEXT NOT NULL,
  "from_status" "product_status" NOT NULL,
  "to_status" "product_status" NOT NULL,
  "reason" VARCHAR(500),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "product_review_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "product_review_events_product_id_created_at_idx"
  ON "product_review_events"("product_id", "created_at");
ALTER TABLE "product_review_events" ADD CONSTRAINT "product_review_events_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_review_events" ADD CONSTRAINT "product_review_events_reviewer_id_fkey"
  FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "outbox_deliveries" (
  "event_id" TEXT NOT NULL,
  "consumer" VARCHAR(64) NOT NULL,
  "status" "outbox_delivery_status" NOT NULL DEFAULT 'pending',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "next_attempt_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "locked_at" TIMESTAMP(3),
  "last_error" VARCHAR(200),
  "delivered_at" TIMESTAMP(3),
  CONSTRAINT "outbox_deliveries_pkey" PRIMARY KEY ("event_id", "consumer"),
  CONSTRAINT "outbox_deliveries_attempts_check" CHECK ("attempts" >= 0)
);
CREATE INDEX "outbox_deliveries_consumer_status_next_attempt_at_idx"
  ON "outbox_deliveries"("consumer", "status", "next_attempt_at");
ALTER TABLE "outbox_deliveries" ADD CONSTRAINT "outbox_deliveries_event_id_fkey"
  FOREIGN KEY ("event_id") REFERENCES "outbox_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "bridge_connections" (
  "id" TEXT NOT NULL,
  "seller_id" TEXT NOT NULL,
  "name" VARCHAR(100) NOT NULL,
  "provider" "bridge_provider" NOT NULL,
  "base_url" VARCHAR(500) NOT NULL,
  "encrypted_username" TEXT NOT NULL,
  "encrypted_api_key" TEXT NOT NULL,
  "encryption_key_id" VARCHAR(32) NOT NULL,
  "status" "bridge_connection_status" NOT NULL DEFAULT 'inactive',
  "last_tested_at" TIMESTAMP(3),
  "last_synced_at" TIMESTAMP(3),
  "last_error_code" VARCHAR(64),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "bridge_connections_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "bridge_connections_name_check" CHECK (CHAR_LENGTH(BTRIM("name")) BETWEEN 1 AND 100),
  CONSTRAINT "bridge_connections_https_check" CHECK ("base_url" ~ '^https://')
);
CREATE UNIQUE INDEX "bridge_connections_seller_id_name_key" ON "bridge_connections"("seller_id", "name");
CREATE INDEX "bridge_connections_seller_id_status_updated_at_id_idx"
  ON "bridge_connections"("seller_id", "status", "updated_at", "id");
ALTER TABLE "bridge_connections" ADD CONSTRAINT "bridge_connections_seller_id_fkey"
  FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "bridge_services" (
  "id" TEXT NOT NULL,
  "connection_id" TEXT NOT NULL,
  "external_service_id" VARCHAR(160) NOT NULL,
  "name" VARCHAR(255) NOT NULL,
  "group_name" VARCHAR(160),
  "kind" "bridge_service_kind" NOT NULL,
  "field_schema" JSONB NOT NULL,
  "schema_hash" CHAR(64) NOT NULL,
  "available" BOOLEAN NOT NULL DEFAULT TRUE,
  "provider_metadata" JSONB,
  "last_synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "bridge_services_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "bridge_services_external_id_check" CHECK (CHAR_LENGTH(BTRIM("external_service_id")) BETWEEN 1 AND 160),
  CONSTRAINT "bridge_services_name_check" CHECK (CHAR_LENGTH(BTRIM("name")) BETWEEN 1 AND 255),
  CONSTRAINT "bridge_services_schema_hash_check" CHECK ("schema_hash" ~ '^[0-9a-f]{64}$')
);
CREATE UNIQUE INDEX "bridge_services_connection_id_external_service_id_key"
  ON "bridge_services"("connection_id", "external_service_id");
CREATE INDEX "bridge_services_connection_id_available_updated_at_id_idx"
  ON "bridge_services"("connection_id", "available", "updated_at", "id");
ALTER TABLE "bridge_services" ADD CONSTRAINT "bridge_services_connection_id_fkey"
  FOREIGN KEY ("connection_id") REFERENCES "bridge_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "bridge_service_grants" (
  "id" TEXT NOT NULL,
  "seller_id" TEXT NOT NULL,
  "service_id" TEXT NOT NULL,
  "status" "bridge_grant_status" NOT NULL DEFAULT 'active',
  "granted_by_id" TEXT NOT NULL,
  "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revoked_at" TIMESTAMP(3),
  CONSTRAINT "bridge_service_grants_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "bridge_service_grants_service_id_key" ON "bridge_service_grants"("service_id");
CREATE INDEX "bridge_service_grants_seller_id_status_granted_at_id_idx"
  ON "bridge_service_grants"("seller_id", "status", "granted_at", "id");
ALTER TABLE "bridge_service_grants" ADD CONSTRAINT "bridge_service_grants_seller_id_fkey"
  FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bridge_service_grants" ADD CONSTRAINT "bridge_service_grants_service_id_fkey"
  FOREIGN KEY ("service_id") REFERENCES "bridge_services"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bridge_service_grants" ADD CONSTRAINT "bridge_service_grants_granted_by_id_fkey"
  FOREIGN KEY ("granted_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "bridge_product_bindings" (
  "product_id" TEXT NOT NULL,
  "grant_id" TEXT NOT NULL,
  "mode" "bridge_fulfillment_mode" NOT NULL,
  "minimum_quantity" INTEGER NOT NULL DEFAULT 1,
  "maximum_quantity" INTEGER NOT NULL DEFAULT 100,
  "field_labels" JSONB NOT NULL,
  "accepted_schema_hash" CHAR(64) NOT NULL,
  "schema_review_needed" BOOLEAN NOT NULL DEFAULT FALSE,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "bridge_product_bindings_pkey" PRIMARY KEY ("product_id"),
  CONSTRAINT "bridge_product_bindings_quantity_check" CHECK (
    "minimum_quantity" BETWEEN 1 AND 100 AND
    "maximum_quantity" BETWEEN "minimum_quantity" AND 100
  ),
  CONSTRAINT "bridge_product_bindings_schema_hash_check" CHECK ("accepted_schema_hash" ~ '^[0-9a-f]{64}$')
);
CREATE INDEX "bridge_product_bindings_grant_id_mode_idx" ON "bridge_product_bindings"("grant_id", "mode");
ALTER TABLE "bridge_product_bindings" ADD CONSTRAINT "bridge_product_bindings_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bridge_product_bindings" ADD CONSTRAINT "bridge_product_bindings_grant_id_fkey"
  FOREIGN KEY ("grant_id") REFERENCES "bridge_service_grants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "seller_offer_bridge" (
  "offer_id" TEXT NOT NULL,
  CONSTRAINT "seller_offer_bridge_pkey" PRIMARY KEY ("offer_id")
);
ALTER TABLE "seller_offer_bridge" ADD CONSTRAINT "seller_offer_bridge_offer_id_fkey"
  FOREIGN KEY ("offer_id") REFERENCES "seller_offers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "bridge_fulfillments" (
  "id" TEXT NOT NULL,
  "order_item_id" TEXT NOT NULL,
  "grant_id" TEXT NOT NULL,
  "mode" "bridge_fulfillment_mode" NOT NULL,
  "status" "bridge_fulfillment_status" NOT NULL DEFAULT 'waiting_payment',
  "encrypted_input" TEXT NOT NULL,
  "encrypted_result" TEXT,
  "encryption_key_id" VARCHAR(32) NOT NULL,
  "result_encryption_key_id" VARCHAR(32),
  "schema_snapshot" JSONB NOT NULL,
  "provider_reference" VARCHAR(255),
  "submit_attempts" INTEGER NOT NULL DEFAULT 0,
  "manual_retry_count" INTEGER NOT NULL DEFAULT 0,
  "next_attempt_at" TIMESTAMP(3),
  "locked_at" TIMESTAMP(3),
  "locked_by" VARCHAR(100),
  "last_error_code" VARCHAR(64),
  "submitted_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "bridge_fulfillments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "bridge_fulfillments_attempts_check" CHECK ("submit_attempts" >= 0 AND "manual_retry_count" BETWEEN 0 AND 1)
);
CREATE UNIQUE INDEX "bridge_fulfillments_order_item_id_key" ON "bridge_fulfillments"("order_item_id");
CREATE INDEX "bridge_fulfillments_status_next_attempt_at_locked_at_idx"
  ON "bridge_fulfillments"("status", "next_attempt_at", "locked_at");
CREATE INDEX "bridge_fulfillments_grant_id_created_at_id_idx"
  ON "bridge_fulfillments"("grant_id", "created_at", "id");
ALTER TABLE "bridge_fulfillments" ADD CONSTRAINT "bridge_fulfillments_order_item_id_fkey"
  FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bridge_fulfillments" ADD CONSTRAINT "bridge_fulfillments_grant_id_fkey"
  FOREIGN KEY ("grant_id") REFERENCES "bridge_service_grants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "bridge_fulfillment_attempts" (
  "id" TEXT NOT NULL,
  "fulfillment_id" TEXT NOT NULL,
  "action" VARCHAR(32) NOT NULL,
  "request_hash" CHAR(64) NOT NULL,
  "outcome" VARCHAR(32) NOT NULL,
  "error_code" VARCHAR(64),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "bridge_fulfillment_attempts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "bridge_fulfillment_attempts_request_hash_check" CHECK ("request_hash" ~ '^[0-9a-f]{64}$')
);

CREATE TABLE "bridge_data_access_audits" (
  "id" TEXT NOT NULL,
  "fulfillment_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "access_kind" VARCHAR(32) NOT NULL,
  "accessed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "bridge_data_access_audits_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "bridge_data_access_audits_fulfillment_id_fkey" FOREIGN KEY ("fulfillment_id") REFERENCES "bridge_fulfillments"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "bridge_data_access_audits_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "bridge_data_access_audits_fulfillment_id_accessed_at_idx" ON "bridge_data_access_audits"("fulfillment_id", "accessed_at");
CREATE INDEX "bridge_data_access_audits_user_id_accessed_at_idx" ON "bridge_data_access_audits"("user_id", "accessed_at");
CREATE INDEX "bridge_fulfillment_attempts_fulfillment_id_created_at_idx"
  ON "bridge_fulfillment_attempts"("fulfillment_id", "created_at");
ALTER TABLE "bridge_fulfillment_attempts" ADD CONSTRAINT "bridge_fulfillment_attempts_fulfillment_id_fkey"
  FOREIGN KEY ("fulfillment_id") REFERENCES "bridge_fulfillments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "payment_attempts" (
  "id" TEXT NOT NULL,
  "order_id" TEXT NOT NULL,
  "provider" VARCHAR(32) NOT NULL,
  "status" "payment_attempt_status" NOT NULL DEFAULT 'created',
  "amount" DECIMAL(20,4) NOT NULL,
  "currency" CHAR(3) NOT NULL,
  "idempotency_key" UUID NOT NULL,
  "authority" VARCHAR(64),
  "provider_ref_id" VARCHAR(100),
  "failure_code" VARCHAR(64),
  "verified_at" TIMESTAMP(3),
  "refunded_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payment_attempts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "payment_attempts_amount_check" CHECK ("amount" > 0 AND SCALE("amount") = 0),
  CONSTRAINT "payment_attempts_currency_check" CHECK ("currency" = 'IRR')
);
CREATE UNIQUE INDEX "payment_attempts_authority_key" ON "payment_attempts"("authority");
CREATE UNIQUE INDEX "payment_attempts_provider_ref_id_key" ON "payment_attempts"("provider_ref_id");
CREATE UNIQUE INDEX "payment_attempts_order_id_idempotency_key_key"
  ON "payment_attempts"("order_id", "idempotency_key");
CREATE INDEX "payment_attempts_order_id_status_created_at_idx"
  ON "payment_attempts"("order_id", "status", "created_at");
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_order_id_fkey"
  FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "otp_challenges" (
  "id" TEXT NOT NULL,
  "phone_number" VARCHAR(16) NOT NULL,
  "code_hash" CHAR(64) NOT NULL,
  "status" "otp_status" NOT NULL DEFAULT 'pending',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "consumed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "otp_challenges_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "otp_challenges_phone_check" CHECK ("phone_number" ~ '^\+989[0-9]{9}$'),
  CONSTRAINT "otp_challenges_attempts_check" CHECK ("attempts" BETWEEN 0 AND 5),
  CONSTRAINT "otp_challenges_hash_check" CHECK ("code_hash" ~ '^[0-9a-f]{64}$')
);
CREATE INDEX "otp_challenges_phone_number_status_created_at_idx"
  ON "otp_challenges"("phone_number", "status", "created_at");
CREATE INDEX "otp_challenges_expires_at_idx" ON "otp_challenges"("expires_at");

CREATE TABLE "sms_deliveries" (
  "id" TEXT NOT NULL,
  "dedupe_key" VARCHAR(160) NOT NULL,
  "recipient" VARCHAR(16) NOT NULL,
  "template" VARCHAR(64) NOT NULL,
  "parameters" JSONB NOT NULL,
  "status" "notification_status" NOT NULL DEFAULT 'pending',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "next_attempt_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "locked_at" TIMESTAMP(3),
  "last_error" VARCHAR(200),
  "sent_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sms_deliveries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "sms_deliveries_recipient_check" CHECK ("recipient" ~ '^\+989[0-9]{9}$'),
  CONSTRAINT "sms_deliveries_attempts_check" CHECK ("attempts" >= 0)
);
CREATE UNIQUE INDEX "sms_deliveries_dedupe_key_key" ON "sms_deliveries"("dedupe_key");
CREATE INDEX "sms_deliveries_status_next_attempt_at_locked_at_idx"
  ON "sms_deliveries"("status", "next_attempt_at", "locked_at");

-- A grant must belong to the seller who owns the upstream connection.
CREATE FUNCTION "check_bridge_grant_owner"() RETURNS TRIGGER AS $$
DECLARE connection_seller_id TEXT;
BEGIN
  SELECT c."seller_id" INTO connection_seller_id
  FROM "bridge_services" s JOIN "bridge_connections" c ON c."id" = s."connection_id"
  WHERE s."id" = NEW."service_id";
  IF connection_seller_id IS NULL OR connection_seller_id <> NEW."seller_id" THEN
    RAISE EXCEPTION 'Bridge grant seller must own the service connection';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "bridge_service_grants_owner_check"
BEFORE INSERT OR UPDATE OF "seller_id", "service_id" ON "bridge_service_grants"
FOR EACH ROW EXECUTE FUNCTION "check_bridge_grant_owner"();

-- A Bridge binding cannot be attached to another seller's product.
CREATE FUNCTION "check_bridge_product_owner"() RETURNS TRIGGER AS $$
DECLARE product_seller_id TEXT; grant_seller_id TEXT; target_type "product_type";
BEGIN
  SELECT "created_by_seller_id", "type" INTO product_seller_id, target_type
  FROM "products" WHERE "id" = NEW."product_id";
  SELECT "seller_id" INTO grant_seller_id FROM "bridge_service_grants" WHERE "id" = NEW."grant_id";
  IF target_type <> 'bridge' OR product_seller_id IS NULL OR grant_seller_id IS NULL OR product_seller_id <> grant_seller_id THEN
    RAISE EXCEPTION 'Bridge product and service grant must belong to the same seller';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "bridge_product_bindings_owner_check"
BEFORE INSERT OR UPDATE OF "product_id", "grant_id" ON "bridge_product_bindings"
FOR EACH ROW EXECUTE FUNCTION "check_bridge_product_owner"();

-- Extend the existing deferred offer-detail invariant to Bridge offers.
DROP TRIGGER "seller_offers_fulfillment_check" ON "seller_offers";
DROP TRIGGER "seller_offer_digital_fulfillment_check" ON "seller_offer_digital";
DROP TRIGGER "seller_offer_physical_fulfillment_check" ON "seller_offer_physical";
DROP TRIGGER "seller_offer_service_fulfillment_check" ON "seller_offer_service";
DROP FUNCTION "check_seller_offer_fulfillment"();

CREATE FUNCTION "check_seller_offer_fulfillment"() RETURNS TRIGGER AS $$
DECLARE
  target_offer_id TEXT;
  expected_type "product_type";
  digital_count INTEGER;
  physical_count INTEGER;
  service_count INTEGER;
  bridge_count INTEGER;
BEGIN
  IF TG_TABLE_NAME = 'seller_offers' THEN
    target_offer_id := CASE WHEN TG_OP = 'DELETE' THEN OLD."id" ELSE NEW."id" END;
  ELSE
    target_offer_id := CASE WHEN TG_OP = 'DELETE' THEN OLD."offer_id" ELSE NEW."offer_id" END;
  END IF;
  SELECT p."type" INTO expected_type
  FROM "seller_offers" o
  JOIN "seller_listings" l ON l."id" = o."listing_id"
  JOIN "products" p ON p."id" = l."product_id"
  WHERE o."id" = target_offer_id;
  IF expected_type IS NULL THEN RETURN NULL; END IF;
  SELECT COUNT(*) INTO digital_count FROM "seller_offer_digital" WHERE "offer_id" = target_offer_id;
  SELECT COUNT(*) INTO physical_count FROM "seller_offer_physical" WHERE "offer_id" = target_offer_id;
  SELECT COUNT(*) INTO service_count FROM "seller_offer_service" WHERE "offer_id" = target_offer_id;
  SELECT COUNT(*) INTO bridge_count FROM "seller_offer_bridge" WHERE "offer_id" = target_offer_id;
  IF (expected_type = 'digital' AND (digital_count <> 1 OR physical_count <> 0 OR service_count <> 0 OR bridge_count <> 0))
     OR (expected_type = 'physical' AND (digital_count <> 0 OR physical_count <> 1 OR service_count <> 0 OR bridge_count <> 0))
     OR (expected_type = 'service' AND (digital_count <> 0 OR physical_count <> 0 OR service_count <> 1 OR bridge_count <> 0))
     OR (expected_type = 'bridge' AND (digital_count <> 0 OR physical_count <> 0 OR service_count <> 0 OR bridge_count <> 1)) THEN
    RAISE EXCEPTION 'Seller offer fulfillment data does not match its product type';
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
CREATE CONSTRAINT TRIGGER "seller_offers_fulfillment_check" AFTER INSERT OR UPDATE ON "seller_offers"
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "check_seller_offer_fulfillment"();
CREATE CONSTRAINT TRIGGER "seller_offer_digital_fulfillment_check" AFTER INSERT OR UPDATE OR DELETE ON "seller_offer_digital"
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "check_seller_offer_fulfillment"();
CREATE CONSTRAINT TRIGGER "seller_offer_physical_fulfillment_check" AFTER INSERT OR UPDATE OR DELETE ON "seller_offer_physical"
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "check_seller_offer_fulfillment"();
CREATE CONSTRAINT TRIGGER "seller_offer_service_fulfillment_check" AFTER INSERT OR UPDATE OR DELETE ON "seller_offer_service"
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "check_seller_offer_fulfillment"();
CREATE CONSTRAINT TRIGGER "seller_offer_bridge_fulfillment_check" AFTER INSERT OR UPDATE OR DELETE ON "seller_offer_bridge"
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "check_seller_offer_fulfillment"();
