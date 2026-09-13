ALTER TABLE "product_change_events"
  ADD COLUMN "bulk_operation_id" TEXT;

CREATE INDEX "product_change_events_bulk_operation_id_idx"
  ON "product_change_events"("bulk_operation_id");

CREATE UNIQUE INDEX "product_change_events_bulk_operation_id_restored_from_event_id_key"
  ON "product_change_events"("bulk_operation_id", "restored_from_event_id");

ALTER TABLE "auth_rate_limits"
  DROP CONSTRAINT "auth_rate_limits_action_check",
  ADD CONSTRAINT "auth_rate_limits_action_check" CHECK (
    "action" IN ('login','register','order','payout','media','otp','payment','payment_callback','payment_refund','staff_setup','bridge','signed_ticket','ai_profile','ai_run','product_bulk_undo')
  );
