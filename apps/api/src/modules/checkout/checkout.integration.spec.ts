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
import { assertDedicatedTestDatabase } from "../../test/test-database";
import { CheckoutService } from "./checkout.service";
import { UsdRateService } from "../usd-rate/usd-rate.service";

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
const checkouts = new CheckoutService(prisma, paymentService, application, new UsdRateService(prisma));

let buyer: AppUser;
let physicalOfferId: string;
let digitalOfferId: string;
let checkoutId: string;

before(async () => {
  await prisma.$connect();
  const created = await prisma.$transaction(async (tx) => {
    const buyerUser = await tx.users.create({ data: { full_name: "Checkout Buyer", email: `checkout-buyer-${suffix}@example.com`, role: "buyer" } });
    const sellerUsers = await Promise.all(["Physical", "Digital"].map((name) => tx.users.create({ data: { full_name: `${name} Seller`, email: `${name.toLowerCase()}-${suffix}@example.com`, role: "seller_admin" } })));
    const sellers = await Promise.all(sellerUsers.map((user, index) => tx.sellers.create({ data: { user_id: user.id, shop_name: `Checkout Shop ${index}`, approved: true, commission: "0.10", holdback_rate: "0.05" } })));
    const physicalProduct = await tx.products.create({ data: { created_by_seller_id: sellers[0]!.id, title: "Physical checkout item", slug: `physical-checkout-${suffix}`, type: "physical" } });
    const digitalProduct = await tx.products.create({ data: { created_by_seller_id: sellers[1]!.id, title: "Digital checkout item", slug: `digital-checkout-${suffix}`, type: "digital" } });
    const physicalVariant = await tx.product_variants.create({ data: { product_id: physicalProduct.id, option_signature: "a".repeat(64) } });
    const digitalVariant = await tx.product_variants.create({ data: { product_id: digitalProduct.id, option_signature: "b".repeat(64) } });
    const physicalListing = await tx.seller_listings.create({ data: { seller_id: sellers[0]!.id, product_id: physicalProduct.id } });
    const digitalListing = await tx.seller_listings.create({ data: { seller_id: sellers[1]!.id, product_id: digitalProduct.id } });
    const physicalOffer = await tx.seller_offers.create({ data: { listing_id: physicalListing.id, variant_id: physicalVariant.id, price: "1000", currency: "TOMAN", physical: { create: { stock: 3, weight_grams: 100 } } } });
    const digitalOffer = await tx.seller_offers.create({ data: { listing_id: digitalListing.id, variant_id: digitalVariant.id, price: "2000", currency: "TOMAN", digital: { create: { file_reference: "https://uploads.example/test.zip", max_downloads: 2 } } } });
    await tx.payment_method_configs.upsert({ where: { provider_code: "zarinpal" }, create: { provider_code: "zarinpal", enabled: true }, update: { enabled: true } });
    return { buyerUser, physicalOffer, digitalOffer };
  });
  buyer = { id: created.buyerUser.id, fullName: created.buyerUser.full_name, email: created.buyerUser.email, role: "buyer" };
  physicalOfferId = created.physicalOffer.id;
  digitalOfferId = created.digitalOffer.id;
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
    const quote = await checkouts.quote({ items });
    const input = {
      items,
      paymentSelections: quote.groups.map((group) => ({ orderGroupKey: group.key, providerCode: "zarinpal" })),
      shippingAddress: { recipientName: "Checkout Buyer", phoneNumber: "09123456789", province: "Tehran", city: "Tehran", postalCode: "1234567890", addressLine: "A complete checkout integration test address" }
    };
    const created = await checkouts.create(buyer, input, key);
    checkoutId = created.id;
    const replay = await checkouts.create(buyer, input, key);
    assert.equal(replay.id, created.id);
    assert.equal(created.orders.length, 2);
    assert.equal(created.paymentGroups.length, 1);
    assert.equal((await prisma.seller_offer_physical.findUniqueOrThrow({ where: { offer_id: physicalOfferId } })).stock, 1);
    const group = created.paymentGroups[0]!;
    const payment = await application.initiateCheckoutGroup(buyer, created.id, group.id, randomUUID());
    assert.ok(payment.authority);
    const settled = await application.callback("zarinpal", payment.authority!, "OK");
    assert.equal(settled.status, "succeeded");
    assert.equal(await prisma.orders.count({ where: { checkout_id: created.id, status: "paid" } }), 2);
    assert.equal(await prisma.inventory_reservations.count({ where: { status: "committed", order_item: { order: { checkout_id: created.id } } } }), 1);
    assert.equal(await prisma.digital_entitlements.count({ where: { buyer_id: buyer.id } }), 1);
  });
});
