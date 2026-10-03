import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { describe, it } from "node:test";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "../../prisma/client";
import { CredentialCryptoService } from "../../common/security/credential-crypto.service";
import { CheckoutService } from "./checkout.service";
import type { ShippingPolicyService } from "../../integrations/shipping/shipping-policy.service";
import type { AdminShippingPolicy, ShippingPolicyRule } from "@topgsm/shared-types";

function offer(input: { id: string; sellerId: string; type: "digital" | "physical" | "service"; price: string; stock?: number; weightGrams?: number; lengthCm?: number | null; url?: string; physicalGranted?: boolean; shippingReady?: boolean; serviceInputs?: unknown[] }) {
  return {
    id: input.id,
    price: new Prisma.Decimal(input.price),
    currency: "TOMAN",
    digital: input.type === "digital" ? { file_reference: input.url ?? "https://uploads.example/file", max_downloads: 2 } : null,
    physical: input.type === "physical" ? { stock: input.stock ?? 10, weight_grams: input.weightGrams ?? 200, length_cm: input.lengthCm === undefined ? 15 : input.lengthCm, width_cm: 10, height_cm: 5 } : null,
    service: input.type === "service" ? { input_schema: input.serviceInputs ?? [] } : null,
    listing: {
      seller_id: input.sellerId,
      seller: { id: input.sellerId, shop_name: `Seller ${input.sellerId}`, commission: new Prisma.Decimal("0.1"), permissions: input.type === "physical" && input.physicalGranted !== false ? [{ permission: "physical_products_manage" }] : [], shipping_profile: { enabled: input.shippingReady !== false, latitude: 35, longitude: 51 } },
      product: {
        id: `product-${input.id}`,
        title: `Product ${input.id}`,
        type: input.type,
        price_currency: "TOMAN",
        media: { id: `media-${input.id}`, variants: [{ variant: "thumb", width: 320, height: 240 }] }
      }
    }
  };
}

function service(offers: ReturnType<typeof offer>[], shippingTenants: { listPlacesForConfiguredSeller: (input: { sellerId: string; provinceId?: number }) => Promise<unknown> } = { listPlacesForConfiguredSeller: async () => [] }, policyOrCoupons?: ShippingPolicyService | Array<Record<string, unknown>>, providerConfigured = true, explicitCoupons: Array<Record<string, unknown>> = []) {
  const couponRecords = Array.isArray(policyOrCoupons) ? policyOrCoupons : explicitCoupons;
  const policy = Array.isArray(policyOrCoupons) ? undefined : policyOrCoupons;
  const prisma = {
    seller_offers: { findMany: async () => offers },
    coupons: { findMany: async () => couponRecords },
    checkouts: { findUnique: async () => null },
    $transaction: async (work: (tx: unknown) => Promise<unknown>) => work(prisma),
    payment_method_configs: {
      findMany: async () => [{ provider_code: "zarinpal", seller_rules: [], product_type_rules: [] }]
    }
  };
  const payments = {
    listProviders: async () => [{ code: "zarinpal", name: "Zarinpal", available: true }]
  };
  const usdRates = { getTomanPerUsd: async () => new Prisma.Decimal("232750") };
  return new CheckoutService(prisma as never, payments as never, {} as never, usdRates as never, shippingTenants as never, policy ?? defaultPolicy(), { active: () => ({ isConfigured: async () => providerConfigured }) } as never);
}

const baseRule: ShippingPolicyRule = { payer: "customer", flatRateToman: "300", freeAboveToman: "2000", allowedProvinces: ["Tehran"], maxWeightGrams: 1000, maxLengthCm: 30, maxWidthCm: 20, maxHeightCm: 10 };
function policy(rule: ShippingPolicyRule): ShippingPolicyService {
  const value: AdminShippingPolicy = { defaultRule: rule, sellerRules: [], updatedAt: null };
  return { effective: async () => value, rule: () => rule } as unknown as ShippingPolicyService;
}
function defaultPolicy(): ShippingPolicyService { return policy({ ...baseRule, payer: "site", flatRateToman: "0", freeAboveToman: null, allowedProvinces: [], maxWeightGrams: null, maxLengthCm: null, maxWidthCm: null, maxHeightCm: null }); }

