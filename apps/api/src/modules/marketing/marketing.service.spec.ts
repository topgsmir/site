import assert from "node:assert/strict";
import test from "node:test";
import { BadRequestException, ConflictException } from "@nestjs/common";
import { Prisma } from "../../prisma/client";
import type { PrismaService } from "../../prisma/prisma.service";
import { MarketingService } from "./marketing.service";

const id = "123e4567-e89b-42d3-a456-426614174000";
const linkId = "123e4567-e89b-42d3-a456-426614174001";
const itemId = "123e4567-e89b-42d3-a456-426614174002";
const visitId = "123e4567-e89b-42d3-a456-426614174003";

function transaction(source: "seller" | "platform" = "seller", productId = id) {
  const creations: Array<Record<string, unknown>> = [];
  const updates: Array<Record<string, unknown>> = [];
  const tx = {
    marketing_visits: { findMany: async () => [{ id: visitId, link: { id: linkId, seller_id: id, product_id: productId, commission_rate: new Prisma.Decimal("0.1"), funding_source: source, active: true, expires_at: null } }] },
    marketing_earnings: { create: async ({ data }: { data: Record<string, unknown> }) => { creations.push(data); } },
    payout_ledger: {
      findUniqueOrThrow: async () => ({ payable_amount: new Prisma.Decimal("800"), commission_amount: new Prisma.Decimal("100") }),
      update: async ({ data }: { data: Record<string, unknown> }) => { updates.push(data); }
    }
  };
  return { tx: tx as unknown as Prisma.TransactionClient, creations, updates };
}

test("seller funded referral snapshots the discounted item amount and deducts only the seller payout", async () => {
  const service = new MarketingService({} as PrismaService);
  const { tx, creations, updates } = transaction();
  await service.reserve(tx, id, id, new Prisma.Decimal("900"), [{ id: itemId, offerId: id, productId: id, totalAmount: "1000" }], [{ offerId: id, visitId }]);
  assert.equal(creations.length, 1);
  assert.equal((creations[0].base_amount as Prisma.Decimal).toString(), "900");
  assert.equal((creations[0].amount as Prisma.Decimal).toString(), "90");
  assert.equal((updates[0].payable_amount as Prisma.Decimal).toString(), "710");
  assert.equal((updates[0].marketing_commission_amount as Prisma.Decimal).toString(), "90");
});

test("a visit for another product cannot attribute a purchase", async () => {
  const service = new MarketingService({} as PrismaService);
  const { tx, creations } = transaction("seller", linkId);
  await assert.rejects(() => service.reserve(tx, id, id, new Prisma.Decimal("900"), [{ id: itemId, offerId: id, productId: id, totalAmount: "1000" }], [{ offerId: id, visitId }]), BadRequestException);
  assert.equal(creations.length, 0);
});

test("platform funded commission cannot exceed the platform's share", async () => {
  const service = new MarketingService({} as PrismaService);
  const { tx } = transaction("platform");
  await assert.rejects(() => service.reserve(tx, id, id, new Prisma.Decimal("1100"), [{ id: itemId, offerId: id, productId: id, totalAmount: "1100" }], [{ offerId: id, visitId }]), ConflictException);
});
