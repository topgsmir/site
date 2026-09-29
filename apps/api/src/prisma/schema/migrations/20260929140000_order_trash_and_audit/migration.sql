ALTER TABLE "orders" ADD COLUMN "trashed_at" TIMESTAMPTZ(3);
ALTER TABLE "order_events" ADD COLUMN "action" VARCHAR(32) NOT NULL DEFAULT 'status_changed';

CREATE INDEX CONCURRENTLY "orders_trashed_at_created_at_id_idx"
  ON "orders"("trashed_at", "created_at" DESC, "id" DESC);

ALTER TABLE "order_events" ADD CONSTRAINT "order_events_action_check"
  CHECK ("action" IN ('status_changed', 'trashed', 'restored')) NOT VALID;
ALTER TABLE "order_events" VALIDATE CONSTRAINT "order_events_action_check";
