import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BadRequestException, ConflictException, ForbiddenException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import { Prisma } from "../../prisma/client";
import type { PrismaService } from "../../prisma/prisma.service";
import { ProductBulkService } from "./product-bulk.service";
import { ProductService } from "./product.service";

const productId = "00000000-0000-4000-8000-000000000001";
const actorId = "00000000-0000-4000-8000-000000000002";
const operationId = "00000000-0000-4000-8000-000000000003";

function fixture() {
  const offer = { id: "offer", price: new Prisma.Decimal("10.00000"), currency: "USD", updated_at: new Date("2026-09-01"), physical: { stock: 3 }, _count: { order_items: 0, inventory_reservations: 0 } };
  const product = {
    id: productId, title: "Repair kit", type: "physical", status: "active", category_id: null,
    category_record: null, created_by_seller_id: "seller-a", created_by: { shop_name: "Seller A" },
    tags: ["Tools"], updated_at: new Date("2026-09-01"), bridge_binding: null,
    listings: [{ id: "listing", seller_id: "seller-a", updated_at: new Date("2026-09-01"), offers: [offer] }]
  };
  const seller = { shop_name: "Seller B", approved: true, invited: false, suspended_at: null, merged_into_seller_id: null, permissions: [{ permission: "physical_products_manage" }] };
  let operation: { actor_user_id: string; request_hash: string; product_count: number; offer_count: number } | null = null;
  let writes = 0;
  const db = {
    products: { findMany: async () => [product], updateMany: async () => { product.updated_at = new Date(); writes++; } },
    sellers: { findUnique: async () => seller },
    product_categories: { findUnique: async () => null },
    seller_offers: { update: async (query: { data: { price: Prisma.Decimal } }) => { offer.price = query.data.price; writes++; } },
    product_bulk_operations: {
      findUnique: async () => operation,
      create: async (query: { data: { actor_user_id: string; request_hash: string; product_count: number; offer_count: number } }) => {
        operation = query.data; writes++;
      }
    },
    $transaction: async (run: (tx: unknown) => Promise<unknown>) => run(db)
  };
  return { service: new ProductBulkService(db as unknown as PrismaService), product, offer, seller, getWrites: () => writes };
}

describe("product bulk editing", () => {
  it("previews exact decimal percentage pricing and replays an operation only once", async () => {
    const { service, offer, getWrites } = fixture();
    const request = { productIds: [productId], action: "price_percent" as const, percent: "25" };
    const preview = await service.preview(request);
    assert.equal(preview.items[0]?.before, "10 USD");
    assert.equal(preview.items[0]?.after, "12.5 USD");
    const first = await service.apply({ ...request, operationId, revision: preview.revision }, actorId);
    assert.equal(first.replayed, false);
    assert.equal(offer.price.toString(), "12.5");
    const count = getWrites();
    const replay = await service.apply({ ...request, operationId, revision: preview.revision }, actorId);
    assert.equal(replay.replayed, true);
    assert.equal(getWrites(), count);
  });

  it("rejects stale previews before changing an offer", async () => {
    const { service, product, getWrites } = fixture();
    const request = { productIds: [productId], action: "price_percent" as const, percent: "10" };
    const preview = await service.preview(request);
    product.updated_at = new Date("2026-09-02");
    await assert.rejects(() => service.apply({ ...request, operationId, revision: preview.revision }, actorId), ConflictException);
    assert.equal(getWrites(), 0);
  });

  it("rejects seller transfer with order history and invalid action values", async () => {
    const { service, offer } = fixture();
    offer._count.order_items = 1;
    await assert.rejects(() => service.preview({ productIds: [productId], action: "seller", sellerId: "seller-b" }), ConflictException);
    await assert.rejects(() => service.preview({ productIds: [productId], action: "trash", price: "10" }), BadRequestException);
  });

  it("requires the destination seller to have the product permission", async () => {
    const { service, seller } = fixture();
    seller.permissions = [];
    await assert.rejects(() => service.preview({ productIds: [productId], action: "seller", sellerId: "seller-b" }), BadRequestException);
  });

  it("keeps trash and restoration under administrator control", async () => {
    let currentStatus: "active" | "trashed" = "trashed";
    const db = {
      sellers: { findUnique: async () => ({ permissions: [{ permission: "products_publish" }] }) },
      $transaction: async (run: (tx: unknown) => Promise<unknown>) => run({ products: { findFirst: async () => ({ id: productId, status: currentStatus }) } })
    };
    const service = new ProductService(db as unknown as PrismaService, { get: () => undefined } as unknown as ConfigService);
    await assert.rejects(() => service.updateProduct("seller-a", productId, actorId, { status: "active" }), ForbiddenException);
    currentStatus = "active";
    await assert.rejects(() => service.updateProduct("seller-a", productId, actorId, { status: "trashed" }), ForbiddenException);
  });
});
