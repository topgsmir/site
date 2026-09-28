import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { ConflictException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type { PrismaService } from "../../prisma/prisma.service";
import { ProductService } from "./product.service";

const productId = "00000000-0000-4000-8000-000000000001";
const sourceId = "00000000-0000-4000-8000-000000000002";
const destinationId = "00000000-0000-4000-8000-000000000003";
const actorId = "00000000-0000-4000-8000-000000000004";
const listingId = "00000000-0000-4000-8000-000000000005";

function product(sold = false) {
  return {
    title: "Test product", slug: "test-product", description: null, category_record: null,
    status: "active", type: "digital", created_by: { id: sourceId, shop_name: "Source" },
    bridge_binding: null,
    listings: [{ id: listingId, seller_id: sourceId, offers: [{ _count: { order_items: sold ? 1 : 0, inventory_reservations: 0 } }] }]
  };
}

describe("product seller transfer", () => {
  it("moves ownership and the unsold listing in one transaction and records both sellers", async () => {
    const writes: string[] = [];
    let event: { data: { changed_fields: string[]; before_snapshot: { seller: { id: string } }; after_snapshot: { seller: { id: string } } } } | undefined;
    const transaction = {
      products: {
        findUnique: async () => product(),
        update: async () => { writes.push("product"); }
      },
      sellers: { findFirst: async () => ({ id: destinationId, shop_name: "Destination", permissions: [{ permission: "products_manage" }] }) },
      seller_listings: { update: async () => { writes.push("listing"); } },
      product_change_events: { create: async (input: typeof event) => { event = input; writes.push("audit"); } }
    };
    const service = new ProductService({
      $transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback(transaction)
    } as unknown as PrismaService, { get: () => undefined } as unknown as ConfigService);
    service.getAdminProduct = async () => ({ seller: { id: destinationId } }) as Awaited<ReturnType<ProductService["getAdminProduct"]>>;

    const result = await service.transferProductSeller(productId, actorId, destinationId);
    assert.equal(result.seller.id, destinationId);
    assert.deepEqual(writes, ["listing", "product", "audit"]);
    assert.deepEqual(event?.data.changed_fields, ["seller"]);
    assert.equal(event?.data.before_snapshot.seller.id, sourceId);
    assert.equal(event?.data.after_snapshot.seller.id, destinationId);
  });

  it("rejects a transfer after a sale without writing ownership", async () => {
    const service = new ProductService({
      $transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback({
        products: { findUnique: async () => product(true), update: async () => assert.fail("ownership changed") },
        sellers: { findFirst: async () => ({ id: destinationId, shop_name: "Destination", permissions: [{ permission: "products_manage" }] }) },
        seller_listings: { update: async () => assert.fail("listing changed") }
      })
    } as unknown as PrismaService, { get: () => undefined } as unknown as ConfigService);
    await assert.rejects(() => service.transferProductSeller(productId, actorId, destinationId), ConflictException);
  });

  it("rejects a destination that already has a listing", async () => {
    const existing = product();
    existing.listings.push({ id: destinationId, seller_id: destinationId, offers: [] });
    const service = new ProductService({
      $transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback({
        products: { findUnique: async () => existing, update: async () => assert.fail("ownership changed") },
        sellers: { findFirst: async () => ({ id: destinationId, shop_name: "Destination", permissions: [{ permission: "products_manage" }] }) },
        seller_listings: { update: async () => assert.fail("listing changed") }
      })
    } as unknown as PrismaService, { get: () => undefined } as unknown as ConfigService);
    await assert.rejects(() => service.transferProductSeller(productId, actorId, destinationId), ConflictException);
  });
});
