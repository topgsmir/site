SET lock_timeout = '5s';
SET statement_timeout = '30s';

ALTER TABLE "sellers"
  ADD COLUMN "goghdi_agent_id" VARCHAR(24);

ALTER TABLE "sellers"
  ADD CONSTRAINT "sellers_goghdi_agent_id_format_check"
  CHECK ("goghdi_agent_id" IS NULL OR "goghdi_agent_id" ~ '^[0-9a-fA-F]{24}$') NOT VALID;

ALTER TABLE "sellers" VALIDATE CONSTRAINT "sellers_goghdi_agent_id_format_check";

CREATE UNIQUE INDEX "sellers_goghdi_agent_id_key"
  ON "sellers"("goghdi_agent_id");

CREATE TABLE "goghdi_settings" (
  "id" SMALLINT NOT NULL DEFAULT 1,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "sdk_url" VARCHAR(2048),
  "tenant_id" VARCHAR(100),
  "api_url" VARCHAR(2048),
  "socket_url" VARCHAR(2048),
  "widget_url" VARCHAR(2048),
  "encrypted_tenant_secret" TEXT,
  "encryption_key_id" VARCHAR(32),
  "tenant_secret_hint" VARCHAR(8),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "goghdi_settings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "goghdi_settings_singleton_check" CHECK ("id" = 1),
  CONSTRAINT "goghdi_settings_secret_pair_check" CHECK (
    ("encrypted_tenant_secret" IS NULL) = ("encryption_key_id" IS NULL)
  )
);

CREATE TABLE "goghdi_setting_events" (
  "id" UUID NOT NULL,
  "settings_id" SMALLINT NOT NULL,
  "actor_user_id" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL,
  "changed_fields" TEXT[] NOT NULL,
  "credentials_changed" BOOLEAN NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "goghdi_setting_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "goghdi_setting_events_settings_id_fkey"
    FOREIGN KEY ("settings_id") REFERENCES "goghdi_settings"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "goghdi_setting_events_actor_user_id_fkey"
    FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "goghdi_setting_events_settings_id_created_at_id_idx"
  ON "goghdi_setting_events"("settings_id", "created_at" DESC, "id" DESC);
CREATE INDEX "goghdi_setting_events_actor_user_id_created_at_id_idx"
  ON "goghdi_setting_events"("actor_user_id", "created_at" DESC, "id" DESC);

ALTER TABLE "auth_rate_limits" ADD CONSTRAINT "auth_rate_limits_action_goghdi_check" CHECK (
  "action" IN ('login','register','order','shipping','shipping_configuration','payout','media','otp','payment','payment_callback','payment_refund','payment_configuration','sms_configuration','staff_setup','bridge','signed_ticket','ai_profile','ai_profile_test','ai_run','product_bulk_undo','checkout_quote','analytics','auth_configuration','captcha_challenge','comment_submit','comment_reply','comment_admin','profile','goghdi_configuration')
) NOT VALID;
ALTER TABLE "auth_rate_limits" VALIDATE CONSTRAINT "auth_rate_limits_action_goghdi_check";
ALTER TABLE "auth_rate_limits" DROP CONSTRAINT "auth_rate_limits_action_check";
ALTER TABLE "auth_rate_limits" RENAME CONSTRAINT "auth_rate_limits_action_goghdi_check" TO "auth_rate_limits_action_check";

RESET statement_timeout;
RESET lock_timeout;
