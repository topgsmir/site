import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { randomUUID } from "node:crypto";
import type { AppUser } from "@topgsm/shared-types";
import type { BasePaymentAdapter } from "../../integrations/payments/base-payment.adapter";
import { PaymentApplicationService } from "../../integrations/payments/payment-application.service";
import type { PaymentCredentialService } from "../../integrations/payments/payment-credential.service";
import type { PaymentIntentInput } from "../../integrations/payments/payment.interface";
import type { PaymentService } from "../../integrations/payments/payment.service";
import { PrismaService } from "../../prisma/prisma.service";
import { Prisma } from "../../prisma/client";
import { assertDedicatedTestDatabase } from "../../test/test-database";
import { CheckoutService } from "./checkout.service";
import { ShippingPolicyService } from "../../integrations/shipping/shipping-policy.service";
import { UsdRateService } from "../usd-rate/usd-rate.service";
import { ConfigService } from "@nestjs/config";
import { OrderService } from "../order/order.service";

assertDedicatedTestDatabase();
const prisma = new PrismaService();
const suffix = randomUUID();
const adapter = {
  providerCode: "zarinpal",
  displayName: "Zarinpal test",
  supportedCurrencies: ["TOMAN"],
  supportsRefunds: true,
  availability: async () => ({ available: true, unavailabilityReason: null, configuration: null }),
  paymentUrl: (authority: string) => `https://pay.example/${authority}`,
  initiate: async (input: PaymentIntentInput) => ({ providerReferenceId: `authority-${input.operationId}`, paymentUrl: `https://pay.example/${input.operationId}`, status: "pending" as const }),
  verify: async () => ({ verified: true, referenceId: `ref-${suffix}` }),
  inquiry: async () => true,
  refund: async () => null
} satisfies BasePaymentAdapter;
const paymentService = {
  get: () => adapter,
  listProviders: async () => [{ code: "zarinpal", name: "Zarinpal test", available: true, unavailabilityReason: null, currencies: ["TOMAN"], supportsRefunds: true, configuration: null }],
  initiateWithProvider: (_code: string, input: PaymentIntentInput) => adapter.initiate(input)
} as unknown as PaymentService;
const application = new PaymentApplicationService(prisma, paymentService, {} as PaymentCredentialService);
const checkouts = new CheckoutService(prisma, paymentService, application, new UsdRateService(prisma), {} as never, new ShippingPolicyService(prisma), { active: () => ({ isConfigured: async () => true }) } as never);

let buyer: AppUser;
let physicalOfferId: string;
let digitalOfferId: string;
let checkoutId: string;
let couponId: string;

before(async () => {
  await prisma.$connect();
  const created = await prisma.$transaction(async (tx) => {
    const buyerUser = await tx.users.create({ data: { full_name: "Checkout Buyer", email: `checkout-buyer-${suffix}@example.com`, role: "buyer" } });
    const sellerUsers = [];
    for (const name of ["Physical", "Digital"]) sellerUsers.push(await tx.users.create({ data: { full_name: `${name} Seller`, email: `${name.toLowerCase()}-${suffix}@example.com`, role: "seller_admin" } }));
    const sellers = [];
    for (const [index, user] of sellerUsers.entries()) sellers.push(await tx.sellers.create({ data: { user_id: user.id, shop_name: `Checkout Shop ${index}`, approved: true, commission: "0.10", holdback_rate: "0.05" } }));
    await tx.seller_permissions.create({ data: { seller_id: sellers[0]!.id, permission: "physical_products_manage" } });
    await tx.seller_shipping_profiles.create({ data: { seller_id: sellers[0]!.id, enabled: true, sender_name: "Checkout Sender", sender_mobile: "09123456789", province: "Tehran", city: "Tehran", address_line: "A complete test sender address", postal_code: "1234567890", latitude: 35.7, longitude: 51.4, updated_by_user_id: sellerUsers[0]!.id } });
    const physicalProduct = await tx.products.create({ data: { created_by_seller_id: sellers[0]!.id, title: "Physical checkout item", slug: `physical-checkout-${suffix}`, type: "physical" } });
    const digitalProduct = await tx.products.create({ data: { created_by_seller_id: sellers[1]!.id, title: "Digital checkout item", slug: `digital-checkout-${suffix}`, type: "digital" } });
    const physicalVariant = await tx.product_variants.create({ data: { product_id: physicalProduct.id, option_signature: "a".repeat(64) } });
    const digitalVariant = await tx.product_variants.create({ data: { product_id: digitalProduct.id, option_signature: "b".repeat(64) } });
    const physicalListing = await tx.seller_listings.create({ data: { seller_id: sellers[0]!.id, product_id: physicalProduct.id } });
    const digitalListing = await tx.seller_listings.create({ data: { seller_id: sellers[1]!.id, product_id: digitalProduct.id } });
    const physicalOffer = await tx.seller_offers.create({ data: { listing_id: physicalListing.id, variant_id: physicalVariant.id, price: "1000", currency: "TOMAN", physical: { create: { stock: 3, weight_grams: 100 } } } });
    const digitalOffer = await tx.seller_offers.create({ data: { listing_id: digitalListing.id, variant_id: digitalVariant.id, price: "2000", currency: "TOMAN", digital: { create: { file_reference: "https://uploads.example/test.zip", file_references: ["https://uploads.example/test.zip", "https://uploads.example/second.zip"], max_downloads: 2 } } } });
    await tx.payment_method_configs.upsert({ where: { provider_code: "zarinpal" }, create: { provider_code: "zarinpal", enabled: true }, update: { enabled: true } });
    const coupon = await tx.coupons.create({ data: { seller_id: null, code: `ALL${suffix.replaceAll("-", "").slice(0, 12).toUpperCase()}`, discount_type: "fixed", discount_value: "300", currency: "TOMAN", maximum_redemptions: 1 } });
    return { buyerUser, physicalOffer, digitalOffer, coupon };
  });
  buyer = { id: created.buyerUser.id, fullName: created.buyerUser.full_name, email: created.buyerUser.email, role: "buyer" };
  physicalOfferId = created.physicalOffer.id;
  digitalOfferId = created.digitalOffer.id;
  couponId = created.coupon.id;
});

