import assert from "node:assert/strict";
import { test } from "node:test";
import { Prisma } from "../../prisma/client";
import type { PrismaService } from "../../prisma/prisma.service";
import { WalletLedgerService } from "./wallet-ledger.service";

const debit = {
  userId: "staff-1", amount: new Prisma.Decimal(-100), kind: "checkout_debit" as const,
  reason: "Checkout", referenceType: "checkout", referenceId: "checkout-1", operationKey: "checkout-debit:checkout-1"
};

test("a blocked staff account cannot replay a wallet debit", async () => {
  let readEntry = false;
  const tx = {
    users: { findUnique: async () => ({ id: debit.userId, account_status: "blocked" }) },
    wallet_entries: { findUnique: async () => { readEntry = true; return { user_id: debit.userId, amount: debit.amount, kind: debit.kind, reference_type: debit.referenceType, reference_id: debit.referenceId, balance_after: new Prisma.Decimal(900) }; } }
  };
  await assert.rejects(() => new WalletLedgerService({} as PrismaService).apply(tx as never, debit), /Account is unavailable/);
  assert.equal(readEntry, false);
});

test("an active staff account can replay its own wallet debit without spending twice", async () => {
  const tx = {
    users: { findUnique: async () => ({ id: debit.userId, account_status: "active" }) },
    wallet_entries: { findUnique: async () => ({ user_id: debit.userId, amount: debit.amount, kind: debit.kind, reference_type: debit.referenceType, reference_id: debit.referenceId, balance_after: new Prisma.Decimal(900) }) },
    wallet_accounts: { upsert: () => { throw new Error("wallet must not be changed on replay"); } }
  };
  const balance = await new WalletLedgerService({} as PrismaService).apply(tx as never, debit);
  assert.equal(balance.toString(), "900");
});
