ALTER TABLE "payment_method_configs"
  ADD COLUMN "encrypted_credentials" TEXT,
  ADD COLUMN "encryption_key_id" VARCHAR(32),
  ADD COLUMN "merchant_id_hint" VARCHAR(4),
  ADD COLUMN "refund_token_hint" VARCHAR(4),
  ADD CONSTRAINT "payment_method_configs_credential_envelope_check" CHECK (
    ("encrypted_credentials" IS NULL AND "encryption_key_id" IS NULL)
    OR
    ("encrypted_credentials" IS NOT NULL AND "encryption_key_id" IS NOT NULL)
  );

COMMENT ON COLUMN "payment_method_configs"."encrypted_credentials" IS
  'AES-256-GCM envelope; plaintext payment credentials must never be stored here.';

-- Existing environment-backed providers must be explicitly reconfigured through
-- the admin panel before accepting new payments.
UPDATE "payment_method_configs"
SET "enabled" = false, "updated_at" = CURRENT_TIMESTAMP
WHERE "provider_code" = 'zarinpal';

ALTER TABLE "auth_rate_limits"
  DROP CONSTRAINT "auth_rate_limits_action_check",
  ADD CONSTRAINT "auth_rate_limits_action_check"
    CHECK (
      "action" IN (
        'login','register','order','payout','media','otp','payment',
        'payment_callback','payment_refund','payment_configuration','staff_setup',
        'bridge','signed_ticket','ai_profile','ai_run','product_bulk_undo'
      )
    );

CREATE TABLE "payment_method_config_events" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "provider_code" VARCHAR(32) NOT NULL,
  "actor_user_id" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL,
  "changed_fields" TEXT[] NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payment_method_config_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "payment_method_config_events_provider_code_fkey"
    FOREIGN KEY ("provider_code") REFERENCES "payment_method_configs"("provider_code")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "payment_method_config_events_actor_user_id_fkey"
    FOREIGN KEY ("actor_user_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "payment_method_config_events_provider_code_created_at_id_idx"
  ON "payment_method_config_events" ("provider_code", "created_at" DESC, "id" DESC);
CREATE INDEX "payment_method_config_events_actor_user_id_created_at_id_idx"
  ON "payment_method_config_events" ("actor_user_id", "created_at" DESC, "id" DESC);
