-- Keep the platform-wide cursor scan and status filter ordered.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "orders_created_at_id_idx"
  ON "orders" ("created_at" DESC, "id" DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS "orders_status_created_at_id_idx"
  ON "orders" ("status", "created_at" DESC, "id" DESC);

-- The existing pg_trgm extension supports contains/ILIKE searches across the directory.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "orders_id_trgm_idx"
  ON "orders" USING GIN ("id" gin_trgm_ops);
CREATE INDEX CONCURRENTLY IF NOT EXISTS "orders_traffic_source_trgm_idx"
  ON "orders" USING GIN ("traffic_source" gin_trgm_ops);
CREATE INDEX CONCURRENTLY IF NOT EXISTS "users_full_name_trgm_idx"
  ON "users" USING GIN ("full_name" gin_trgm_ops);
CREATE INDEX CONCURRENTLY IF NOT EXISTS "users_email_trgm_idx"
  ON "users" USING GIN ("email" gin_trgm_ops);
CREATE INDEX CONCURRENTLY IF NOT EXISTS "users_phone_number_trgm_idx"
  ON "users" USING GIN ("phone_number" gin_trgm_ops);
CREATE INDEX CONCURRENTLY IF NOT EXISTS "sellers_shop_name_trgm_idx"
  ON "sellers" USING GIN ("shop_name" gin_trgm_ops);
CREATE INDEX CONCURRENTLY IF NOT EXISTS "order_items_product_title_trgm_idx"
  ON "order_items" USING GIN ("product_title" gin_trgm_ops);
