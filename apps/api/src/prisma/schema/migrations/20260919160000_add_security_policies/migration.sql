CREATE TABLE "security_policies" (
  "action" VARCHAR(32) NOT NULL PRIMARY KEY,
  "ip_limit" INTEGER NOT NULL,
  "subject_limit" INTEGER NOT NULL,
  "ip_window_seconds" INTEGER NOT NULL,
  "subject_window_seconds" INTEGER NOT NULL,
  "captcha_enabled" BOOLEAN NOT NULL DEFAULT false,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  CONSTRAINT "security_policies_action_check" CHECK ("action" IN (
    'login','register','otp','captcha_challenge','checkout_quote','comment_submit_guest','comment_submit',
    'comment_reply','comment_admin','order','shipping','shipping_configuration','payout','media',
    'payment','payment_callback','payment_refund','payment_configuration','sms_configuration',
    'auth_configuration','staff_setup','bridge','signed_ticket','ai_profile','ai_profile_test',
    'ai_run','product_bulk_undo','analytics'
  )),
  CONSTRAINT "security_policies_ip_limit_check" CHECK ("ip_limit" BETWEEN 1 AND 1000),
  CONSTRAINT "security_policies_subject_limit_check" CHECK ("subject_limit" BETWEEN 1 AND 1000),
  CONSTRAINT "security_policies_ip_window_check" CHECK ("ip_window_seconds" BETWEEN 60 AND 86400),
  CONSTRAINT "security_policies_subject_window_check" CHECK ("subject_window_seconds" BETWEEN 60 AND 86400)
);

CREATE TABLE "security_policy_events" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "actor_user_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "action" VARCHAR(32) NOT NULL,
  "ip_limit" INTEGER NOT NULL,
  "subject_limit" INTEGER NOT NULL,
  "ip_window_seconds" INTEGER NOT NULL,
  "subject_window_seconds" INTEGER NOT NULL,
  "captcha_enabled" BOOLEAN NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT now()
);
CREATE INDEX "security_policy_events_actor_user_id_created_at_idx" ON "security_policy_events"("actor_user_id", "created_at");
