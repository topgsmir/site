CREATE INDEX CONCURRENTLY IF NOT EXISTS "users_username_trgm_idx"
ON "users" USING GIN ("username" gin_trgm_ops);