after(async () => {
  if (checkoutId) {
    const orderIds = (await prisma.orders.findMany({ where: { checkout_id: checkoutId }, select: { id: true } })).map((item) => item.id);
    await prisma.$transaction([
      prisma.digital_entitlements.deleteMany({ where: { order_item: { order_id: { in: orderIds } } } }),
      prisma.inventory_reservations.deleteMany({ where: { order_item: { order_id: { in: orderIds } } } }),
      prisma.payment_attempts.deleteMany({ where: { checkout_payment_group: { checkout_id: checkoutId } } }),
      prisma.checkout_payment_group_orders.deleteMany({ where: { payment_group: { checkout_id: checkoutId } } }),
      prisma.checkout_payment_groups.deleteMany({ where: { checkout_id: checkoutId } }),
      prisma.outbox_deliveries.deleteMany({ where: { event: { aggregate_id: { in: orderIds } } } }),
      prisma.outbox_events.deleteMany({ where: { aggregate_id: { in: orderIds } } }),
      prisma.order_events.deleteMany({ where: { order_id: { in: orderIds } } }),
      prisma.payout_ledger.deleteMany({ where: { order_id: { in: orderIds } } }),
      prisma.order_shipping_addresses.deleteMany({ where: { order_id: { in: orderIds } } }),
      prisma.order_items.deleteMany({ where: { order_id: { in: orderIds } } }),
      prisma.orders.deleteMany({ where: { id: { in: orderIds } } }),
      prisma.checkouts.deleteMany({ where: { id: checkoutId } })
    ]);
  }
  if (couponId) await prisma.coupons.delete({ where: { id: couponId } });
  const offers = await prisma.seller_offers.findMany({ where: { id: { in: [physicalOfferId, digitalOfferId] } }, select: { listing_id: true, variant_id: true, listing: { select: { product_id: true, seller_id: true } } } });
  await prisma.seller_listings.deleteMany({ where: { id: { in: offers.map((item) => item.listing_id) } } });
  await prisma.product_variants.deleteMany({ where: { id: { in: offers.map((item) => item.variant_id) } } });
  await prisma.products.deleteMany({ where: { id: { in: offers.map((item) => item.listing.product_id) } } });
  await prisma.sellers.deleteMany({ where: { id: { in: offers.map((item) => item.listing.seller_id) } } });
  await prisma.users.deleteMany({ where: { email: { endsWith: `${suffix}@example.com` } } });
  await prisma.$disconnect();
});

