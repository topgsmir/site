CREATE INDEX CONCURRENTLY "coupons_updated_at_id_idx"
  ON "coupons"("updated_at" DESC, "id" DESC);
