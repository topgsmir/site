import assert from "node:assert/strict";
import { test } from "node:test";
import { Prisma } from "../../prisma/client";
import type { PrismaService } from "../../prisma/prisma.service";
import { WalletLedgerService } from "./wallet-ledger.service";

test("an expired club credit cannot fund a wallet debit before the expiry worker runs", async () => {
  let requiredBalance: Prisma.Decimal | undefined;
  const tx = {
    users: { findUnique: async () => ({ id: "buyer-1", account_status: "active" }) },
    wallet_entries: { findUnique: async () => null },
    wallet_accounts: {
      upsert: async () => ({}),
      updateMany: async (input: { where: { balance: { gte: Prisma.Decimal } } }) => {
        requiredBalance = input.where.balance.gte;
        return { count: 0 };
      }
    },
    club_wallet_credits: {
      findMany: async () => [],
      aggregate: async () => ({ _sum: { remaining_toman: new Prisma.Decimal(50) } })
    }
  };
  await assert.rejects(
    () => new WalletLedgerService({} as PrismaService).apply(tx as never, {
      userId: "buyer-1", amount: new Prisma.Decimal(-50), kind: "checkout_debit",
      reason: "Checkout", referenceType: "checkout_group", referenceId: "group-1",
      operationKey: "checkout-debit:group-1"
    }),
    /Insufficient wallet balance/
  );
  assert.equal(requiredBalance?.toString(), "100");
});

test("wallet balance excludes expired club credit before the expiry worker runs", async () => {
  const prisma = {
    wallet_accounts: { findUnique: async () => ({ balance: new Prisma.Decimal(150) }) },
    club_wallet_credits: { aggregate: async () => ({ _sum: { remaining_toman: new Prisma.Decimal(50) } }) }
  };
  assert.equal((await new WalletLedgerService(prisma as never).balance("buyer-1")).balance, "100");
});

test("a blocked account can still forfeit an expired club credit", async () => {
  let recorded = false;
  const tx = {
    users: { findUnique: async () => ({ id: "buyer-1", account_status: "blocked" }) },
    wallet_entries: { findUnique: async () => null, create: async () => { recorded = true; } },
    wallet_accounts: {
      upsert: async () => ({}),
      updateMany: async () => ({ count: 1 }),
      findUniqueOrThrow: async () => ({ balance: new Prisma.Decimal(0) })
    }
  };
  await new WalletLedgerService({} as PrismaService).apply(tx as never, {
    userId: "buyer-1", amount: new Prisma.Decimal(-50), kind: "club_expiry",
    reason: "Expired", referenceType: "club_credit", referenceId: "credit-1",
    operationKey: "club-wallet-expiry:credit-1"
  });
  assert.equal(recorded, true);
});
