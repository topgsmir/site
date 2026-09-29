import { strict as assert } from "node:assert";
import { it } from "node:test";
import type { AppUser } from "@topgsm/shared-types";
import type { PrismaService } from "../../prisma/prisma.service";
import { OrderService } from "./order.service";

const admin: AppUser = { id: "admin-1", fullName: "Admin", email: "admin@example.com", role: "platform-admin" };
const buyer: AppUser = { id: "buyer-1", fullName: "Buyer", email: "buyer@example.com", role: "buyer" };

it("offers direct completion from pending and blocks reversal after payout request", () => {
  const service = new OrderService({} as PrismaService);
  assert.ok(service.adminTransitions("pending", "physical").includes("delivered"));
  assert.ok(service.adminTransitions("pending", "digital").includes("delivered"));
  assert.ok(service.adminTransitions("delivered", "physical", "draft").includes("shipped"));
  assert.deepEqual(service.adminTransitions("delivered", "physical", "requested"), []);
  assert.equal(service.adminTransitions("paid", "digital").includes("cancelled"), false);
});

it("rejects manual completion while a checkout payment is in progress", async () => {
  let checkedCheckout: unknown;
  const transaction = {
    order_events: { findUnique: async () => null },
    orders: { findFirst: async () => ({ id: "order-1", status: "pending", checkout_id: "checkout-1", payout_records: [{ status: "draft" }], items: [{ product_type: "digital" }] }) },
    payment_attempts: { count: async ({ where }: { where: { OR: unknown[] } }) => { checkedCheckout = where.OR[1]; return 1; } }
  };
  const prisma = { $transaction: async (work: (tx: typeof transaction) => Promise<unknown>) => work(transaction) } as unknown as PrismaService;
  await assert.rejects(() => new OrderService(prisma).transition(admin, "order-1", { status: "delivered", confirmSensitive: true }, "key"), /Payment is in progress/);
  assert.deepEqual(checkedCheckout, { checkout_payment_group: { checkout_id: "checkout-1" } });
});

it("limits trash actions to platform order managers and terminal orders", async () => {
  const transaction = {
    order_events: { findUnique: async () => null },
    orders: { findUnique: async () => ({ id: "order-1", status: "processing", trashed_at: null }) }
  };
  const prisma = { $transaction: async (work: (tx: typeof transaction) => Promise<unknown>) => work(transaction) } as unknown as PrismaService;
  const service = new OrderService(prisma);
  await assert.rejects(() => service.setTrash(buyer, "order-1", { trashed: true, confirm: true }, "key"), /Platform order access is required/);
  await assert.rejects(() => service.setTrash(admin, "order-1", { trashed: true, confirm: false }, "key"), /Confirm this administrative action/);
  await assert.rejects(() => service.setTrash(admin, "order-1", { trashed: true, confirm: true }, "key"), /Only completed or cancelled orders/);
});

it("moves a terminal order to trash and records the actor in the same transaction", async () => {
  const saved: { where?: unknown; event?: Record<string, unknown> } = {};
  const now = new Date("2026-09-29T12:00:00.000Z");
  const order = {
    id: "order-1", buyer_id: "buyer-1", seller_id: "seller-1", checkout_id: null,
    traffic_source: null, status: "delivered", trashed_at: now,
    currency: "TOMAN", total_amount: { toString: () => "1000" },
    commission_rate: { toString: () => "0.1" }, holdback_rate: { toString: () => "0" },
    created_at: now, updated_at: now,
    seller: { shop_name: "Shop", goghdi_agent_id: null },
    buyer: { full_name: "Buyer", email: "buyer@example.com", phone_number: null },
    shipping_address: null, shipment: null, shipping_dispatch: null, items: []
  };
  let reads = 0;
  const transaction = {
    order_events: {
      findUnique: async () => null,
      create: async ({ data }: { data: Record<string, unknown> }) => { saved.event = data; }
    },
    orders: {
      findUnique: async () => ++reads === 1 ? { id: order.id, status: order.status, trashed_at: null } : order,
      findUniqueOrThrow: async () => order,
      updateMany: async ({ where }: { where: unknown }) => { saved.where = where; return { count: 1 }; }
    }
  };
  const prisma = { $transaction: async (work: (tx: typeof transaction) => Promise<unknown>) => work(transaction) } as unknown as PrismaService;
  const result = await new OrderService(prisma).setTrash(admin, order.id, { trashed: true, confirm: true }, "key");
  assert.ok("trashedAt" in result);
  assert.equal(result.trashedAt, now.toISOString());
  assert.deepEqual(saved.where, { id: order.id, status: "delivered", trashed_at: null });
  assert.equal(saved.event?.actor_user_id, admin.id);
  assert.equal(saved.event?.action, "trashed");
});
