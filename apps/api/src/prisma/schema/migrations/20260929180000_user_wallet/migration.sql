SET lock_timeout = '5s';

CREATE TABLE "wallet_accounts" (
  "user_id" TEXT PRIMARY KEY REFERENCES "users"("id") ON DELETE RESTRICT,
  "currency" VARCHAR(5) NOT NULL DEFAULT 'TOMAN',
  "balance" DECIMAL(20,0) NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  CONSTRAINT "wallet_accounts_currency_check" CHECK ("currency" = 'TOMAN'),
  CONSTRAINT "wallet_accounts_balance_check" CHECK ("balance" >= 0)
);

CREATE TABLE "wallet_entries" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "actor_user_id" TEXT REFERENCES "users"("id") ON DELETE RESTRICT,
  "amount" DECIMAL(20,0) NOT NULL,
  "balance_after" DECIMAL(20,0) NOT NULL,
  "kind" VARCHAR(32) NOT NULL,
  "reason" VARCHAR(500) NOT NULL,
  "reference_type" VARCHAR(32) NOT NULL,
  "reference_id" VARCHAR(128) NOT NULL,
  "operation_key" VARCHAR(160) NOT NULL UNIQUE,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  CONSTRAINT "wallet_entries_amount_check" CHECK ("amount" <> 0),
  CONSTRAINT "wallet_entries_balance_check" CHECK ("balance_after" >= 0),
  CONSTRAINT "wallet_entries_kind_check" CHECK ("kind" IN ('topup','checkout_debit','checkout_release','order_refund','admin_credit','admin_debit')),
  CONSTRAINT "wallet_entries_reason_check" CHECK (length(trim("reason")) BETWEEN 3 AND 500)
);
CREATE INDEX "wallet_entries_user_history_idx" ON "wallet_entries"("user_id", "created_at" DESC, "id" DESC);
CREATE INDEX "wallet_entries_reference_idx" ON "wallet_entries"("reference_type", "reference_id");
CREATE INDEX "wallet_entries_actor_history_idx" ON "wallet_entries"("actor_user_id", "created_at" DESC);
CREATE UNIQUE INDEX "wallet_entries_one_source_idx" ON "wallet_entries"("kind", "reference_type", "reference_id") WHERE "kind" IN ('topup','checkout_debit','checkout_release','order_refund');

CREATE FUNCTION reject_wallet_entry_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'wallet entries are immutable';
END;
$$;
CREATE TRIGGER wallet_entries_immutable BEFORE UPDATE OR DELETE ON "wallet_entries"
FOR EACH ROW EXECUTE FUNCTION reject_wallet_entry_change();

CREATE TABLE "wallet_topups" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "provider" VARCHAR(32) NOT NULL,
  "amount" DECIMAL(20,0) NOT NULL,
  "currency" VARCHAR(5) NOT NULL DEFAULT 'TOMAN',
  "status" VARCHAR(24) NOT NULL DEFAULT 'created',
  "idempotency_key" UUID NOT NULL,
  "authority" VARCHAR(128),
  "provider_ref_id" VARCHAR(100),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  "verified_at" TIMESTAMPTZ(3),
  CONSTRAINT "wallet_topups_amount_check" CHECK ("amount" BETWEEN 1000 AND 100000000),
  CONSTRAINT "wallet_topups_currency_check" CHECK ("currency" = 'TOMAN'),
  CONSTRAINT "wallet_topups_status_check" CHECK ("status" IN ('created','initiating','initiation_unknown','pending','succeeded','failed')),
  CONSTRAINT "wallet_topups_user_key" UNIQUE ("user_id", "idempotency_key"),
  CONSTRAINT "wallet_topups_provider_authority" UNIQUE ("provider", "authority"),
  CONSTRAINT "wallet_topups_provider_reference" UNIQUE ("provider", "provider_ref_id")
);
CREATE INDEX "wallet_topups_user_history_idx" ON "wallet_topups"("user_id", "created_at" DESC, "id" DESC);
CREATE INDEX "wallet_topups_status_updated_idx" ON "wallet_topups"("status", "updated_at");

ALTER TABLE "checkout_payment_groups" ADD COLUMN "wallet_amount" DECIMAL(20,4) NOT NULL DEFAULT 0;
ALTER TABLE "checkout_payment_groups" ADD CONSTRAINT "checkout_payment_groups_wallet_amount_check"
  CHECK ("wallet_amount" >= 0 AND "wallet_amount" <= "amount" AND "wallet_amount" = trunc("wallet_amount"));

CREATE TRIGGER lifecycle_wallet_account BEFORE INSERT OR UPDATE OR DELETE ON "wallet_accounts"
FOR EACH ROW EXECUTE FUNCTION lifecycle_fence('user','user_id');
CREATE TRIGGER lifecycle_wallet_entry BEFORE INSERT ON "wallet_entries"
FOR EACH ROW EXECUTE FUNCTION lifecycle_fence('user','user_id');
CREATE TRIGGER lifecycle_wallet_topup BEFORE INSERT OR UPDATE OR DELETE ON "wallet_topups"
FOR EACH ROW EXECUTE FUNCTION lifecycle_fence('user','user_id');
