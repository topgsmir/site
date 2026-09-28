ALTER TYPE "product_status" ADD VALUE IF NOT EXISTS 'trashed';

ALTER TABLE "products" ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "products" ADD CONSTRAINT "products_tags_limit" CHECK (cardinality("tags") <= 20);

CREATE TABLE "product_bulk_operations" (
  "id" UUID NOT NULL PRIMARY KEY,
  "actor_user_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "action" TEXT NOT NULL,
  "request_hash" CHAR(64) NOT NULL,
  "product_count" INTEGER NOT NULL,
  "offer_count" INTEGER NOT NULL,
  "before_state" JSONB NOT NULL,
  "after_state" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE "product_bulk_operations" ADD CONSTRAINT "product_bulk_operations_bounds" CHECK (
  "product_count" BETWEEN 1 AND 50 AND "offer_count" BETWEEN 0 AND 500
);
CREATE INDEX "product_bulk_operations_actor_user_id_created_at_idx" ON "product_bulk_operations"("actor_user_id", "created_at" DESC);
