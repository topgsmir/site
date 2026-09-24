SET lock_timeout = '5s';
SET statement_timeout = '30s';

ALTER TABLE "shipping_settings"
  ADD COLUMN "provider" VARCHAR(32) NOT NULL DEFAULT 'amadast',
  ADD CONSTRAINT "shipping_settings_provider_check"
    CHECK ("provider" ~ '^[a-z][a-z0-9_-]{1,31}$');

ALTER TABLE "shipping_setting_events"
  ADD COLUMN "provider" VARCHAR(32) NOT NULL DEFAULT 'amadast',
  ADD CONSTRAINT "shipping_setting_events_provider_check"
    CHECK ("provider" ~ '^[a-z][a-z0-9_-]{1,31}$');

ALTER TABLE "amadast_shipments"
  ADD COLUMN "provider" VARCHAR(32) NOT NULL DEFAULT 'amadast',
  ADD COLUMN "provider_order_reference" VARCHAR(200),
  ADD COLUMN "claim_token" UUID,
  ADD CONSTRAINT "amadast_shipments_provider_check"
    CHECK ("provider" ~ '^[a-z][a-z0-9_-]{1,31}$');

CREATE UNIQUE INDEX "amadast_shipments_provider_order_reference_key"
  ON "amadast_shipments"("provider", "provider_order_reference");

RESET lock_timeout;
RESET statement_timeout;
