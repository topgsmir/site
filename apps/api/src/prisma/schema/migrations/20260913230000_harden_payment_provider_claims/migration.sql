SET lock_timeout = '5s';
SET statement_timeout = '60s';

CREATE TYPE "payment_refund_status" AS ENUM ('processing', 'succeeded', 'unknown');

ALTER TABLE "payment_attempts"
  ADD COLUMN "initiation_started_at" TIMESTAMP(3);

ALTER TABLE "payment_attempts"
  DROP CONSTRAINT "payment_attempts_amount_check",
  ADD CONSTRAINT "payment_attempts_amount_check" CHECK (
    "amount" > 0 AND "amount" = TRUNC("amount")
  );

CREATE TABLE "payment_refunds" (
  "id" TEXT NOT NULL,
  "payment_attempt_id" TEXT NOT NULL,
  "actor_user_id" TEXT NOT NULL,
  "idempotency_key" UUID NOT NULL,
  "request_hash" CHAR(64) NOT NULL,
  "status" "payment_refund_status" NOT NULL DEFAULT 'processing',
  "provider_ref_id" VARCHAR(200),
  "failure_code" VARCHAR(64),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMP(3),
  CONSTRAINT "payment_refunds_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "payment_refunds_request_hash_check" CHECK ("request_hash" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "payment_refunds_completion_check" CHECK (
    ("status" = 'succeeded' AND "completed_at" IS NOT NULL AND "provider_ref_id" IS NOT NULL)
    OR ("status" <> 'succeeded' AND "completed_at" IS NULL)
  )
);

CREATE UNIQUE INDEX "payment_refunds_payment_attempt_id_key"
  ON "payment_refunds"("payment_attempt_id");
CREATE UNIQUE INDEX "payment_refunds_actor_user_id_idempotency_key_key"
  ON "payment_refunds"("actor_user_id", "idempotency_key");
CREATE UNIQUE INDEX "payment_refunds_provider_ref_id_key"
  ON "payment_refunds"("provider_ref_id");
CREATE INDEX "payment_refunds_status_created_at_idx"
  ON "payment_refunds"("status", "created_at");

ALTER TABLE "payment_refunds"
  ADD CONSTRAINT "payment_refunds_payment_attempt_id_fkey"
  FOREIGN KEY ("payment_attempt_id") REFERENCES "payment_attempts"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payment_refunds"
  ADD CONSTRAINT "payment_refunds_actor_user_id_fkey"
  FOREIGN KEY ("actor_user_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "payment_attempts"
    WHERE "status" IN ('created', 'pending', 'succeeded')
    GROUP BY "order_id"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot enforce one live payment attempt per order: reconcile duplicate active attempts first';
  END IF;
END $$;

CREATE UNIQUE INDEX "payment_attempts_one_live_per_order_key"
  ON "payment_attempts"("order_id")
  WHERE "status" IN (
    'created',
    'initiating',
    'initiation_unknown',
    'pending',
    'succeeded',
    'refund_pending',
    'refund_unknown'
  );

ALTER TABLE "payment_attempts"
  ADD CONSTRAINT "payment_attempts_authority_state_check" CHECK (
    "status" NOT IN ('pending', 'succeeded', 'refund_pending', 'refund_unknown', 'refunded')
    OR "authority" IS NOT NULL
  ) NOT VALID;
ALTER TABLE "payment_attempts" VALIDATE CONSTRAINT "payment_attempts_authority_state_check";
