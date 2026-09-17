SET lock_timeout = '5s';
SET statement_timeout = '30s';

CREATE TABLE "amadast_shipments" (
  "id" INTEGER GENERATED ALWAYS AS IDENTITY,
  "order_id" TEXT NOT NULL,
  "status" VARCHAR(32) NOT NULL DEFAULT 'registering',
  "provider_order_id" INTEGER,
  "amadast_tracking_code" VARCHAR(200),
  "courier_tracking_code" VARCHAR(200),
  "courier_title" VARCHAR(100),
  "idempotency_key" UUID NOT NULL,
  "request_hash" CHAR(64) NOT NULL,
  "attempt_count" INTEGER NOT NULL DEFAULT 0,
  "last_error_code" VARCHAR(64),
  "last_attempted_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "registered_at" TIMESTAMPTZ(3),
  "tracking_synced_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "amadast_shipments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "amadast_shipments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "amadast_shipments_status_check" CHECK ("status" IN ('registering', 'registered', 'tracking_available', 'failed')),
  CONSTRAINT "amadast_shipments_attempt_count_check" CHECK ("attempt_count" >= 0),
  CONSTRAINT "amadast_shipments_tracking_check" CHECK (
    "status" <> 'tracking_available' OR "amadast_tracking_code" IS NOT NULL OR "courier_tracking_code" IS NOT NULL
  )
);

CREATE UNIQUE INDEX "amadast_shipments_order_id_key" ON "amadast_shipments"("order_id");
CREATE UNIQUE INDEX "amadast_shipments_provider_order_id_key" ON "amadast_shipments"("provider_order_id");
CREATE UNIQUE INDEX "amadast_shipments_idempotency_key_key" ON "amadast_shipments"("idempotency_key");
CREATE INDEX "amadast_shipments_status_updated_at_idx" ON "amadast_shipments"("status", "updated_at");

ALTER TABLE "auth_rate_limits" DROP CONSTRAINT "auth_rate_limits_action_check";
ALTER TABLE "auth_rate_limits" ADD CONSTRAINT "auth_rate_limits_action_check" CHECK (
  "action" IN ('login','register','order','shipping','payout','media','otp','payment','payment_callback','payment_refund','payment_configuration','sms_configuration','staff_setup','bridge','signed_ticket','ai_profile','ai_profile_test','ai_run','product_bulk_undo','checkout_quote')
);

RESET lock_timeout;
RESET statement_timeout;
