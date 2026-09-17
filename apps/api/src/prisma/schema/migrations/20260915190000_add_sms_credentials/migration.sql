BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

ALTER TABLE "auth_rate_limits"
  DROP CONSTRAINT "auth_rate_limits_action_check",
  ADD CONSTRAINT "auth_rate_limits_action_check" CHECK (
    "action" IN ('login','register','order','payout','media','otp','payment','payment_callback','payment_refund','payment_configuration','sms_configuration','staff_setup','bridge','signed_ticket','ai_profile','ai_profile_test','ai_run','product_bulk_undo','checkout_quote')
  );

ALTER TABLE "sms_settings"
  ADD COLUMN "encrypted_api_key" TEXT,
  ADD COLUMN "encryption_key_id" TEXT,
  ADD COLUMN "api_key_hint" TEXT,
  ADD COLUMN "otp_template_id" INTEGER,
  ADD COLUMN "seller_new_order_template_id" INTEGER,
  ADD COLUMN "buyer_success_template_id" INTEGER,
  ADD COLUMN "buyer_failure_template_id" INTEGER,
  ADD CONSTRAINT "sms_settings_encryption_check" CHECK (
    ("encrypted_api_key" IS NULL) = ("encryption_key_id" IS NULL)
    AND ("encrypted_api_key" IS NOT NULL OR "api_key_hint" IS NULL)
  ),
  ADD CONSTRAINT "sms_settings_api_key_hint_check" CHECK (
    "api_key_hint" IS NULL OR CHAR_LENGTH("api_key_hint") BETWEEN 1 AND 8
  ),
  ADD CONSTRAINT "sms_settings_encryption_key_id_check" CHECK (
    "encryption_key_id" IS NULL OR CHAR_LENGTH("encryption_key_id") BETWEEN 1 AND 32
  ),
  ADD CONSTRAINT "sms_settings_template_ids_check" CHECK (
    ("otp_template_id" IS NULL OR "otp_template_id" > 0)
    AND ("seller_new_order_template_id" IS NULL OR "seller_new_order_template_id" > 0)
    AND ("buyer_success_template_id" IS NULL OR "buyer_success_template_id" > 0)
    AND ("buyer_failure_template_id" IS NULL OR "buyer_failure_template_id" > 0)
  );

ALTER TABLE "sms_setting_events"
  ADD COLUMN "credentials_changed" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "api_key_hint" TEXT,
  ADD COLUMN "otp_template_id" INTEGER,
  ADD COLUMN "seller_new_order_template_id" INTEGER,
  ADD COLUMN "buyer_success_template_id" INTEGER,
  ADD COLUMN "buyer_failure_template_id" INTEGER,
  ADD CONSTRAINT "sms_setting_events_api_key_hint_check" CHECK (
    "api_key_hint" IS NULL OR CHAR_LENGTH("api_key_hint") BETWEEN 1 AND 8
  ),
  ADD CONSTRAINT "sms_setting_events_template_ids_check" CHECK (
    ("otp_template_id" IS NULL OR "otp_template_id" > 0)
    AND ("seller_new_order_template_id" IS NULL OR "seller_new_order_template_id" > 0)
    AND ("buyer_success_template_id" IS NULL OR "buyer_success_template_id" > 0)
    AND ("buyer_failure_template_id" IS NULL OR "buyer_failure_template_id" > 0)
  );

COMMIT;
