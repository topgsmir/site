-- Prisma requires the complete relation field set to be unique for this
-- one-to-one compound relation. payment_attempt_id is already independently
-- unique, so this index documents the same invariant without changing data.
CREATE UNIQUE INDEX IF NOT EXISTS "payment_refunds_payment_attempt_id_provider_key"
  ON "payment_refunds"("payment_attempt_id", "provider");
