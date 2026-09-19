CREATE TABLE "captcha_challenges" (
  "id" UUID NOT NULL,
  "action" VARCHAR(32) NOT NULL,
  "nonce" VARCHAR(32) NOT NULL,
  "difficulty" SMALLINT NOT NULL,
  "expires_at" TIMESTAMPTZ(3) NOT NULL,
  "consumed_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  CONSTRAINT "captcha_challenges_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "captcha_challenges_difficulty_check" CHECK ("difficulty" BETWEEN 1 AND 24),
  CONSTRAINT "captcha_challenges_action_check" CHECK ("action" ~ '^[A-Za-z0-9_-]{1,32}$'),
  CONSTRAINT "captcha_challenges_expires_at_check" CHECK ("expires_at" > "created_at")
);

CREATE INDEX "captcha_challenges_expires_at_idx" ON "captcha_challenges"("expires_at");

ALTER TABLE "auth_rate_limits" DROP CONSTRAINT "auth_rate_limits_action_check";
ALTER TABLE "auth_rate_limits" ADD CONSTRAINT "auth_rate_limits_action_check" CHECK (
  "action" IN ('login','register','order','shipping','shipping_configuration','payout','media','otp','payment','payment_callback','payment_refund','payment_configuration','sms_configuration','staff_setup','bridge','signed_ticket','ai_profile','ai_profile_test','ai_run','product_bulk_undo','checkout_quote','analytics','auth_configuration','captcha_challenge')
);
