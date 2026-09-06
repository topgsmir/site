-- Initial legacy schema required by the additive migrations that follow.
-- This project treats its development database as disposable; existing
-- databases must be reset or explicitly baseline this migration before deploy.
CREATE TYPE "user_role" AS ENUM (
  'platform_admin', 'seller_admin', 'seller_staff', 'buyer'
);
CREATE TYPE "product_type" AS ENUM ('digital', 'physical', 'service');
CREATE TYPE "order_status" AS ENUM (
  'pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled'
);
CREATE TYPE "payout_status" AS ENUM (
  'draft', 'requested', 'approved', 'settled', 'disputed'
);

CREATE TABLE "users" (
  "id" TEXT NOT NULL,
  "full_name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "role" "user_role" NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sellers" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "shop_name" TEXT NOT NULL,
  "invited" BOOLEAN NOT NULL DEFAULT FALSE,
  "approved" BOOLEAN NOT NULL DEFAULT FALSE,
  "commission" DECIMAL(65,30) NOT NULL DEFAULT 0.1,
  "holdback_rate" DECIMAL(65,30) NOT NULL DEFAULT 0.05,
  CONSTRAINT "sellers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "products" (
  "id" TEXT NOT NULL,
  "seller_id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "base_price" DECIMAL(65,30) NOT NULL,
  "currency" TEXT NOT NULL,
  "type" "product_type" NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "product_digital" (
  "id" TEXT NOT NULL,
  "product_id" TEXT NOT NULL,
  "file_reference" TEXT NOT NULL,
  "max_downloads" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "product_digital_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "product_physical" (
  "id" TEXT NOT NULL,
  "product_id" TEXT NOT NULL,
  "weight_grams" INTEGER NOT NULL DEFAULT 0,
  "stock" INTEGER NOT NULL DEFAULT 0,
  "tracking_code" TEXT,
  "delivered_at" TIMESTAMP(3),
  CONSTRAINT "product_physical_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "product_service" (
  "id" TEXT NOT NULL,
  "product_id" TEXT NOT NULL,
  "estimated_hours" INTEGER NOT NULL DEFAULT 1,
  "service_type" TEXT NOT NULL,
  CONSTRAINT "product_service_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "orders" (
  "id" TEXT NOT NULL,
  "buyer_id" TEXT NOT NULL,
  "seller_id" TEXT NOT NULL,
  "status" "order_status" NOT NULL DEFAULT 'pending',
  "currency" TEXT NOT NULL,
  "total_amount" DECIMAL(65,30) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "payout_ledger" (
  "id" TEXT NOT NULL,
  "order_id" TEXT NOT NULL,
  "seller_id" TEXT NOT NULL,
  "gross_amount" DECIMAL(65,30) NOT NULL,
  "commission_amount" DECIMAL(65,30) NOT NULL,
  "holdback_amount" DECIMAL(65,30) NOT NULL,
  "payable_amount" DECIMAL(65,30) NOT NULL,
  "currency" TEXT NOT NULL,
  "status" "payout_status" NOT NULL DEFAULT 'draft',
  "requested_at" TIMESTAMP(3),
  "approved_at" TIMESTAMP(3),
  "settled_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payout_ledger_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "sellers_user_id_key" ON "sellers"("user_id");
CREATE UNIQUE INDEX "products_slug_key" ON "products"("slug");
CREATE UNIQUE INDEX "product_digital_product_id_key" ON "product_digital"("product_id");
CREATE UNIQUE INDEX "product_physical_product_id_key" ON "product_physical"("product_id");
CREATE UNIQUE INDEX "product_service_product_id_key" ON "product_service"("product_id");
CREATE UNIQUE INDEX "payout_ledger_order_id_key" ON "payout_ledger"("order_id");

ALTER TABLE "sellers" ADD CONSTRAINT "sellers_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "products" ADD CONSTRAINT "products_seller_id_fkey"
  FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "product_digital" ADD CONSTRAINT "product_digital_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_physical" ADD CONSTRAINT "product_physical_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_service" ADD CONSTRAINT "product_service_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "orders" ADD CONSTRAINT "orders_buyer_id_fkey"
  FOREIGN KEY ("buyer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "orders" ADD CONSTRAINT "orders_seller_id_fkey"
  FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payout_ledger" ADD CONSTRAINT "payout_ledger_seller_id_fkey"
  FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payout_ledger" ADD CONSTRAINT "payout_ledger_order_id_fkey"
  FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
