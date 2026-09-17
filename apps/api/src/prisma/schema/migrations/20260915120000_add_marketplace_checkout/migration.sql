CREATE TYPE "checkout_status" AS ENUM ('pending_payment', 'partially_paid', 'paid', 'expired', 'cancelled');
CREATE TYPE "checkout_payment_group_status" AS ENUM ('pending', 'paid', 'failed', 'expired');
CREATE TYPE "inventory_reservation_status" AS ENUM ('active', 'committed', 'released');

ALTER TABLE "auth_rate_limits" DROP CONSTRAINT "auth_rate_limits_action_check";
ALTER TABLE "auth_rate_limits" ADD CONSTRAINT "auth_rate_limits_action_check" CHECK (
  "action" IN ('login','register','order','payout','media','otp','payment','payment_callback','payment_refund','payment_configuration','staff_setup','bridge','signed_ticket','ai_profile','ai_profile_test','ai_run','product_bulk_undo','checkout_quote')
);

ALTER TABLE "orders" ADD COLUMN "checkout_id" TEXT;
ALTER TABLE "order_items" ADD COLUMN "service_note" VARCHAR(2000);
ALTER TABLE "order_items" ADD COLUMN "digital_delivery_url" VARCHAR(2048);
ALTER TABLE "order_items" ADD COLUMN "digital_max_downloads" INTEGER;
DROP INDEX IF EXISTS "order_items_order_id_key";
ALTER TABLE "payment_attempts" ADD COLUMN "checkout_payment_group_id" TEXT;
ALTER TABLE "seller_offer_digital" DROP CONSTRAINT IF EXISTS "seller_offer_digital_file_reference_check";
ALTER TABLE "seller_offer_digital" ALTER COLUMN "file_reference" TYPE VARCHAR(2048);
ALTER TABLE "seller_offer_digital" ADD CONSTRAINT "seller_offer_digital_file_reference_check" CHECK (CHAR_LENGTH(BTRIM("file_reference")) BETWEEN 1 AND 2048);
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_digital_snapshot_check" CHECK (
  ("product_type" = 'digital' AND "digital_delivery_url" IS NOT NULL AND "digital_delivery_url" ~ '^https://' AND "digital_max_downloads" >= 0)
  OR ("digital_delivery_url" IS NULL AND "digital_max_downloads" IS NULL)
);

CREATE TABLE "checkouts" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "buyer_id" TEXT NOT NULL,
  "status" "checkout_status" NOT NULL DEFAULT 'pending_payment',
  "currency" CHAR(3) NOT NULL,
  "total_amount" DECIMAL(20,4) NOT NULL,
  "idempotency_key" UUID NOT NULL,
  "request_hash" CHAR(64) NOT NULL,
  "expires_at" TIMESTAMPTZ NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "checkouts_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "users"("id") ON DELETE RESTRICT,
  CONSTRAINT "checkouts_currency_check" CHECK ("currency" = 'IRR'),
  CONSTRAINT "checkouts_total_amount_check" CHECK ("total_amount" > 0 AND "total_amount" = TRUNC("total_amount")),
  CONSTRAINT "checkouts_request_hash_check" CHECK ("request_hash" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "checkouts_buyer_id_idempotency_key_key" UNIQUE ("buyer_id", "idempotency_key")
);

CREATE TABLE "checkout_payment_groups" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "checkout_id" TEXT NOT NULL,
  "provider" VARCHAR(32) NOT NULL,
  "status" "checkout_payment_group_status" NOT NULL DEFAULT 'pending',
  "amount" DECIMAL(20,4) NOT NULL,
  "currency" CHAR(3) NOT NULL,
  "expires_at" TIMESTAMPTZ NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "checkout_payment_groups_checkout_id_fkey" FOREIGN KEY ("checkout_id") REFERENCES "checkouts"("id") ON DELETE RESTRICT,
  CONSTRAINT "checkout_payment_groups_amount_check" CHECK ("amount" > 0 AND "amount" = TRUNC("amount")),
  CONSTRAINT "checkout_payment_groups_currency_check" CHECK ("currency" = 'IRR')
);

CREATE TABLE "checkout_payment_group_orders" (
  "payment_group_id" TEXT NOT NULL,
  "order_id" TEXT NOT NULL UNIQUE,
  "amount" DECIMAL(20,4) NOT NULL,
  CONSTRAINT "checkout_payment_group_orders_pkey" PRIMARY KEY ("payment_group_id", "order_id"),
  CONSTRAINT "checkout_payment_group_orders_payment_group_id_fkey" FOREIGN KEY ("payment_group_id") REFERENCES "checkout_payment_groups"("id") ON DELETE RESTRICT,
  CONSTRAINT "checkout_payment_group_orders_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT,
  CONSTRAINT "checkout_payment_group_orders_amount_check" CHECK ("amount" > 0 AND "amount" = TRUNC("amount"))
);

