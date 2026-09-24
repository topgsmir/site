SET lock_timeout = '5s';
SET statement_timeout = '30s';

ALTER TABLE "seller_shipping_profiles"
  ADD COLUMN "latitude" DOUBLE PRECISION,
  ADD COLUMN "longitude" DOUBLE PRECISION,
  ADD CONSTRAINT "seller_shipping_profiles_latitude_check"
    CHECK ("latitude" IS NULL OR "latitude" BETWEEN -90 AND 90),
  ADD CONSTRAINT "seller_shipping_profiles_longitude_check"
    CHECK ("longitude" IS NULL OR "longitude" BETWEEN -180 AND 180),
  ADD CONSTRAINT "seller_shipping_profiles_coordinates_check"
    CHECK (("latitude" IS NULL) = ("longitude" IS NULL));

CREATE UNIQUE INDEX "seller_shipping_profiles_ready_sender_mobile_key"
  ON "seller_shipping_profiles"("sender_mobile")
  WHERE "enabled" AND "latitude" IS NOT NULL AND "longitude" IS NOT NULL;

CREATE TABLE "shipping_provider_tenants" (
  "seller_id" TEXT NOT NULL,
  "provider" VARCHAR(32) NOT NULL,
  "status" VARCHAR(32) NOT NULL DEFAULT 'pending',
  "credential_hash" CHAR(64) NOT NULL,
  "profile_hash" CHAR(64),
  "account_reference" VARCHAR(200),
  "state" JSONB NOT NULL DEFAULT '{}',
  "claim_token" UUID,
  "attempt_count" INTEGER NOT NULL DEFAULT 0,
  "last_error_code" VARCHAR(64),
  "last_attempted_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "provisioned_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "shipping_provider_tenants_pkey" PRIMARY KEY ("seller_id", "provider"),
  CONSTRAINT "shipping_provider_tenants_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "shipping_provider_tenants_provider_check" CHECK ("provider" ~ '^[a-z][a-z0-9_-]{1,31}$'),
  CONSTRAINT "shipping_provider_tenants_status_check" CHECK ("status" IN ('pending', 'provisioning', 'ready', 'failed')),
  CONSTRAINT "shipping_provider_tenants_state_check" CHECK (jsonb_typeof("state") = 'object'),
  CONSTRAINT "shipping_provider_tenants_claim_check" CHECK (("status" = 'provisioning') = ("claim_token" IS NOT NULL)),
  CONSTRAINT "shipping_provider_tenants_attempt_count_check" CHECK ("attempt_count" >= 0),
  CONSTRAINT "shipping_provider_tenants_ready_check" CHECK (
    "status" <> 'ready' OR (
      "profile_hash" IS NOT NULL AND
      "provisioned_at" IS NOT NULL
    )
  )
);

CREATE UNIQUE INDEX "shipping_provider_tenants_provider_credential_account_key"
  ON "shipping_provider_tenants"("provider", "credential_hash", "account_reference");
CREATE INDEX "shipping_provider_tenants_provider_status_attempted_idx"
  ON "shipping_provider_tenants"("provider", "status", "last_attempted_at");

RESET lock_timeout;
RESET statement_timeout;
