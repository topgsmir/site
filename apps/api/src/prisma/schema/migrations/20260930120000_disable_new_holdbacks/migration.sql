-- Keep historical order and payout holdback values for audit, but prevent new
-- seller terms from charging a holdback. New orders and payouts use zero.
ALTER TABLE "sellers" DROP CONSTRAINT IF EXISTS "sellers_total_rate_check";
ALTER TABLE "sellers" DROP CONSTRAINT IF EXISTS "sellers_holdback_rate_check";
ALTER TABLE "sellers" DROP COLUMN "holdback_rate";

ALTER TABLE "orders" ALTER COLUMN "holdback_rate" SET DEFAULT 0;
ALTER TABLE "payout_ledger" ALTER COLUMN "holdback_amount" SET DEFAULT 0;
