import { strict as assert } from "node:assert";
import { createHmac } from "node:crypto";
import { describe, it } from "node:test";
import type { PrismaService } from "../../prisma/prisma.service";
import type { GoghdiSettingsService } from "./goghdi-settings.service";
import { GoghdiService } from "./goghdi.service";

const order = {
  id: "123e4567-e89b-42d3-a456-426614174000",
  seller: {
    id: "seller-1",
    shop_name: "Repair Lab",
    goghdi_agent_id: "507f1f77bcf86cd799439011"
  },
  items: [
    { id: "123e4567-e89b-42d3-a456-426614174001", product_type: "service", product_title: "Unlock service" },
    { id: "123e4567-e89b-42d3-a456-426614174002", product_type: "digital", product_title: "Instructions" }
  ]
};

function createService(result: typeof order | null = order) {
  let receivedWhere: unknown;
  const prisma = {
    orders: {
      findFirst: async (query: { where: unknown }) => {
        receivedWhere = query.where;
        return result;
      }
    }
  } as unknown as PrismaService;
  const settings = {
    ticketCredentials: async () => ({ secret: "test-secret" })
  } as unknown as GoghdiSettingsService;
  return { service: new GoghdiService(prisma, settings), where: () => receivedWhere };
}

describe("GoghdiService", () => {
  it("scopes the order to its buyer and creates an SDK 2.0 proof with the selected seller", async () => {
    const fixture = createService();
    const result = await fixture.service.signOrderTicket(order.id, "buyer-1");

    assert.deepEqual(fixture.where(), { id: order.id, buyer_id: "buyer-1" });
    assert.equal(result.options.productId, `order:${order.id}`);
    assert.deepEqual(result.options.agentIds, [order.seller.goghdi_agent_id]);
    assert.deepEqual(JSON.parse(result.options.chatInfo), {
      orderId: order.id,
      sellerId: order.seller.id,
      products: ["Unlock service", "Instructions"]
    });
    assert.match(result.proof.nonce, /^[A-Za-z0-9_-]{32}$/);
    assert.equal(
      result.proof.signature,
      createHmac("sha256", "test-secret")
        .update(`${result.proof.timestamp}.${result.proof.nonce}.${JSON.stringify(result.options)}`)
        .digest("hex")
    );
  });

  it("does not reveal an unknown or another buyer's order", async () => {
    const { service } = createService(null);
    await assert.rejects(() => service.signOrderTicket(order.id, "buyer-2"), /not found/i);
  });

  it("allows every order type, including digital-only purchases", async () => {
    for (const productType of ["digital", "physical", "service", "bridge"]) {
      const fixture = createService({
        ...order,
        items: [{ id: order.items[0].id, product_type: productType, product_title: "Purchased item" }]
      });
      const result = await fixture.service.signOrderTicket(order.id, "buyer-1");
      assert.deepEqual(fixture.where(), { id: order.id, buyer_id: "buyer-1" });
      assert.equal(result.options.productId, `order:${order.id}`);
      assert.deepEqual(result.options.agentIds, [order.seller.goghdi_agent_id]);
    }
  });

  it("requires the order's selected seller to have a Goghdi agent ID", async () => {
    const { service } = createService({
      ...order,
      seller: { ...order.seller, goghdi_agent_id: null }
    } as unknown as typeof order);
    await assert.rejects(() => service.signOrderTicket(order.id, "buyer-1"), /seller is not configured/i);
  });

  it("isolates each item's ticket and includes only that product in the signed context", async () => {
    const fixture = createService();
    for (const item of order.items) {
      const result = await fixture.service.signOrderTicket(order.id, "buyer-1", item.id);
      assert.deepEqual(fixture.where(), { id: order.id, buyer_id: "buyer-1", items: { some: { id: item.id } } });
      assert.equal(result.options.productId, `order-item:${item.id}`);
      assert.deepEqual(result.options.agentIds, [order.seller.goghdi_agent_id]);
      assert.deepEqual(JSON.parse(result.options.chatInfo), {
        orderId: order.id, sellerId: order.seller.id, orderItemId: item.id, products: [item.product_title]
      });
      assert.equal(result.proof.signature, createHmac("sha256", "test-secret")
        .update(`${result.proof.timestamp}.${result.proof.nonce}.${JSON.stringify(result.options)}`).digest("hex"));
    }
  });

  it("rejects items outside the selected buyer-owned order", async () => {
    const fixture = createService();
    await assert.rejects(() => fixture.service.signOrderTicket(order.id, "buyer-1", "other-item"), /not found/i);
    const denied = createService(null);
    await assert.rejects(() => denied.service.signOrderTicket(order.id, "other-buyer", order.items[0].id), /not found/i);
  });

  it("routes another seller's purchased item only to that seller", async () => {
    const seller = { ...order.seller, id: "seller-2", goghdi_agent_id: "507f1f77bcf86cd799439012" };
    const fixture = createService({ ...order, seller });
    const result = await fixture.service.signOrderTicket(order.id, "buyer-1", order.items[0].id);
    assert.deepEqual(result.options.agentIds, [seller.goghdi_agent_id]);
    assert.equal(JSON.parse(result.options.chatInfo).sellerId, seller.id);
  });
});
