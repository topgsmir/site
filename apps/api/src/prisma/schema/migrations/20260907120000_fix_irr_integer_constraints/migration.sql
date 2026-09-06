ALTER TABLE "orders"
  DROP CONSTRAINT "orders_total_amount_check",
  ADD CONSTRAINT "orders_total_amount_check"
    CHECK ("total_amount" >= 0 AND "total_amount" = TRUNC("total_amount"));

ALTER TABLE "order_items"
  DROP CONSTRAINT "order_items_amount_check",
  ADD CONSTRAINT "order_items_amount_check" CHECK (
    "unit_price" >= 0 AND "unit_price" = TRUNC("unit_price") AND
    "total_amount" = "unit_price" * "quantity"
  );

ALTER TABLE "payout_ledger"
  DROP CONSTRAINT "payout_ledger_irr_scale_check",
  ADD CONSTRAINT "payout_ledger_irr_scale_check" CHECK (
    "currency" = 'IRR' AND
    "gross_amount" = TRUNC("gross_amount") AND
    "commission_amount" = TRUNC("commission_amount") AND
    "holdback_amount" = TRUNC("holdback_amount") AND
    "payable_amount" = TRUNC("payable_amount")
  );
