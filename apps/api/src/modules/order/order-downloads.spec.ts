import assert from "node:assert/strict";
import test from "node:test";
import type { AppUser } from "@topgsm/shared-types";
import type { PrismaService } from "../../prisma/prisma.service";
import { OrderService } from "./order.service";

const buyer: AppUser = { id: "buyer-1", fullName: "Buyer", email: "buyer@example.com", role: "buyer" };

test("listDownloads scopes entitlements to the authenticated buyer and settled orders", async () => {
  let where: Record<string, unknown> | undefined;
  const prisma = {
    digital_entitlements: {
      findMany: async (query: { where: Record<string, unknown> }) => {
        where = query.where;
        return [{
          id: "entitlement-1",
          file_index: 0,
          delivery_url: "https://files.example/guide.zip",
          max_downloads: 3,
          download_count: 1,
          last_accessed_at: null,
          created_at: new Date("2026-01-02T00:00:00.000Z"),
          order_item: {
            id: "item-1",
            product_title: "Repair guide",
            digital_delivery_titles: ["Guide ZIP"],
            offer: { listing: { product_id: "product-1" } },
            order: { id: "order-1", status: "paid", seller: { shop_name: "Top Tools" } }
          }
        }];
      }
    }
  } as unknown as PrismaService;

  const result = await new OrderService(prisma).listDownloads(buyer, { limit: 20 });
  assert.equal(where?.buyer_id, buyer.id);
  assert.deepEqual(where?.order_item, {
    product_type: "digital",
    order: { buyer_id: buyer.id, status: { in: ["paid", "processing", "awaiting_confirmation", "delivered"] } }
  });
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0]?.orderId, "order-1");
  assert.equal(result.items[0]?.productTitle, "Repair guide");
  assert.equal(result.items[0]?.file.title, "Guide ZIP");
  assert.equal(result.items[0]?.file.downloadUrl, "/orders/order-1/items/item-1/download?fileIndex=0");
  assert.equal(result.items[0]?.file.downloadCount, 1);
  assert.equal(result.nextCursor, null);
});

test("listDownloads rejects short search terms and missing cursors", async () => {
  const prisma = {
    digital_entitlements: {
      findFirst: async () => null,
      findMany: async () => []
    }
  } as unknown as PrismaService;
  const service = new OrderService(prisma);
  await assert.rejects(() => service.listDownloads(buyer, { limit: 20, search: "ab" }), /at least 3/);
  await assert.rejects(() => service.listDownloads(buyer, { limit: 20, cursor: "00000000-0000-4000-8000-000000000099" }), /cursor was not found/);
});
