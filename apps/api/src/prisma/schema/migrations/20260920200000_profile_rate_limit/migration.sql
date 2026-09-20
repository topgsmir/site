SET lock_timeout = '5s';

ALTER TABLE "auth_rate_limits" ADD CONSTRAINT "auth_rate_limits_action_profile_check" CHECK (
  "action" IN ('login','register','order','shipping','shipping_configuration','payout','media','otp','payment','payment_callback','payment_refund','payment_configuration','sms_configuration','staff_setup','bridge','signed_ticket','ai_profile','ai_profile_test','ai_run','product_bulk_undo','checkout_quote','analytics','auth_configuration','captcha_challenge','comment_submit','comment_reply','comment_admin','profile')
) NOT VALID;

ALTER TABLE "auth_rate_limits" VALIDATE CONSTRAINT "auth_rate_limits_action_profile_check";
ALTER TABLE "auth_rate_limits" DROP CONSTRAINT "auth_rate_limits_action_check";
ALTER TABLE "auth_rate_limits" RENAME CONSTRAINT "auth_rate_limits_action_profile_check" TO "auth_rate_limits_action_check";

RESET lock_timeout;
