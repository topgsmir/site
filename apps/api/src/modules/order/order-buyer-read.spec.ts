import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import type { AppUser } from "@topgsm/shared-types";
import type { PrismaService } from "../../prisma/prisma.service";
import { OrderService } from "./order.service";

const buyer: AppUser = { id: "buyer-1", fullName: "Buyer", email: "buyer@example.com", role: "buyer" };
const createdAt = new Date("2026-09-19T10:00:00.000Z");
const summary = {
  id: "order-1", status: "paid", currency: "TOMAN", total_amount: { toString: () => "120000" }, created_at: createdAt,
  seller: { shop_name: "Example seller", goghdi_agent_id: null },
  items: [{ id: "item-1", product_title: "Repair file", product_type: "digital", quantity: 1 }]
};

describe("buyer order reads", () => {
  it("scopes the history query and returns only buyer-safe summary fields", async () => {
    let selected: unknown;
    const prisma = { orders: { findMany: async (args: { where: unknown; select: unknown }) => { selected = args; return [summary]; } } } as unknown as PrismaService;
    const page = await new OrderService(prisma).list(buyer, { limit: 20 });
    assert.deepEqual((selected as { where: unknown }).where, { buyer_id: buyer.id });
    const item = page.items[0]!;
    assert.deepEqual(Object.keys(item).sort(), ["chatAvailable", "createdAt", "currency", "id", "items", "seller", "status", "totalAmount"]);
    assert.equal("chatAvailable" in item && item.chatAvailable, false);
    assert.equal("commissionRate" in page.items[0]!, false);
    assert.equal("holdbackRate" in page.items[0]!, false);
    assert.equal("bridge" in page.items[0]!.items[0]!, false);
  });

  it("offers chat in order history for every product type when the seller is configured", async () => {
    for (const productType of ["digital", "physical", "service", "bridge"]) {
      for (const agentId of [null, "0123456789abcdef01234567"]) {
        const row = { ...summary, seller: { ...summary.seller, goghdi_agent_id: agentId },
          items: [{ ...summary.items[0], product_type: productType }] };
        const prisma = { orders: { findMany: async () => [row] } } as unknown as PrismaService;
        const page = await new OrderService(prisma).list(buyer, { limit: 20 });
        const item = page.items[0]!;
        assert.equal("chatAvailable" in item && item.chatAvailable, Boolean(agentId));
        assert.deepEqual(item.seller, { shopName: summary.seller.shop_name });
      }
    }
  });

  it("applies search, status, product and UTC date filters within the buyer scope", async () => {
    let query: { where: Record<string, unknown>; orderBy: unknown } | undefined;
    const prisma = { orders: { findMany: async (args: typeof query) => { query = args; return []; } } } as unknown as PrismaService;
    await new OrderService(prisma).list(buyer, {
      limit: 20, search: "  repair  ", status: "paid", productType: "digital",
      dateFrom: "2026-09-19", dateTo: "2026-09-20", sort: "oldest"
    });
    assert.equal(query?.where.buyer_id, buyer.id);
    assert.equal(query?.where.status, "paid");
    assert.deepEqual(query?.where.items, { some: { product_type: "digital" } });
    assert.deepEqual(query?.where.created_at, {
      gte: new Date("2026-09-19T00:00:00.000Z"),
      lt: new Date("2026-09-21T00:00:00.000Z")
    });
    assert.deepEqual(query?.orderBy, [{ created_at: "asc" }, { id: "asc" }]);
    assert.equal((query?.where.OR as Array<{ id?: { contains: string } }>)[0]?.id?.contains, "repair");
  });

  it("rejects invalid or reversed order date ranges", async () => {
    const service = new OrderService({} as PrismaService);
    await assert.rejects(() => service.list(buyer, { limit: 20, dateFrom: "2026-02-31" }), /Invalid order date range/);
    await assert.rejects(() => service.list(buyer, { limit: 20, dateFrom: "2026-09-21", dateTo: "2026-09-20" }), /Invalid order date range/);
  });

  it("does not allow a buyer to request the admin directory projection", async () => {
    const service = new OrderService({} as PrismaService);
    await assert.rejects(() => service.list(buyer, { limit: 20, view: "directory" }), /Platform order access is required/);
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
    assert.equal("chatAvailable" in detail && detail.chatAvailable, false);
    await assert.rejects(() => service.get({ ...buyer, id: "buyer-2" }, record.id), /Order was not found/);
  });

  it("returns detail chat eligibility without exposing the seller's agent identifier", async () => {
    for (const productType of ["physical", "service", "bridge", "digital"]) {
      for (const agentId of [null, "0123456789abcdef01234567"]) {
        const record = {
          ...summary, buyer_id: buyer.id, seller_id: "seller-1", checkout_id: null, traffic_source: null,
          seller: { shop_name: "Seller", goghdi_agent_id: agentId },
          commission_rate: { toString: () => "0.1" }, holdback_rate: { toString: () => "0.05" }, updated_at: createdAt,
          buyer: { full_name: buyer.fullName, email: buyer.email, phone_number: null },
          shipping_address: null, shipment: null, amadast_shipment: null,
          items: [{ ...summary.items[0], product_type: productType, unit_price: summary.total_amount, total_amount: summary.total_amount,
            service_note: null, service_input_schema: null, encrypted_service_answers: null, service_answers_key_id: null,
            digital_entitlement: null, bridge_fulfillment: null }]
        };
        let selection: { seller?: { select: { goghdi_agent_id?: boolean } } } | undefined;
        const prisma = { orders: { findFirst: async ({ select }: { select: typeof selection }) => { selection = select; return record; } } } as unknown as PrismaService;
        const detail = await new OrderService(prisma).get(buyer, record.id);
        assert.equal("chatAvailable" in detail && detail.chatAvailable, Boolean(agentId));
        assert.equal(selection?.seller?.select.goghdi_agent_id, true);
        assert.deepEqual(detail.seller, { id: "seller-1", shopName: "Seller" });
      }
    }
  });
});
