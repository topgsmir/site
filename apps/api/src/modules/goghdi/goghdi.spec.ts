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
    { product_type: "service", product_title: "Unlock service" },
    { product_type: "digital", product_title: "Instructions" }
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
        items: [{ product_type: productType, product_title: "Purchased item" }]
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
});
