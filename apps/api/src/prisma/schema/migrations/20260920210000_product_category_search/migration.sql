CREATE INDEX CONCURRENTLY IF NOT EXISTS "products_category_trgm_idx"
  ON "products" USING GIN ("category" gin_trgm_ops);
