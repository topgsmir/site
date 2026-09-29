SET lock_timeout = '5s';

CREATE UNIQUE INDEX "payment_attempts_one_active_checkout_group_idx"
ON "payment_attempts"("checkout_payment_group_id")
WHERE "checkout_payment_group_id" IS NOT NULL
  AND "status" IN ('created', 'initiating', 'initiation_unknown', 'pending', 'succeeded');
