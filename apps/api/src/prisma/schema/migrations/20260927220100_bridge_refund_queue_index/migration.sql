-- Keep admin refund-request pages bounded and ordered without a full table scan.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "bridge_fulfillments_status_created_at_id_idx"
  ON "bridge_fulfillments" ("status", "created_at", "id");