CREATE TABLE "order_shipping_addresses" (
  "order_id" TEXT PRIMARY KEY,
  "recipient_name" VARCHAR(120) NOT NULL,
  "phone_number" VARCHAR(16) NOT NULL,
  "province" VARCHAR(100) NOT NULL,
  "city" VARCHAR(100) NOT NULL,
  "postal_code" CHAR(10) NOT NULL,
  "address_line" VARCHAR(1000) NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "order_shipping_addresses_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT,
  CONSTRAINT "order_shipping_addresses_phone_check" CHECK ("phone_number" ~ '^\+98[0-9]{10}$'),
  CONSTRAINT "order_shipping_addresses_postal_check" CHECK ("postal_code" ~ '^[0-9]{10}$')
);

CREATE TABLE "order_shipments" (
  "order_id" TEXT PRIMARY KEY,
  "carrier" VARCHAR(100),
  "tracking_code" VARCHAR(200),
  "shipped_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "order_shipments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT,
  CONSTRAINT "order_shipments_tracking_check" CHECK ("carrier" IS NOT NULL OR "tracking_code" IS NOT NULL)
);

CREATE TABLE "inventory_reservations" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "order_item_id" TEXT NOT NULL UNIQUE,
  "offer_id" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "status" "inventory_reservation_status" NOT NULL DEFAULT 'active',
  "expires_at" TIMESTAMPTZ NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "inventory_reservations_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE RESTRICT,
  CONSTRAINT "inventory_reservations_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "seller_offers"("id") ON DELETE RESTRICT,
  CONSTRAINT "inventory_reservations_quantity_check" CHECK ("quantity" BETWEEN 1 AND 100)
);

CREATE TABLE "digital_entitlements" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "order_item_id" TEXT NOT NULL UNIQUE,
  "buyer_id" TEXT NOT NULL,
  "delivery_url" VARCHAR(2048) NOT NULL,
  "max_downloads" INTEGER NOT NULL DEFAULT 0,
  "download_count" INTEGER NOT NULL DEFAULT 0,
  "last_accessed_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "digital_entitlements_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE RESTRICT,
  CONSTRAINT "digital_entitlements_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "users"("id") ON DELETE RESTRICT,
  CONSTRAINT "digital_entitlements_url_check" CHECK ("delivery_url" ~ '^https://'),
  CONSTRAINT "digital_entitlements_downloads_check" CHECK ("max_downloads" >= 0 AND "download_count" >= 0)
);

ALTER TABLE "orders" ADD CONSTRAINT "orders_checkout_id_fkey" FOREIGN KEY ("checkout_id") REFERENCES "checkouts"("id") ON DELETE RESTRICT;
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_checkout_payment_group_id_fkey" FOREIGN KEY ("checkout_payment_group_id") REFERENCES "checkout_payment_groups"("id") ON DELETE RESTRICT;

CREATE INDEX "orders_checkout_id_created_at_id_idx" ON "orders"("checkout_id", "created_at", "id");
CREATE INDEX "order_items_order_id_idx" ON "order_items"("order_id");
CREATE INDEX "checkouts_buyer_id_created_at_id_idx" ON "checkouts"("buyer_id", "created_at" DESC, "id" DESC);
CREATE INDEX "checkouts_status_expires_at_idx" ON "checkouts"("status", "expires_at");
CREATE INDEX "checkout_payment_groups_checkout_id_created_at_id_idx" ON "checkout_payment_groups"("checkout_id", "created_at", "id");
CREATE INDEX "checkout_payment_groups_status_expires_at_idx" ON "checkout_payment_groups"("status", "expires_at");
CREATE INDEX "checkout_payment_group_orders_payment_group_id_idx" ON "checkout_payment_group_orders"("payment_group_id");
CREATE INDEX "payment_attempts_checkout_payment_group_id_status_created_at_idx" ON "payment_attempts"("checkout_payment_group_id", "status", "created_at");
CREATE INDEX "inventory_reservations_status_expires_at_idx" ON "inventory_reservations"("status", "expires_at");
CREATE INDEX "inventory_reservations_offer_id_status_idx" ON "inventory_reservations"("offer_id", "status");
CREATE INDEX "digital_entitlements_buyer_id_created_at_id_idx" ON "digital_entitlements"("buyer_id", "created_at" DESC, "id" DESC);

-- Existing pending physical orders already reduced stock. Recording them as active
-- reservations lets the expiry/cancellation path restore that stock exactly once.
INSERT INTO "inventory_reservations" ("order_item_id", "offer_id", "quantity", "status", "expires_at")
SELECT oi."id", oi."offer_id", oi."quantity", 'active', GREATEST(o."created_at" + INTERVAL '15 minutes', CURRENT_TIMESTAMP)
FROM "order_items" oi
JOIN "orders" o ON o."id" = oi."order_id"
WHERE oi."product_type" = 'physical' AND o."status" = 'pending'
ON CONFLICT ("order_item_id") DO NOTHING;
