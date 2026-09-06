CREATE TYPE "coupon_discount_type" AS ENUM ('percentage', 'fixed');

CREATE TABLE "coupons" (
  "id" TEXT NOT NULL,
  "seller_id" TEXT NOT NULL,
  "code" VARCHAR(32) NOT NULL,
  "discount_type" "coupon_discount_type" NOT NULL,
  "discount_value" DECIMAL(20, 4) NOT NULL,
  "currency" CHAR(3) NOT NULL,
  "minimum_order_amount" DECIMAL(20, 4),
  "maximum_redemptions" INTEGER,
  "redeemed_count" INTEGER NOT NULL DEFAULT 0,
  "starts_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMP(3),
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "coupons_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "coupons_code_check" CHECK ("code" ~ '^[A-Z0-9][A-Z0-9_-]{2,31}$'),
  CONSTRAINT "coupons_discount_value_check" CHECK (
    ("discount_type" = 'percentage' AND "discount_value" > 0 AND "discount_value" <= 100)
    OR
    ("discount_type" = 'fixed' AND "discount_value" > 0 AND "currency" IS NOT NULL)
  ),
  CONSTRAINT "coupons_currency_check" CHECK ("currency" ~ '^[A-Z]{3}$'),
  CONSTRAINT "coupons_minimum_order_amount_check" CHECK ("minimum_order_amount" IS NULL OR "minimum_order_amount" >= 0),
  CONSTRAINT "coupons_redemption_counts_check" CHECK (
    "redeemed_count" >= 0
    AND ("maximum_redemptions" IS NULL OR "maximum_redemptions" > 0)
    AND ("maximum_redemptions" IS NULL OR "redeemed_count" <= "maximum_redemptions")
  ),
  CONSTRAINT "coupons_schedule_check" CHECK ("expires_at" IS NULL OR "expires_at" > "starts_at")
);

CREATE UNIQUE INDEX "coupons_seller_id_code_key" ON "coupons"("seller_id", "code");
CREATE INDEX "coupons_seller_id_updated_at_id_idx" ON "coupons"("seller_id", "updated_at", "id");
CREATE INDEX "coupons_seller_id_active_starts_at_expires_at_idx" ON "coupons"("seller_id", "active", "starts_at", "expires_at");

ALTER TABLE "coupons"
  ADD CONSTRAINT "coupons_seller_id_fkey"
  FOREIGN KEY ("seller_id") REFERENCES "sellers"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Preserve access for sellers who already manage their catalog.
INSERT INTO "seller_permissions" ("seller_id", "permission", "granted_by_id")
SELECT "seller_id", 'coupons_manage'::"seller_permission", "granted_by_id"
FROM "seller_permissions"
WHERE "permission" = 'products_manage'::"seller_permission"
ON CONFLICT ("seller_id", "permission") DO NOTHING;
