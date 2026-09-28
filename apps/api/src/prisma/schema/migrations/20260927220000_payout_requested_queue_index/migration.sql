-- Support bounded admin review of requested payouts without scanning the full ledger.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "payout_ledger_status_created_at_id_idx"
  ON "payout_ledger" ("status", "created_at" DESC, "id" DESC);
