CREATE INDEX CONCURRENTLY IF NOT EXISTS "payment_attempts_status_created_at_id_idx"
ON "payment_attempts" ("status", "created_at" DESC, "id" DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "payment_attempts_provider_created_at_id_idx"
ON "payment_attempts" ("provider", "created_at" DESC, "id" DESC);
