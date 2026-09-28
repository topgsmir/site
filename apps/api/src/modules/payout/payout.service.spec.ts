import assert from "node:assert/strict";
import test from "node:test";
import type { PrismaService } from "../../prisma/prisma.service";
import { PayoutService } from "./payout.service";

test("seller staff payout reads derive tenant scope from active membership", async () => {
  let payoutWhere: unknown;
  const prisma = {
    seller_memberships: {
      findFirst: async () => ({ seller_id: "seller-1" })
    },
    payout_ledger: {
      findMany: async (input: { where: unknown }) => {
        payoutWhere = input.where;
        return [];
      }
    }
  } as unknown as PrismaService;
  const service = new PayoutService(prisma);

  const result = await service.list(
    { id: "staff-1", fullName: "Seller Staff", email: "staff@example.com", role: "seller-staff" },
    { limit: 20 }
  );

  assert.deepEqual(result, { items: [], nextCursor: null });
  assert.deepEqual(payoutWhere, { seller_id: "seller-1" });
});

test("requested payout pages keep status and seller scope on cursor and list queries", async () => {
  const where: unknown[] = [];
  const prisma = {
    seller_memberships: { findFirst: async () => ({ seller_id: "seller-1" }) },
    payout_ledger: {
      findFirst: async (input: { where: unknown }) => { where.push(input.where); return { id: "cursor-1" }; },
      findMany: async (input: { where: unknown }) => { where.push(input.where); return []; }
    }
  } as unknown as PrismaService;
  const service = new PayoutService(prisma);
  await service.list(
    { id: "staff-1", fullName: "Seller Staff", email: "staff@example.com", role: "seller-staff" },
    { limit: 20, status: "requested", cursor: "cursor-1" }
  );
  assert.deepEqual(where, [
    { id: "cursor-1", seller_id: "seller-1", status: "requested" },
    { seller_id: "seller-1", status: "requested" }
  ]);
});
