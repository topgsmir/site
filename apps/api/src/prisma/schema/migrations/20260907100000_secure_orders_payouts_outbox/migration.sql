ALTER TYPE "order_status" ADD VALUE IF NOT EXISTS 'awaiting_confirmation' AFTER 'shipped';

ALTER TABLE "sellers"
  ALTER COLUMN "commission" TYPE DECIMAL(9,6),
  ALTER COLUMN "holdback_rate" TYPE DECIMAL(9,6),
  ADD CONSTRAINT "sellers_commission_check" CHECK ("commission" BETWEEN 0 AND 1),
  ADD CONSTRAINT "sellers_holdback_rate_check" CHECK ("holdback_rate" BETWEEN 0 AND 1),
  ADD CONSTRAINT "sellers_total_rate_check" CHECK ("commission" + "holdback_rate" <= 1);

ALTER TABLE "orders"
  ALTER COLUMN "currency" TYPE CHAR(3),
  ALTER COLUMN "total_amount" TYPE DECIMAL(20,4),
  ADD COLUMN "commission_rate" DECIMAL(9,6) NOT NULL,
  ADD COLUMN "holdback_rate" DECIMAL(9,6) NOT NULL,
  ADD COLUMN "idempotency_key" UUID NOT NULL,
  ADD COLUMN "request_hash" CHAR(64) NOT NULL,
  ADD CONSTRAINT "orders_currency_check" CHECK ("currency" = 'IRR'),
  ADD CONSTRAINT "orders_total_amount_check" CHECK ("total_amount" >= 0 AND SCALE("total_amount") = 0),
  ADD CONSTRAINT "orders_commission_rate_check" CHECK ("commission_rate" BETWEEN 0 AND 1),
  ADD CONSTRAINT "orders_holdback_rate_check" CHECK ("holdback_rate" BETWEEN 0 AND 1),
  ADD CONSTRAINT "orders_total_rate_check" CHECK ("commission_rate" + "holdback_rate" <= 1),
  ADD CONSTRAINT "orders_request_hash_check" CHECK ("request_hash" ~ '^[0-9a-f]{64}$');

ALTER TABLE "payout_ledger"
  ALTER COLUMN "gross_amount" TYPE DECIMAL(20,4),
  ALTER COLUMN "commission_amount" TYPE DECIMAL(20,4),
  ALTER COLUMN "holdback_amount" TYPE DECIMAL(20,4),
  ALTER COLUMN "payable_amount" TYPE DECIMAL(20,4),
  ALTER COLUMN "currency" TYPE CHAR(3),
  ADD CONSTRAINT "payout_ledger_amounts_check" CHECK (
    "gross_amount" >= 0 AND "commission_amount" >= 0 AND
    "holdback_amount" >= 0 AND "payable_amount" >= 0 AND
    "commission_amount" + "holdback_amount" + "payable_amount" = "gross_amount"
  ),
  ADD CONSTRAINT "payout_ledger_irr_scale_check" CHECK (
    "currency" = 'IRR' AND SCALE("gross_amount") = 0 AND
    SCALE("commission_amount") = 0 AND SCALE("holdback_amount") = 0 AND
    SCALE("payable_amount") = 0
  );

CREATE TABLE "order_items" (
  "id" TEXT NOT NULL,
  "order_id" TEXT NOT NULL,
  "offer_id" TEXT NOT NULL,
  "product_type" "product_type" NOT NULL,
  "product_title" VARCHAR(200) NOT NULL,
  "quantity" INTEGER NOT NULL,
  "unit_price" DECIMAL(20,4) NOT NULL,
  "total_amount" DECIMAL(20,4) NOT NULL,
  CONSTRAINT "order_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "order_items_quantity_check" CHECK ("quantity" BETWEEN 1 AND 100),
  CONSTRAINT "order_items_amount_check" CHECK (
    "unit_price" >= 0 AND SCALE("unit_price") = 0 AND
    "total_amount" = "unit_price" * "quantity"
  )
);

CREATE TABLE "order_events" (
  "id" TEXT NOT NULL,
  "order_id" TEXT NOT NULL,
  "actor_user_id" TEXT NOT NULL,
  "from_status" "order_status",
  "to_status" "order_status" NOT NULL,
  "idempotency_key" UUID NOT NULL,
  "request_hash" CHAR(64) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "order_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "order_events_request_hash_check" CHECK ("request_hash" ~ '^[0-9a-f]{64}$')
);

CREATE TABLE "payout_events" (
  "id" TEXT NOT NULL,
  "payout_id" TEXT NOT NULL,
  "actor_user_id" TEXT NOT NULL,
  "from_status" "payout_status" NOT NULL,
  "to_status" "payout_status" NOT NULL,
  "idempotency_key" UUID NOT NULL,
  "request_hash" CHAR(64) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payout_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "payout_events_request_hash_check" CHECK ("request_hash" ~ '^[0-9a-f]{64}$')
);

CREATE TABLE "outbox_events" (
  "id" TEXT NOT NULL,
  "aggregate" VARCHAR(32) NOT NULL,
  "aggregate_id" TEXT NOT NULL,
  "event_type" VARCHAR(64) NOT NULL,
  "dedupe_key" VARCHAR(160) NOT NULL,
  "payload" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "published_at" TIMESTAMP(3),
  "attempts" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "outbox_events_attempts_check" CHECK ("attempts" >= 0)
);

CREATE UNIQUE INDEX "orders_buyer_id_idempotency_key_key" ON "orders"("buyer_id", "idempotency_key");
CREATE INDEX "orders_buyer_id_created_at_id_idx" ON "orders"("buyer_id", "created_at", "id");
CREATE INDEX "orders_seller_id_created_at_id_idx" ON "orders"("seller_id", "created_at", "id");
CREATE UNIQUE INDEX "order_items_order_id_key" ON "order_items"("order_id");
CREATE INDEX "order_items_offer_id_idx" ON "order_items"("offer_id");
CREATE UNIQUE INDEX "order_events_actor_user_id_idempotency_key_key" ON "order_events"("actor_user_id", "idempotency_key");
CREATE INDEX "order_events_order_id_created_at_idx" ON "order_events"("order_id", "created_at");
CREATE INDEX "payout_ledger_seller_id_created_at_id_idx" ON "payout_ledger"("seller_id", "created_at", "id");
CREATE UNIQUE INDEX "payout_events_actor_user_id_idempotency_key_key" ON "payout_events"("actor_user_id", "idempotency_key");
CREATE INDEX "payout_events_payout_id_created_at_idx" ON "payout_events"("payout_id", "created_at");
CREATE UNIQUE INDEX "outbox_events_dedupe_key_key" ON "outbox_events"("dedupe_key");
CREATE INDEX "outbox_events_published_at_created_at_idx" ON "outbox_events"("published_at", "created_at");

ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey"
  FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_offer_id_fkey"
  FOREIGN KEY ("offer_id") REFERENCES "seller_offers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "order_events" ADD CONSTRAINT "order_events_order_id_fkey"
  FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "order_events" ADD CONSTRAINT "order_events_actor_user_id_fkey"
  FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payout_events" ADD CONSTRAINT "payout_events_payout_id_fkey"
  FOREIGN KEY ("payout_id") REFERENCES "payout_ledger"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payout_events" ADD CONSTRAINT "payout_events_actor_user_id_fkey"
  FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
