import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { describe, it } from "node:test";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "../../prisma/client";
import { CredentialCryptoService } from "../../common/security/credential-crypto.service";
import { CheckoutService } from "./checkout.service";

function offer(input: { id: string; sellerId: string; type: "digital" | "physical" | "service"; price: string; stock?: number; url?: string; physicalGranted?: boolean; serviceInputs?: unknown[] }) {
  return {
    id: input.id,
    price: new Prisma.Decimal(input.price),
    currency: "TOMAN",
    digital: input.type === "digital" ? { file_reference: input.url ?? "https://uploads.example/file", max_downloads: 2 } : null,
    physical: input.type === "physical" ? { stock: input.stock ?? 10 } : null,
    service: input.type === "service" ? { input_schema: input.serviceInputs ?? [] } : null,
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
    assert.equal("digitalDeliveryUrls" in result.groups[0]!.items[0]!, false);
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

  it("returns seller-defined service inputs and validates supplied answers", async () => {
    const serviceOffer = offer({
      id: "00000000-0000-4000-8000-000000000110",
      sellerId: "seller-a",
      type: "service",
      price: "5000",
      serviceInputs: [{ key: "field_login", label: "Account password", type: "password", required: true, minimumLength: 6, maximumLength: 100 }]
    });
    const checkout = service([serviceOffer]);
    const quote = await checkout.quote({ items: [{ offerId: serviceOffer.id, quantity: 1 }] });
    assert.deepEqual(quote.groups[0]!.items[0]!.serviceInputs, [{
      key: "field_login", label: "Account password", type: "password", required: true, minimumLength: 6, maximumLength: 100
    }]);
    await assert.rejects(
      () => checkout.quote({ items: [{ offerId: serviceOffer.id, quantity: 1, serviceAnswers: [{ key: "field_login", value: "short" }] }] }),
      /invalid length/i
    );
    await assert.rejects(
      () => checkout.quote({ items: [{ offerId: serviceOffer.id, quantity: 1, serviceAnswers: [{ key: "unknown", value: "anything" }] }] }),
      /unknown service field/i
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

describe("CheckoutService service answer encryption", () => {
  it("encrypts service answers with the dedicated key namespace and item-bound AAD", () => {
    const key = randomBytes(32).toString("base64");
    const crypto = new CredentialCryptoService(new ConfigService({
      SERVICE_INPUT_CURRENT_KEY_ID: "service1",
      SERVICE_INPUT_CREDENTIAL_KEYS: `service1:${key}`
    }));
    const checkout = new CheckoutService({} as never, {} as never, {} as never, {} as never, crypto);
    const encrypt = checkout as unknown as {
      encryptServiceAnswers(itemId: string, answers: Array<{ key: string; value: string }>): { ciphertext: string; keyId: string } | null;
    };
    const envelope = encrypt.encryptServiceAnswers("item-1", [{ key: "field_password", value: "customer-secret" }]);
    assert.ok(envelope);
    assert.equal(envelope.keyId, "service1");
    assert.equal(envelope.ciphertext.includes("customer-secret"), false);
    assert.equal(
      crypto.decrypt(envelope.ciphertext, envelope.keyId, "service-order-item:item-1:answers", "SERVICE_INPUT"),
      JSON.stringify([{ key: "field_password", value: "customer-secret" }])
    );
    assert.throws(
      () => crypto.decrypt(envelope.ciphertext, envelope.keyId, "service-order-item:item-2:answers", "SERVICE_INPUT"),
      /could not be decrypted/i
    );
  });
});
