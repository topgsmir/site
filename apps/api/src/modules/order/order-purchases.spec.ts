import { strict as assert } from "node:assert";
import { createHash } from "node:crypto";
import { test } from "node:test";
import type { AppUser, Role } from "@topgsm/shared-types";
import type { PrismaService } from "../../prisma/prisma.service";
import { OrderService } from "./order.service";

const at = new Date("2026-09-30T10:00:00.000Z");
const roles: Role[] = ["buyer", "seller-admin", "seller-staff", "platform-admin", "platform-staff"];
const actor = (role: Role): AppUser => ({ id: "person-1", fullName: "Person", email: "person@example.com", role });
const record = {
  id: "order-1", buyer_id: "person-1", seller_id: "shop-1", checkout_id: null,
  traffic_source: null, status: "pending", trashed_at: null,
  currency: "TOMAN", total_amount: { toString: () => "1000" },
  commission_rate: { toString: () => "0.1" }, holdback_rate: { toString: () => "0" },
  created_at: at, updated_at: at,
  seller: { shop_name: "Own shop", goghdi_agent_id: null },
  buyer: { full_name: "Person", email: "person@example.com", phone_number: null },
  shipping_address: null, shipment: null, shipping_dispatch: null, items: []
};

test("every role sees only its own purchases, including an own-shop order", async () => {
  for (const role of roles) {
    let where: Record<string, unknown> | undefined;
    const prisma = { orders: { findMany: async (query: { where: Record<string, unknown> }) => {
      where = query.where;
      return [{ id: record.id, status: record.status, currency: record.currency, total_amount: record.total_amount,
        created_at: at, seller: record.seller, items: [] }];
    } } } as unknown as PrismaService;
    const page = await new OrderService(prisma).listPurchases(actor(role), { limit: 20 });
    assert.deepEqual(where, { buyer_id: "person-1" });
    assert.equal(page.items[0]?.seller.shopName, "Own shop");
    assert.equal("commissionRate" in page.items[0]!, false);
  }
});

test("personal order detail checks buyer ownership even for platform admins", async () => {
  const prisma = { orders: { findFirst: async ({ where }: { where: { buyer_id: string } }) => where.buyer_id === record.buyer_id ? record : null } } as unknown as PrismaService;
  const service = new OrderService(prisma);
  const detail = await service.getPurchase(actor("platform-admin"), record.id);
  assert.equal(detail.id, record.id);
  assert.equal("commissionRate" in detail, false);
  assert.equal("buyerId" in detail, false);
  await assert.rejects(() => service.getPurchase({ ...actor("platform-admin"), id: "another-person" }, record.id), /Order was not found/);
});

test("personal status replay rechecks ownership and cannot reuse a management key", async () => {
  const key = "same-key";
  const personalHash = createHash("sha256").update(JSON.stringify({ orderId: record.id, status: "cancelled", intent: "purchase" })).digest("hex");
  const transaction = {
    order_events: { findUnique: async () => ({ request_hash: personalHash, order: record }) },
    orders: { findFirst: async ({ where }: { where: { buyer_id?: string } }) => where.buyer_id === record.buyer_id ? { id: record.id } : null }
  };
  const prisma = { $transaction: async (work: (tx: typeof transaction) => Promise<unknown>) => work(transaction) } as unknown as PrismaService;
  const service = new OrderService(prisma);
  const own = await service.transitionPurchase(actor("seller-admin"), record.id, { status: "cancelled" }, key);
  assert.equal(own.id, record.id);
  assert.equal("commissionRate" in own, false);
  await assert.rejects(() => service.transitionPurchase({ ...actor("platform-admin"), id: "another-person" }, record.id, { status: "cancelled" }, key), /Order was not found/);
  await assert.rejects(() => service.transitionPurchase(actor("platform-admin"), record.id, { status: "delivered" }, key), /another request/);
});

test("a platform admin cannot change another user's order through a personal route", async () => {
  const transaction = {
    order_events: { findUnique: async () => null },
    orders: { findFirst: async ({ where }: { where: { buyer_id: string } }) => {
      assert.equal(where.buyer_id, "another-person");
      return null;
    } }
  };
  const prisma = { $transaction: async (work: (tx: typeof transaction) => Promise<unknown>) => work(transaction) } as unknown as PrismaService;
  await assert.rejects(() => new OrderService(prisma).transitionPurchase(
    { ...actor("platform-admin"), id: "another-person" }, record.id, { status: "cancelled" }, "new-key"
  ), /Order was not found/);
});

test("management replay loses seller access when membership is revoked", async () => {
  const seller = actor("seller-staff");
  const prisma = { seller_memberships: { findFirst: async () => null } } as unknown as PrismaService;
  await assert.rejects(() => new OrderService(prisma).transition(seller, record.id, { status: "processing" }, "key"), /Active seller orders_manage permission is required/);
});
