SET lock_timeout = '5s';
SET statement_timeout = '30s';

-- Some existing installations applied the original Amadast-tenant migration
-- before the provider-neutral table replaced it. Create the current table in
-- those databases without changing installations that already have it.
CREATE TABLE IF NOT EXISTS "shipping_provider_tenants" (
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

ALTER TABLE "shipping_provider_tenants"
  ADD COLUMN IF NOT EXISTS "claim_token" UUID;

CREATE UNIQUE INDEX IF NOT EXISTS "shipping_provider_tenants_provider_credential_account_key"
  ON "shipping_provider_tenants"("provider", "credential_hash", "account_reference");
CREATE INDEX IF NOT EXISTS "shipping_provider_tenants_provider_status_attempted_idx"
  ON "shipping_provider_tenants"("provider", "status", "last_attempted_at");

-- Preserve provisioned accounts from the legacy provider-specific table. The
-- dynamic statement keeps this migration valid on clean databases where that
-- table never existed.
DO $migration$
BEGIN
  IF to_regclass('public.amadast_tenants') IS NOT NULL THEN
    EXECUTE $copy$
      INSERT INTO "shipping_provider_tenants" (
        "seller_id",
        "provider",
        "status",
        "credential_hash",
        "profile_hash",
        "account_reference",
        "state",
        "attempt_count",
        "last_error_code",
        "last_attempted_at",
        "provisioned_at",
        "created_at",
        "updated_at"
      )
      SELECT
        "seller_id",
        'amadast',
        CASE
          WHEN "status" = 'ready' AND "origin_hash" IS NOT NULL AND "provisioned_at" IS NOT NULL THEN 'ready'
          WHEN "status" = 'failed' THEN 'failed'
          ELSE 'pending'
        END,
        "client_code_hash",
        "origin_hash",
        "provider_user_id"::TEXT,
        jsonb_strip_nulls(jsonb_build_object(
          'userId', "provider_user_id",
          'locationId', "provider_location_id",
          'storeId', "provider_store_id"
        )),
        "attempt_count",
        "last_error_code",
        "last_attempted_at",
        "provisioned_at",
        "created_at",
        "updated_at"
      FROM "amadast_tenants"
      ON CONFLICT DO NOTHING
    $copy$;
  END IF;
END
$migration$;

-- Existing rows keep using provider_order_id through the application's
-- compatibility read path. Avoid an unbounded table rewrite during deploy;
-- all newly registered shipments write provider_order_reference directly.

RESET lock_timeout;
RESET statement_timeout;
