CREATE TABLE "auth_login_settings" (
  "id" SMALLINT NOT NULL DEFAULT 1,
  "email_password_enabled" BOOLEAN NOT NULL DEFAULT true,
  "phone_otp_enabled" BOOLEAN NOT NULL DEFAULT true,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "auth_login_settings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "auth_login_settings_singleton_check" CHECK ("id" = 1),
  CONSTRAINT "auth_login_settings_method_check" CHECK ("email_password_enabled" OR "phone_otp_enabled")
);

CREATE TABLE "auth_login_setting_events" (
  "id" TEXT NOT NULL,
  "actor_user_id" TEXT NOT NULL,
  "email_password_enabled" BOOLEAN NOT NULL,
  "phone_otp_enabled" BOOLEAN NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "auth_login_setting_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "auth_login_setting_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "auth_login_setting_events_actor_user_id_created_at_idx" ON "auth_login_setting_events"("actor_user_id", "created_at");

ALTER TABLE "auth_rate_limits" DROP CONSTRAINT "auth_rate_limits_action_check";
ALTER TABLE "auth_rate_limits" ADD CONSTRAINT "auth_rate_limits_action_check" CHECK (
  "action" IN ('login','register','order','shipping','shipping_configuration','payout','media','otp','payment','payment_callback','payment_refund','payment_configuration','sms_configuration','staff_setup','bridge','signed_ticket','ai_profile','ai_profile_test','ai_run','product_bulk_undo','checkout_quote','analytics','auth_configuration')
);
