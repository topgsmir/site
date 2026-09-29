ALTER TABLE "shipping_settings" ADD COLUMN "policy" JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE "shipping_setting_events" ADD COLUMN "policy" JSONB;

ALTER TABLE "seller_offer_physical"
  ADD COLUMN "length_cm" INTEGER,
  ADD COLUMN "width_cm" INTEGER,
  ADD COLUMN "height_cm" INTEGER;

ALTER TABLE "seller_offer_physical"
  ADD CONSTRAINT "seller_offer_physical_dimensions_positive"
  CHECK ((length_cm IS NULL OR length_cm BETWEEN 1 AND 1000) AND (width_cm IS NULL OR width_cm BETWEEN 1 AND 1000) AND (height_cm IS NULL OR height_cm BETWEEN 1 AND 1000));

ALTER TABLE "order_items"
  ADD COLUMN "shipping_weight_grams" INTEGER,
  ADD COLUMN "shipping_length_cm" INTEGER,
  ADD COLUMN "shipping_width_cm" INTEGER,
  ADD COLUMN "shipping_height_cm" INTEGER;
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_shipping_measurements_valid" CHECK (
  (shipping_weight_grams IS NULL OR shipping_weight_grams >= 10) AND
  (shipping_length_cm IS NULL OR shipping_length_cm BETWEEN 1 AND 1000) AND
  (shipping_width_cm IS NULL OR shipping_width_cm BETWEEN 1 AND 1000) AND
  (shipping_height_cm IS NULL OR shipping_height_cm BETWEEN 1 AND 1000)
);

ALTER TABLE "orders"
  ADD COLUMN "shipping_cost" DECIMAL(20,4) NOT NULL DEFAULT 0,
  ADD COLUMN "shipping_fee" DECIMAL(20,4) NOT NULL DEFAULT 0,
  ADD COLUMN "shipping_payer" VARCHAR(16);

ALTER TABLE "orders"
  ADD CONSTRAINT "orders_shipping_amounts_nonnegative" CHECK (shipping_cost >= 0 AND shipping_fee >= 0),
  ADD CONSTRAINT "orders_shipping_payer_valid" CHECK (shipping_payer IS NULL OR shipping_payer IN ('customer', 'seller', 'site'));

ALTER TABLE "payout_ledger" ADD COLUMN "shipping_cost_amount" DECIMAL(20,4) NOT NULL DEFAULT 0;
ALTER TABLE "payout_ledger" DROP CONSTRAINT "payout_ledger_amounts_check";
ALTER TABLE "payout_ledger" ADD CONSTRAINT "payout_ledger_amounts_check" CHECK (
  gross_amount >= 0 AND commission_amount >= 0 AND holdback_amount >= 0 AND shipping_cost_amount >= 0 AND payable_amount >= 0 AND
  commission_amount + holdback_amount + shipping_cost_amount + payable_amount = gross_amount
);
ALTER TABLE "payout_ledger" DROP CONSTRAINT "payout_ledger_toman_scale_check";
ALTER TABLE "payout_ledger" ADD CONSTRAINT "payout_ledger_toman_scale_check" CHECK (
  currency = 'TOMAN' AND gross_amount * 10 = TRUNC(gross_amount * 10) AND commission_amount * 10 = TRUNC(commission_amount * 10) AND
  holdback_amount * 10 = TRUNC(holdback_amount * 10) AND shipping_cost_amount * 10 = TRUNC(shipping_cost_amount * 10) AND payable_amount * 10 = TRUNC(payable_amount * 10)
);
