import assert from "node:assert/strict";
import test from "node:test";
import type { AppUser } from "@topgsm/shared-types";
import type { ConfigService } from "@nestjs/config";
import type { PrismaService } from "../../prisma/prisma.service";
import { OrderService } from "./order.service";

const buyer: AppUser = { id: "buyer-1", fullName: "Buyer", email: "buyer@example.com", role: "buyer" };
const seller: AppUser = { ...buyer, role: "seller-admin" };

test("digital access is limited to the buyer's settled offer and returns download limits", async () => {
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
  await assert.rejects(() => service.digitalAccess(seller, "offer-1"), /Only buyers/);
});

test("free download validates the current zero-price active offer before signing", async () => {
  let where: Record<string, unknown> | undefined;
  const prisma = { seller_offers: { findFirst: async (query: { where: Record<string, unknown> }) => {
    where = query.where;
    return { currency: "TOMAN", listing: { product: { price_currency: "TOMAN" } }, digital: { file_reference: "https://files.example/first.zip", file_references: ["https://files.example/first.zip", "https://files.example/second.zip"] } };
  } } } as unknown as PrismaService;
  const config = { get: (key: string) => key === "UPLOAD_DOWNLOAD_HOSTS" ? "files.example" : "a".repeat(32) } as ConfigService;
  const service = new OrderService(prisma, undefined, config);
  const url = new URL(await service.freeDigitalDownload(buyer, "offer-1", "127.0.0.1", 1));
  assert.equal(where?.status, "active");
  assert.equal(String(where?.price), "0");
  assert.equal(url.pathname, "/second.zip");
  assert.ok(url.searchParams.has("md5"));
  await assert.rejects(() => service.freeDigitalDownload(buyer, "offer-1", "127.0.0.1", 2), /not found/);
  await assert.rejects(() => service.freeDigitalDownload(seller, "offer-1", "127.0.0.1"), /Only buyers/);
});

test("missing free offer never exposes a paid file", async () => {
  const prisma = { seller_offers: { findFirst: async () => null } } as unknown as PrismaService;
  await assert.rejects(() => new OrderService(prisma).freeDigitalDownload(buyer, "paid-offer", "127.0.0.1"), /not found/);
});
