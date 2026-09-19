import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import type { AppUser } from "@topgsm/shared-types";
import type { PrismaService } from "../../prisma/prisma.service";
import { OrderService } from "./order.service";

const buyer: AppUser = { id: "buyer-1", fullName: "Buyer", email: "buyer@example.com", role: "buyer" };
const createdAt = new Date("2026-09-19T10:00:00.000Z");
const summary = {
  id: "order-1", status: "paid", currency: "IRR", total_amount: { toString: () => "120000" }, created_at: createdAt,
  seller: { shop_name: "Example seller" },
  items: [{ id: "item-1", product_title: "Repair file", product_type: "digital", quantity: 1 }]
};

describe("buyer order reads", () => {
  it("scopes the history query and returns only buyer-safe summary fields", async () => {
    let selected: unknown;
    const prisma = { orders: { findMany: async (args: { where: unknown; select: unknown }) => { selected = args; return [summary]; } } } as unknown as PrismaService;
    const page = await new OrderService(prisma).list(buyer, { limit: 20 });
    assert.deepEqual((selected as { where: unknown }).where, { buyer_id: buyer.id });
    assert.deepEqual(Object.keys(page.items[0]!).sort(), ["createdAt", "currency", "id", "items", "seller", "status", "totalAmount"]);
    assert.equal("commissionRate" in page.items[0]!, false);
    assert.equal("holdbackRate" in page.items[0]!, false);
    assert.equal("bridge" in page.items[0]!.items[0]!, false);
  });

  it("hides another buyer's order and omits internal rates from owned details", async () => {
    const record = {
      ...summary, buyer_id: buyer.id, seller_id: "seller-1", checkout_id: null, traffic_source: null,
      commission_rate: { toString: () => "0.1" }, holdback_rate: { toString: () => "0.05" }, updated_at: createdAt,
      buyer: { full_name: buyer.fullName, email: buyer.email, phone_number: null },
      shipping_address: null, shipment: null, amadast_shipment: null, items: []
    };
    const prisma = { orders: { findFirst: async ({ where }: { where: { buyer_id: string; id: string } }) => where.buyer_id === buyer.id ? record : null } } as unknown as PrismaService;
    const service = new OrderService(prisma);
    const detail = await service.get(buyer, record.id);
    assert.equal("commissionRate" in detail, false);
    assert.equal("holdbackRate" in detail, false);
    assert.equal("trafficSource" in detail, false);
    await assert.rejects(() => service.get({ ...buyer, id: "buyer-2" }, record.id), /Order was not found/);
  });
});
