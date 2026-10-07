import assert from "node:assert/strict";
import test from "node:test";
import type { AppUser, Role } from "@topgsm/shared-types";
import type { ConfigService } from "@nestjs/config";
import type { PrismaService } from "../../prisma/prisma.service";
import { OrderService } from "./order.service";

const roles: Role[] = ["buyer", "seller-admin", "seller-staff", "platform-admin", "platform-staff"];
const config = { get: (key: string) => key === "UPLOAD_DOWNLOAD_HOSTS" ? "files.example" : "a".repeat(32) } as ConfigService;

for (const role of roles) {
  const buyer: AppUser = { id: "buyer-1", fullName: "Buyer", email: "buyer@example.com", role };

  test(`${role}: digital access is limited to the account's settled offer and returns download limits`, async () => {
    let where: Record<string, unknown> | undefined;
    const prisma = { orders: { findFirst: async (query: { where: Record<string, unknown> }) => {
      where = query.where;
      return {
        id: "order-1",
        items: [{ id: "item-1", digital_entitlement: [{ file_index: 0, delivery_url: "https://files.example/file.zip", max_downloads: 2, download_count: 1 }] }]
      };
    } } } as unknown as PrismaService;
    const service = new OrderService(prisma);
    const result = await service.digitalAccess(buyer, "offer-1");
    assert.equal(where?.buyer_id, buyer.id);
    assert.deepEqual(where?.status, { in: ["paid", "processing", "awaiting_confirmation", "delivered"] });
    assert.deepEqual(where?.items, { some: { offer_id: "offer-1", product_type: "digital", digital_entitlement: { some: { buyer_id: buyer.id } } } });
    assert.equal(result.orderId, "order-1");
    assert.equal(result.itemId, "item-1");
    assert.equal(result.files[0]?.downloadUrl, "/orders/order-1/items/item-1/download?fileIndex=0");
    assert.equal(result.files[0]?.maxDownloads, 2);
    assert.equal(result.files[0]?.downloadCount, 1);
  });

  test(`${role}: free download validates the current zero-price active offer before signing`, async () => {
    let where: Record<string, unknown> | undefined;
    const prisma = { seller_offers: { findFirst: async (query: { where: Record<string, unknown> }) => {
      where = query.where;
      return { currency: "TOMAN", listing: { product: { price_currency: "TOMAN" } }, digital: { file_reference: "https://files.example/first.zip", file_references: ["https://files.example/first.zip", "https://files.example/second.zip"] } };
    } } } as unknown as PrismaService;
    const service = new OrderService(prisma, undefined, config);
    const url = new URL(await service.freeDigitalDownload(buyer, "offer-1", "127.0.0.1", 1));
    assert.equal(where?.status, "active");
    assert.equal(String(where?.price), "0");
    assert.deepEqual(where?.listing, {
      status: "active", seller: { invited: false, approved: true, suspended_at: null },
      product: { status: "active", type: "digital" }
    });
    assert.equal(url.pathname, "/second.zip");
    assert.ok(url.searchParams.has("md5"));
    await assert.rejects(() => service.freeDigitalDownload(buyer, "offer-1", "127.0.0.1", 2), /not found/);
  });

  test(`${role}: missing free offer never exposes a paid file`, async () => {
    const prisma = { seller_offers: { findFirst: async () => null } } as unknown as PrismaService;
    await assert.rejects(() => new OrderService(prisma).freeDigitalDownload(buyer, "paid-offer", "127.0.0.1"), /not found/);
  });

  test(`${role}: unpaid or other accounts' purchases grant no digital access`, async () => {
    const prisma = { orders: { findFirst: async (query: { where: { buyer_id: string; status: unknown } }) => {
      assert.equal(query.where.buyer_id, buyer.id);
      assert.deepEqual(query.where.status, { in: ["paid", "processing", "awaiting_confirmation", "delivered"] });
      return null;
    } } } as unknown as PrismaService;
    assert.deepEqual(await new OrderService(prisma).digitalAccess(buyer, "offer-1"), { orderId: null, itemId: null, files: [] });
  });

  test(`${role}: claiming a paid file checks ownership, settled status and download allowance`, async () => {
    let count = 0;
    let available = true;
    const tx = { digital_entitlements: {
      findFirst: async ({ where }: { where: Record<string, unknown> }) => {
        assert.deepEqual(where, { order_item_id: "item-1", file_index: 1, buyer_id: buyer.id,
          order_item: { order_id: "order-1", order: { buyer_id: buyer.id, status: { in: ["paid", "processing", "awaiting_confirmation", "delivered"] } } } });
        return available ? { id: "entitlement-1", delivery_url: "https://files.example/second.zip", max_downloads: 1, download_count: count } : null;
      },
      updateMany: async ({ where }: { where: unknown }) => {
        assert.deepEqual(where, { id: "entitlement-1", download_count: { lt: 1 } });
        count++;
        return { count: 1 };
      }
    } };
    const prisma = { $transaction: async (work: (value: typeof tx) => Promise<unknown>) => work(tx) } as unknown as PrismaService;
    const service = new OrderService(prisma, undefined, config);
    const url = new URL(await service.claimDigitalDownload(buyer, "order-1", "item-1", "127.0.0.1", 1));
    assert.equal(url.pathname, "/second.zip");
    assert.ok(url.searchParams.has("md5"));
    await assert.rejects(() => service.claimDigitalDownload(buyer, "order-1", "item-1", "127.0.0.1", 1), /download limit/);
    available = false;
    await assert.rejects(() => service.claimDigitalDownload(buyer, "order-1", "item-1", "127.0.0.1", 1), /not found/);
    assert.equal(count, 1);
  });
}
