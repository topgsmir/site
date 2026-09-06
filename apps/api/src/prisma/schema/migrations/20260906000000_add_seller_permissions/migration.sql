-- Add vendor management metadata without changing the meaning of existing
-- invitation and approval flags. Existing sellers remain usable.
ALTER TABLE "sellers"
  ADD COLUMN "phone_number" TEXT,
  ADD COLUMN "suspended_at" TIMESTAMP(3),
  ADD COLUMN "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TYPE "seller_permission" AS ENUM (
  'products_manage',
  'orders_manage',
  'staff_manage',
  'analytics_view',
  'payouts_request'
);

CREATE TABLE "seller_permissions" (
  "seller_id" TEXT NOT NULL,
  "permission" "seller_permission" NOT NULL,
  "granted_by_id" TEXT,
  "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "seller_permissions_pkey" PRIMARY KEY ("seller_id", "permission")
);

CREATE INDEX "seller_permissions_granted_by_id_idx"
  ON "seller_permissions"("granted_by_id");

ALTER TABLE "seller_permissions"
  ADD CONSTRAINT "seller_permissions_seller_id_fkey"
  FOREIGN KEY ("seller_id") REFERENCES "sellers"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "seller_permissions"
  ADD CONSTRAINT "seller_permissions_granted_by_id_fkey"
  FOREIGN KEY ("granted_by_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
