import assert from "node:assert/strict";
import { it } from "node:test";
import { createHash } from "node:crypto";
import { METHOD_METADATA } from "@nestjs/common/constants";
import { RequestMethod } from "@nestjs/common";
import type { AppUser } from "@topgsm/shared-types";
import { OrderService } from "./order.service";
import { OrderController } from "./order.controller";

const buyer = { id: "buyer", role: "buyer" } as AppUser;
for (const type of ["physical", "digital", "service"]) {
  it(`rejects legacy ${type} creation before reserving stock or creating an order`, async () => {
    const tx = { orders: { findUnique: async () => null }, seller_offers: { findFirst: async () => ({ listing: { product: { type } } }) } };
    const service = new OrderService({ $transaction: async (work: (tx: unknown) => unknown) => work(tx) } as never);
    await assert.rejects(() => service.create(buyer, { offerId: "offer", quantity: 1 }, "key"), /Use checkout/);
  });
}
it("blocks pending buyer cancellation when another order in its checkout has an active payment", async () => {
  const tx = {
    order_events: { findUnique: async () => null },
    orders: { findFirst: async () => ({ id: "order", status: "pending", checkout_id: "checkout", items: [{ product_type: "physical" }], payout_records: [] }) },
    payment_attempts: { count: async ({ where }: { where: { OR: unknown[] } }) => {
      assert.deepEqual(where.OR, [{ order_id: "order" }, { checkout_payment_group: { checkout_id: "checkout" } }]); return 1;
    } }
  };
  const service = new OrderService({ $transaction: async (work: (tx: unknown) => unknown) => work(tx) } as never);
  await assert.rejects(() => service.transition(buyer, "order", { status: "cancelled" }, "key"), /Payment is in progress/);
});
it("rechecks current seller ownership before returning a shipping replay", async () => {
  const hash = createHash("sha256").update(JSON.stringify({ orderId: "order", carrier: "carrier", trackingCode: null })).digest("hex");
  const tx = {
    order_events: { findUnique: async () => ({ request_hash: hash, order: { id: "order", seller_id: "old-shop" } }) },
    orders: { findFirst: async ({ where }: { where: { seller_id: string } }) => { assert.equal(where.seller_id, "new-shop"); return null; } }
  };
  const service = new OrderService({ seller_memberships: { findFirst: async () => ({ seller: { id: "new-shop" } }) }, $transaction: async (work: (tx: unknown) => unknown) => work(tx) } as never);
  await assert.rejects(() => service.ship({ ...buyer, role: "seller-staff" }, "order", { carrier: "carrier" }, "key"), /Order was not found/);
});
it("download allowance is claimed only by an origin-protected POST route", () => {
  assert.equal(Reflect.getMetadata(METHOD_METADATA, OrderController.prototype.download), RequestMethod.POST);
});