describe("CheckoutService quotes", () => {
  it("requires a buyer to review a total that changed before checkout creation", async () => {
    const digital = offer({ id: "00000000-0000-4000-8000-000000000136", sellerId: "seller-a", type: "digital", price: "1000" });
    await assert.rejects(() => service([digital]).create({ id: "buyer-id", role: "buyer" } as never, {
      items: [{ offerId: digital.id, quantity: 1 }], paymentSelections: [{ orderGroupKey: "seller-a:digital", providerCode: "zarinpal" }], expectedTotalAmount: "900"
    }, "11111111-1111-4111-8111-111111111111"), /total changed/i);
  });

  it("adds customer postage once per physical seller group and waives it above the threshold", async () => {
    const physical = offer({ id: "00000000-0000-4000-8000-000000000130", sellerId: "seller-a", type: "physical", price: "1000" });
    const checkout = service([physical], undefined, policy(baseRule));
    const paid = await checkout.quote({ items: [{ offerId: physical.id, quantity: 1 }] });
    assert.equal(paid.totalAmount, "1300");
    assert.equal(paid.groups[0]!.shippingCost, "300");
    assert.equal(paid.groups[0]!.shippingFee, "300");
    assert.equal("parcel" in paid.groups[0]!.items[0]!, false);
    const free = await checkout.quote({ items: [{ offerId: physical.id, quantity: 2 }] });
    assert.equal(free.totalAmount, "2000");
    assert.equal(free.groups[0]!.shippingCost, "300");
    assert.equal(free.groups[0]!.shippingFee, "0");
    assert.equal(free.groups[0]!.shippingPayer, "site");
  });

  it("keeps seller funded postage out of the customer total", async () => {
    const physical = offer({ id: "00000000-0000-4000-8000-000000000132", sellerId: "seller-a", type: "physical", price: "1000" });
    const result = await service([physical], undefined, policy({ ...baseRule, payer: "seller", freeAboveToman: null })).quote({ items: [{ offerId: physical.id, quantity: 1 }] });
    assert.equal(result.totalAmount, "1000");
    assert.equal(result.groups[0]!.shippingFee, "0");
    assert.equal(result.groups[0]!.shippingCost, "300");
    assert.equal(result.groups[0]!.shippingPayer, "seller");
    const aboveThreshold = await service([physical], undefined, policy({ ...baseRule, payer: "seller" })).quote({ items: [{ offerId: physical.id, quantity: 2 }] });
    assert.equal(aboveThreshold.groups[0]!.shippingPayer, "seller");
  });

  it("filters province choices using the configured destination rule", async () => {
    const physical = offer({ id: "00000000-0000-4000-8000-000000000133", sellerId: "seller-a", type: "physical", price: "1000" });
    const checkout = service([physical], { listPlacesForConfiguredSeller: async () => [{ id: 1, title: "Tehran", parentId: null }, { id: 2, title: "Fars", parentId: null }] }, policy(baseRule));
    const result = await checkout.shippingPlaces({ items: [{ offerId: physical.id, quantity: 1 }] });
    assert.deepEqual(result, [{ id: 1, title: "Tehran", parentId: null }]);
  });

  it("intersects destination provinces across sellers in a physical cart", async () => {
    const first = offer({ id: "00000000-0000-4000-8000-000000000137", sellerId: "seller-a", type: "physical", price: "1000" });
    const second = offer({ id: "00000000-0000-4000-8000-000000000138", sellerId: "seller-b", type: "physical", price: "1000" });
    const value: AdminShippingPolicy = { defaultRule: baseRule, sellerRules: [{ sellerId: "seller-b", rule: { ...baseRule, allowedProvinces: ["Fars"] } }], updatedAt: null };
    const configured = { effective: async () => value, rule: (_value: AdminShippingPolicy, sellerId: string) => value.sellerRules.find((item) => item.sellerId === sellerId)?.rule ?? value.defaultRule } as unknown as ShippingPolicyService;
    const checkout = service([first, second], { listPlacesForConfiguredSeller: async () => [{ id: 1, title: "Tehran", parentId: null }, { id: 2, title: "Fars", parentId: null }] }, configured);
    assert.deepEqual(await checkout.shippingPlaces({ items: [{ offerId: first.id, quantity: 1 }, { offerId: second.id, quantity: 1 }] }), []);
  });

  it("rejects blocked destinations and unknown parcel dimensions when limits apply", async () => {
    const physical = offer({ id: "00000000-0000-4000-8000-000000000131", sellerId: "seller-a", type: "physical", price: "1000" });
    const checkout = service([physical], undefined, policy(baseRule));
    await assert.rejects(() => checkout.quote({ items: [{ offerId: physical.id, quantity: 1 }], shippingAddress: { recipientName: "Buyer", phoneNumber: "09123456789", province: "Fars", city: "Shiraz", postalCode: "1234567890", addressLine: "A complete street address" } }), /unavailable/i);
    const noDimensions = offer({ id: physical.id, sellerId: "seller-a", type: "physical", price: "1000", lengthCm: null });
    await assert.rejects(() => service([noDimensions], undefined, policy(baseRule)).quote({ items: [{ offerId: physical.id, quantity: 1 }] }), /dimension/i);
  });

  const coupon = (overrides: Record<string, unknown> = {}) => ({
    id: "34b91c96-6c02-4a8d-aadb-3caec91779fe",
    seller_id: null,
    discount_type: "percentage",
    discount_value: new Prisma.Decimal("10"),
    currency: "TOMAN",
    minimum_order_amount: null,
    maximum_redemptions: null,
    redeemed_count: 0,
    starts_at: new Date("2020-01-01T00:00:00.000Z"),
    expires_at: null,
    active: true,
    ...overrides
  });

  it("applies an all-sellers coupon to every seller group", async () => {
    const first = offer({ id: "00000000-0000-4000-8000-000000000141", sellerId: "seller-a", type: "digital", price: "1000" });
    const second = offer({ id: "00000000-0000-4000-8000-000000000142", sellerId: "seller-b", type: "digital", price: "2000" });
    const quote = await service([first, second], undefined, [coupon()]).quote({
      items: [{ offerId: first.id, quantity: 1 }, { offerId: second.id, quantity: 1 }], couponCode: "SAVE10"
    });
    assert.equal(quote.discountAmount, "300");
    assert.equal(quote.totalAmount, "2700");
    assert.deepEqual(quote.groups.map((group) => group.discountAmount), ["100", "200"]);
    assert.equal("couponId" in quote, false);
  });

  it("discounts products from every seller without discounting customer postage", async () => {
    const physical = offer({ id: "00000000-0000-4000-8000-000000000146", sellerId: "seller-a", type: "physical", price: "1000" });
    const digital = offer({ id: "00000000-0000-4000-8000-000000000147", sellerId: "seller-b", type: "digital", price: "2000" });
    const quote = await service([physical, digital], undefined, policy(baseRule), true, [coupon()]).quote({
      items: [{ offerId: physical.id, quantity: 1 }, { offerId: digital.id, quantity: 1 }], couponCode: "SAVE10"
    });
    assert.equal(quote.discountAmount, "300");
    assert.equal(quote.totalAmount, "3000");
    assert.deepEqual(quote.groups.map((group) => [group.discountAmount, group.shippingFee, group.totalAmount]), [["100", "300", "1200"], ["200", "0", "1800"]]);
  });

  it("limits a seller coupon to that seller's products in a mixed cart", async () => {
    const first = offer({ id: "00000000-0000-4000-8000-000000000143", sellerId: "seller-a", type: "digital", price: "1000" });
    const second = offer({ id: "00000000-0000-4000-8000-000000000144", sellerId: "seller-b", type: "digital", price: "2000" });
    const quote = await service([first, second], undefined, [coupon({ seller_id: "seller-a", discount_type: "fixed", discount_value: new Prisma.Decimal("150") })]).quote({
      items: [{ offerId: first.id, quantity: 1 }, { offerId: second.id, quantity: 1 }], couponCode: "SELLER150"
    });
    assert.equal(quote.discountAmount, "150");
    assert.deepEqual(quote.groups.map((group) => group.totalAmount), ["850", "2000"]);
  });

  it("keeps minimum and redemption limits for all-sellers coupons", async () => {
    const item = offer({ id: "00000000-0000-4000-8000-000000000145", sellerId: "seller-a", type: "digital", price: "1000" });
    const input = { items: [{ offerId: item.id, quantity: 1 }], couponCode: "SAVE10" };
    await assert.rejects(() => service([item], undefined, [coupon({ minimum_order_amount: new Prisma.Decimal("2000") })]).quote(input), /coupon minimum/i);
    await assert.rejects(() => service([item], undefined, [coupon({ maximum_redemptions: 1, redeemed_count: 1 })]).quote(input), /no longer available/i);
  });

  it("loads shipping places through a seller derived from validated physical offers", async () => {
    const calls: Array<{ sellerId: string; provinceId?: number }> = [];
    const physicalOffer = offer({ id: "00000000-0000-4000-8000-000000000120", sellerId: "seller-a", type: "physical", price: "1000" });
    const result = await service([physicalOffer], {
      listPlacesForConfiguredSeller: async (input) => {
        calls.push(input);
        return [{ id: 360, title: "تهران", parentId: 8 }];
      }
    }).shippingPlaces({ items: [{ offerId: physicalOffer.id, quantity: 1 }], provinceId: 8 });

    assert.deepEqual(result, [{ id: 360, title: "تهران", parentId: 8 }]);
    assert.deepEqual(calls, [{ sellerId: "seller-a", provinceId: 8 }]);
  });

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
    assert.ok(result.commonPaymentMethods.some((method) => method.code === "zarinpal" && method.name === "Zarinpal"));
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

  it("rejects physical checkout when the sender profile or parcel weight is unusable", async () => {
    const id = "00000000-0000-4000-8000-000000000134";
    await assert.rejects(() => service([offer({ id, sellerId: "seller-a", type: "physical", price: "1000", shippingReady: false })]).quote({ items: [{ offerId: id, quantity: 1 }] }), /not currently available/i);
    await assert.rejects(() => service([offer({ id, sellerId: "seller-a", type: "physical", price: "1000", weightGrams: 0 })]).quote({ items: [{ offerId: id, quantity: 1 }] }), /parcel weight/i);
  });

  it("rejects physical checkout when the postal provider is unconfigured", async () => {
    const id = "00000000-0000-4000-8000-000000000135";
    await assert.rejects(() => service([offer({ id, sellerId: "seller-a", type: "physical", price: "1000" })], undefined, undefined, false).quote({ items: [{ offerId: id, quantity: 1 }] }), /not configured/i);
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
    usdOffer.listing.product.price_currency = "USD";
    const result = await service([usdOffer]).quote({ items: [{ offerId: usdOffer.id, quantity: 2 }] });
    assert.equal(result.currency, "TOMAN");
    assert.equal(result.groups[0]!.items[0]!.unitPrice, "2909375");
    assert.equal(result.totalAmount, "5818750");
    assert.equal(result.usdToTomanRate, "232750");
  });

  it("rejects a legacy toman offer when its product uses USD", async () => {
    const staleOffer = offer({ id: "00000000-0000-4000-8000-000000000107", sellerId: "seller-a", type: "physical", price: "1000" });
    staleOffer.listing.product.price_currency = "USD";
    await assert.rejects(
      () => service([staleOffer]).quote({ items: [{ offerId: staleOffer.id, quantity: 1 }] }),
      /unavailable/i
    );
  });
});

describe("CheckoutService service answer encryption", () => {
  it("encrypts service answers with the dedicated key namespace and item-bound AAD", () => {
    const key = randomBytes(32).toString("base64");
    const crypto = new CredentialCryptoService(new ConfigService({
      SERVICE_INPUT_CURRENT_KEY_ID: "service1",
      SERVICE_INPUT_CREDENTIAL_KEYS: `service1:${key}`
    }));
    const checkout = new CheckoutService({} as never, {} as never, {} as never, {} as never, {} as never, defaultPolicy(), {} as never, crypto);
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
