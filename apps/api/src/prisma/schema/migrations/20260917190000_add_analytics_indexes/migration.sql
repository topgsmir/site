-- Analytics reads recognize revenue from the immutable paid transition and keep
-- refund and payout scans bounded by their actual accounting timestamps.
CREATE INDEX "order_events_paid_created_at_order_id_idx"
ON "order_events" ("created_at" DESC, "order_id")
WHERE "to_status" = 'paid';

CREATE INDEX "payment_refunds_succeeded_completed_at_attempt_id_idx"
ON "payment_refunds" ("completed_at" DESC, "payment_attempt_id")
WHERE "status" = 'succeeded';

CREATE INDEX "payout_ledger_settled_at_seller_id_idx"
ON "payout_ledger" ("settled_at" DESC, "seller_id")
WHERE "status" = 'settled';

ALTER TABLE "auth_rate_limits" DROP CONSTRAINT "auth_rate_limits_action_check";
ALTER TABLE "auth_rate_limits" ADD CONSTRAINT "auth_rate_limits_action_check" CHECK (
  "action" IN ('login','register','order','shipping','shipping_configuration','payout','media','otp','payment','payment_callback','payment_refund','payment_configuration','sms_configuration','staff_setup','bridge','signed_ticket','ai_profile','ai_profile_test','ai_run','product_bulk_undo','checkout_quote','analytics')
);
