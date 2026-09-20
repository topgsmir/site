import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Prisma } from "../../prisma/client";
import { CheckoutService } from "./checkout.service";

function offer(input: { id: string; sellerId: string; type: "digital" | "physical" | "service"; price: string; stock?: number; url?: string; physicalGranted?: boolean }) {
  return {
    id: input.id,
    price: new Prisma.Decimal(input.price),
    currency: "TOMAN",
    digital: input.type === "digital" ? { file_reference: input.url ?? "https://uploads.example/file", max_downloads: 2 } : null,
    physical: input.type === "physical" ? { stock: input.stock ?? 10 } : null,
    listing: {
      seller: { id: input.sellerId, shop_name: `Seller ${input.sellerId}`, commission: new Prisma.Decimal("0.1"), holdback_rate: new Prisma.Decimal("0.05"), permissions: input.type === "physical" && input.physicalGranted !== false ? [{ permission: "physical_products_manage" }] : [] },
      product: {
        id: `product-${input.id}`,
        title: `Product ${input.id}`,
        type: input.type,
        media: { id: `media-${input.id}`, variants: [{ variant: "thumb", width: 320, height: 240 }] }
      }
    }
  };
}

function service(offers: ReturnType<typeof offer>[]) {
  const prisma = {
    seller_offers: { findMany: async () => offers },
    payment_method_configs: {
      findMany: async () => [{ provider_code: "zarinpal", seller_rules: [], product_type_rules: [] }]
    }
  };
  const payments = {
    listProviders: async () => [{ code: "zarinpal", name: "Zarinpal", available: true }]
  };
  const usdRates = { getTomanPerUsd: async () => new Prisma.Decimal("232750") };
  return new CheckoutService(prisma as never, payments as never, {} as never, usdRates as never);
}

describe("CheckoutService quotes", () => {
  it("groups a marketplace cart by seller and product type without exposing delivery URLs", async () => {
    const result = await service([
      offer({ id: "00000000-0000-4000-8000-000000000101", sellerId: "seller-a", type: "digital", price: "1000" }),
      offer({ id: "00000000-0000-4000-8000-000000000102", sellerId: "seller-a", type: "physical", price: "2500", stock: 3 }),
      offer({ id: "00000000-0000-4000-8000-000000000103", sellerId: "seller-b", type: "service", price: "5000" })
    ]).quote({ items: [
      { offerId: "00000000-0000-4000-8000-000000000101", quantity: 1 },
      { offerId: "00000000-0000-4000-8000-000000000102", quantity: 2 },
      { offerId: "00000000-0000-4000-8000-000000000103", quantity: 1, serviceNote: "Please call first" }
    ] });

    assert.equal(result.groups.length, 3);
    assert.equal(result.totalAmount, "11000");
    assert.equal(result.requiresShippingAddress, true);
    assert.deepEqual(result.commonPaymentMethods, [{ code: "zarinpal", name: "Zarinpal" }]);
    assert.equal("commissionRate" in result.groups[0]!, false);
    assert.equal("holdbackRate" in result.groups[0]!, false);
    assert.equal("total" in result.groups[0]!, false);
    assert.equal("digitalDeliveryUrl" in result.groups[0]!.items[0]!, false);
    assert.deepEqual(result.groups[0]!.items[0]!.image, {
      url: "/media/media-00000000-0000-4000-8000-000000000101/thumb.webp",
      width: 320,
      height: 240
    });
  });

  it("rejects a physical quantity above authoritative stock", async () => {
    await assert.rejects(
      () => service([offer({ id: "00000000-0000-4000-8000-000000000104", sellerId: "seller-a", type: "physical", price: "1000", stock: 1 })]).quote({ items: [{ offerId: "00000000-0000-4000-8000-000000000104", quantity: 2 }] }),
      (error: unknown) => {
        assert.ok(error instanceof Error && "publicDetails" in error);
        assert.deepEqual((error as Error & { publicDetails: unknown }).publicDetails, {
          code: "CART_STOCK_INSUFFICIENT",
          offerIds: ["00000000-0000-4000-8000-000000000104"]
        });
        return /enough stock/i.test(error.message);
      }
    );
  });

  it("rejects physical checkout after the seller grant is revoked", async () => {
    await assert.rejects(
      () => service([offer({ id: "00000000-0000-4000-8000-000000000109", sellerId: "seller-a", type: "physical", price: "1000", stock: 2, physicalGranted: false })]).quote({ items: [{ offerId: "00000000-0000-4000-8000-000000000109", quantity: 1 }] }),
      (error: unknown) => error instanceof Error && /not currently available/i.test(error.message)
    );
  });

  it("returns the unavailable offer ids needed for cart recovery", async () => {
    await assert.rejects(
      () => service([]).quote({ items: [{ offerId: "00000000-0000-4000-8000-000000000106", quantity: 1 }] }),
      (error: unknown) => {
        assert.ok(error instanceof Error && "publicDetails" in error);
        assert.deepEqual((error as Error & { publicDetails: unknown }).publicDetails, {
          code: "CART_ITEMS_UNAVAILABLE",
          offerIds: ["00000000-0000-4000-8000-000000000106"]
        });
        return true;
      }
    );
  });

  it("rejects legacy non-HTTPS digital references", async () => {
    await assert.rejects(
      () => service([offer({ id: "00000000-0000-4000-8000-000000000105", sellerId: "seller-a", type: "digital", price: "1000", url: "legacy/file.zip" })]).quote({ items: [{ offerId: "00000000-0000-4000-8000-000000000105", quantity: 1 }] }),
      /valid HTTPS/i
    );
  });

  it("converts USD offers to integer toman using the current sell rate", async () => {
    const usdOffer = offer({ id: "00000000-0000-4000-8000-000000000106", sellerId: "seller-a", type: "physical", price: "12.50" });
    usdOffer.currency = "USD";
    const result = await service([usdOffer]).quote({ items: [{ offerId: usdOffer.id, quantity: 2 }] });
    assert.equal(result.currency, "TOMAN");
    assert.equal(result.groups[0]!.items[0]!.unitPrice, "2909375");
    assert.equal(result.totalAmount, "5818750");
  });
});