describe("marketplace checkout persistence", () => {
  it("creates seller/type orders, reserves stock, and settles them with one payment", async () => {
    const key = randomUUID();
    const items = [{ offerId: physicalOfferId, quantity: 2 }, { offerId: digitalOfferId, quantity: 1 }];
    const couponCode = (await prisma.coupons.findUniqueOrThrow({ where: { id: couponId } })).code;
    const sellerId = (await prisma.seller_offers.findUniqueOrThrow({ where: { id: physicalOfferId }, select: { listing: { select: { seller_id: true } } } })).listing.seller_id;
    await assert.rejects(
      () => prisma.coupons.create({ data: { seller_id: sellerId, code: couponCode, discount_type: "percentage", discount_value: "5", currency: "TOMAN" } }),
      (error: unknown) => error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
    );
    const quote = await checkouts.quote({ items, couponCode });
    assert.equal(quote.discountAmount, "300");
    assert.equal(quote.totalAmount, "3700");
    const input = {
      items,
      couponCode,
      paymentSelections: quote.groups.map((group) => ({ orderGroupKey: group.key, providerCode: "zarinpal" })),
      shippingAddress: { recipientName: "Checkout Buyer", phoneNumber: "09123456789", province: "Tehran", city: "Tehran", postalCode: "1234567890", addressLine: "A complete checkout integration test address" }
    };
    const created = await checkouts.create(buyer, input, key);
    checkoutId = created.id;
    const replay = await checkouts.create(buyer, input, key);
    assert.equal(replay.id, created.id);
    assert.equal(created.discountAmount, "300");
    assert.equal((await prisma.coupons.findUniqueOrThrow({ where: { id: couponId } })).redeemed_count, 1);
    await assert.rejects(() => checkouts.quote({ items, couponCode }), /not have enough stock|no longer available/i);
    assert.equal(created.orders.length, 2);
    assert.equal(created.paymentGroups.length, 1);
    assert.equal((await prisma.seller_offer_physical.findUniqueOrThrow({ where: { offer_id: physicalOfferId } })).stock, 1);
    const group = created.paymentGroups[0]!;
    // Editing the offer after checkout must not change the files purchased.
    await prisma.seller_offer_digital.update({ where: { offer_id: digitalOfferId }, data: { file_reference: "https://uploads.example/replacement.zip", file_references: ["https://uploads.example/replacement.zip"] } });
    const payment = await application.initiateCheckoutGroup(buyer, created.id, group.id, randomUUID());
    assert.ok(payment.authority);
    const settled = await application.callback("zarinpal", payment.authority!, "OK");
    assert.equal(settled.status, "succeeded");
    assert.equal(await prisma.orders.count({ where: { checkout_id: created.id, status: "paid" } }), 2);
    assert.equal(await prisma.inventory_reservations.count({ where: { status: "committed", order_item: { order: { checkout_id: created.id } } } }), 1);
    assert.equal(await prisma.digital_entitlements.count({ where: { buyer_id: buyer.id } }), 2);
    await application.callback("zarinpal", payment.authority!, "OK");
    assert.equal(await prisma.digital_entitlements.count({ where: { buyer_id: buyer.id } }), 2);
    const files = await prisma.digital_entitlements.findMany({ where: { buyer_id: buyer.id }, orderBy: { file_index: "asc" }, include: { order_item: true } });
    assert.deepEqual(files.map((file) => file.delivery_url), ["https://uploads.example/test.zip", "https://uploads.example/second.zip"]);
    const orders = new OrderService(prisma, undefined, new ConfigService({ UPLOAD_DOWNLOAD_HOSTS: "uploads.example", UPLOAD_DOWNLOAD_SECRET: "test-secret-that-is-at-least-32-bytes" }));
    const orderId = files[0]!.order_item.order_id;
    const itemId = files[0]!.order_item_id;
    const claim = (index: number) => orders.claimDigitalDownload(buyer, orderId, itemId, "127.0.0.1", index);
    assert.equal(new URL(await claim(1)).pathname, "/second.zip");
    await claim(1);
    await assert.rejects(claim(1), /download limit/);
    assert.equal(new URL(await claim(0)).pathname, "/test.zip");
    await assert.rejects(claim(2), /not found/);
    await assert.rejects(orders.claimDigitalDownload({ ...buyer, id: randomUUID() }, orderId, itemId, "127.0.0.1", 0), /not found/);
    await assert.rejects(orders.claimDigitalDownload({ ...buyer, role: "seller-admin" }, orderId, itemId, "127.0.0.1", 0), /Only buyers/);
    const concurrent = await Promise.allSettled([claim(0), claim(0)]);
    assert.equal(concurrent.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal((await prisma.digital_entitlements.findUniqueOrThrow({ where: { id: files[0]!.id } })).download_count, 2);
    await prisma.orders.update({ where: { id: orderId }, data: { status: "cancelled" } });
    await assert.rejects(claim(0), /not found/);
  });
});
