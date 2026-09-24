SET lock_timeout = '5s';
SET statement_timeout = '30s';

ALTER TABLE "auth_rate_limits" ADD CONSTRAINT "auth_rate_limits_action_complete_check" CHECK (
  "action" IN ('login','register','order','shipping','shipping_configuration','payout','media','media_admin','otp','payment','payment_callback','payment_refund','payment_configuration','sms_configuration','staff_setup','bridge','signed_ticket','ai_profile','ai_profile_test','ai_run','product_bulk_undo','checkout_quote','analytics','auth_configuration','captcha_challenge','comment_submit','comment_reply','comment_admin','profile','goghdi_configuration','backup_admin','backup_restore','admin_user','blog','coupon','digital_download','notice_configuration','product','seller','staff_admin','usd_configuration')
) NOT VALID;
ALTER TABLE "auth_rate_limits" VALIDATE CONSTRAINT "auth_rate_limits_action_complete_check";
ALTER TABLE "auth_rate_limits" DROP CONSTRAINT "auth_rate_limits_action_check";
ALTER TABLE "auth_rate_limits" RENAME CONSTRAINT "auth_rate_limits_action_complete_check" TO "auth_rate_limits_action_check";

ALTER TABLE "security_policies" ADD CONSTRAINT "security_policies_action_complete_check" CHECK (
  "action" IN ('login','register','otp','profile','admin_user','captcha_challenge','checkout_quote','comment_submit_guest','comment_submit','comment_reply','comment_admin','blog','coupon','product','order','digital_download','shipping','shipping_configuration','payout','media','media_admin','payment','payment_callback','payment_refund','payment_configuration','sms_configuration','goghdi_configuration','auth_configuration','notice_configuration','usd_configuration','staff_admin','staff_setup','seller','bridge','signed_ticket','ai_profile','ai_profile_test','ai_run','product_bulk_undo','analytics','backup_admin','backup_restore')
) NOT VALID;
ALTER TABLE "security_policies" VALIDATE CONSTRAINT "security_policies_action_complete_check";
ALTER TABLE "security_policies" DROP CONSTRAINT "security_policies_action_check";
ALTER TABLE "security_policies" RENAME CONSTRAINT "security_policies_action_complete_check" TO "security_policies_action_check";

RESET statement_timeout;
RESET lock_timeout;
