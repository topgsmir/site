SET lock_timeout = '5s';

ALTER TABLE "coupons" ALTER COLUMN "seller_id" DROP NOT NULL;
ALTER TABLE "checkouts" ADD COLUMN "coupon_id" TEXT,
  ADD COLUMN "discount_amount" DECIMAL(20, 4) NOT NULL DEFAULT 0,
  ADD COLUMN "coupon_released_at" TIMESTAMPTZ(3),
  ADD CONSTRAINT "checkouts_discount_amount_check" CHECK ("discount_amount" >= 0 AND ("discount_amount" = 0 OR "coupon_id" IS NOT NULL)),
  ADD CONSTRAINT "checkouts_coupon_released_check" CHECK ("coupon_released_at" IS NULL OR "coupon_id" IS NOT NULL);
ALTER TABLE "orders" ADD COLUMN "coupon_id" TEXT,
  ADD COLUMN "discount_amount" DECIMAL(20, 4) NOT NULL DEFAULT 0,
  ADD CONSTRAINT "orders_discount_amount_check" CHECK ("discount_amount" >= 0 AND ("discount_amount" = 0 OR "coupon_id" IS NOT NULL));
ALTER TABLE "checkouts" ADD CONSTRAINT "checkouts_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE RESTRICT;
ALTER TABLE "orders" ADD CONSTRAINT "orders_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE RESTRICT;
CREATE INDEX CONCURRENTLY "checkouts_coupon_id_idx" ON "checkouts"("coupon_id");
CREATE INDEX CONCURRENTLY "orders_coupon_id_idx" ON "orders"("coupon_id");

-- PostgreSQL's existing (seller_id, code) unique index permits duplicate NULLs.
CREATE UNIQUE INDEX CONCURRENTLY "coupons_global_code_key"
  ON "coupons" ("code") WHERE "seller_id" IS NULL;

-- A platform code must not shadow a seller code, or the same entered code could
-- silently apply different terms. The advisory lock closes the concurrent-write gap.
CREATE FUNCTION "coupons_prevent_scope_collision"() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('coupon-code:' || NEW."code", 0));
  IF EXISTS (
    SELECT 1 FROM "coupons" other
    WHERE other."code" = NEW."code" AND other."id" <> NEW."id"
      AND (NEW."seller_id" IS NULL OR other."seller_id" IS NULL)
  ) THEN
    RAISE EXCEPTION 'Coupon code conflicts with a seller or all-sellers coupon'
      USING ERRCODE = '23505', CONSTRAINT = 'coupons_scope_code_key';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "coupons_scope_code_key" BEFORE INSERT OR UPDATE OF "seller_id", "code" ON "coupons"
  FOR EACH ROW EXECUTE FUNCTION "coupons_prevent_scope_collision"();

CREATE OR REPLACE VIEW "ai_reporting"."coupon_summary" AS
  SELECT c."seller_id", s."shop_name", c."currency", c."active", c."starts_at", c."expires_at",
         COUNT(*)::bigint AS "coupon_count", COALESCE(SUM(c."redeemed_count"), 0)::bigint AS "redeemed_count"
  FROM "coupons" c
  LEFT JOIN "sellers" s ON s."id" = c."seller_id"
  GROUP BY 1, 2, 3, 4, 5, 6;
