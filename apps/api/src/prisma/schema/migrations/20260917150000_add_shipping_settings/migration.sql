SET lock_timeout = '5s';
SET statement_timeout = '30s';

CREATE TABLE "shipping_settings" (
  "id" SMALLINT NOT NULL DEFAULT 1,
  "amadast_enabled" BOOLEAN NOT NULL DEFAULT false,
  "encrypted_client_code" TEXT,
  "encryption_key_id" VARCHAR(32),
  "client_code_hint" VARCHAR(4),
  "user_id" INTEGER,
  "store_id" INTEGER,
  "sender_name" VARCHAR(200),
  "sender_mobile" VARCHAR(16),
  "product_type" INTEGER NOT NULL DEFAULT 1,
  "package_type" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "shipping_settings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "shipping_settings_singleton_check" CHECK ("id" = 1),
  CONSTRAINT "shipping_settings_user_id_check" CHECK ("user_id" IS NULL OR "user_id" > 0),
  CONSTRAINT "shipping_settings_store_id_check" CHECK ("store_id" IS NULL OR "store_id" > 0),
  CONSTRAINT "shipping_settings_product_type_check" CHECK ("product_type" > 0),
  CONSTRAINT "shipping_settings_package_type_check" CHECK ("package_type" > 0),
  CONSTRAINT "shipping_settings_sender_mobile_check" CHECK ("sender_mobile" IS NULL OR "sender_mobile" ~ '^09[0-9]{9}$')
);

CREATE TABLE "shipping_setting_events" (
  "id" TEXT NOT NULL,
  "settings_id" SMALLINT NOT NULL,
  "actor_user_id" TEXT NOT NULL,
  "amadast_enabled" BOOLEAN NOT NULL,
  "credentials_changed" BOOLEAN NOT NULL DEFAULT false,
  "client_code_hint" VARCHAR(4),
  "user_id" INTEGER,
  "store_id" INTEGER,
  "sender_name" VARCHAR(200),
  "sender_mobile" VARCHAR(16),
  "product_type" INTEGER NOT NULL,
  "package_type" INTEGER NOT NULL,
  "changed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "shipping_setting_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "shipping_setting_events_settings_id_fkey" FOREIGN KEY ("settings_id") REFERENCES "shipping_settings"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "shipping_setting_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "shipping_setting_events_settings_id_changed_at_id_idx" ON "shipping_setting_events"("settings_id", "changed_at" DESC, "id" DESC);
CREATE INDEX "shipping_setting_events_actor_user_id_changed_at_id_idx" ON "shipping_setting_events"("actor_user_id", "changed_at" DESC, "id" DESC);

ALTER TABLE "auth_rate_limits" DROP CONSTRAINT "auth_rate_limits_action_check";
ALTER TABLE "auth_rate_limits" ADD CONSTRAINT "auth_rate_limits_action_check" CHECK (
  "action" IN ('login','register','order','shipping','shipping_configuration','payout','media','otp','payment','payment_callback','payment_refund','payment_configuration','sms_configuration','staff_setup','bridge','signed_ticket','ai_profile','ai_profile_test','ai_run','product_bulk_undo','checkout_quote')
);

RESET lock_timeout;
RESET statement_timeout;
