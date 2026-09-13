import { strict as assert } from "node:assert";
import { after, before, beforeEach, describe, it } from "node:test";
import { randomUUID } from "node:crypto";
import type { AppUser } from "@topgsm/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { assertDedicatedTestDatabase } from "../../test/test-database";
import { OrderService } from "../../modules/order/order.service";
import type { BasePaymentAdapter } from "./base-payment.adapter";
import { PaymentApplicationService } from "./payment-application.service";
import type { PaymentCredentialService } from "./payment-credential.service";
import type { PaymentIntentInput } from "./payment.interface";
import { PaymentService } from "./payment.service";

assertDedicatedTestDatabase();
const prisma = new PrismaService();
const orders = new OrderService(prisma);
const suffix = randomUUID();

let buyer: AppUser;
let admin: AppUser;
let sellerId: string;
let offerId: string;
let initiateCalls = 0;
let refundCalls = 0;
let failInitiation = false;
let failRefund = false;

const adapter = {
  providerCode: "zarinpal",
  displayName: "Concurrency test provider",
  supportedCurrencies: ["IRR"],
  supportsRefunds: true,
  availability: async () => ({ available: true, unavailabilityReason: null, configuration: null }),
  paymentUrl: (authority: string) => `/payments/${authority}`,
  initiate: async (input) => {
    initiateCalls += 1;
    await pause();
    if (failInitiation) throw new Error("ambiguous initiation transport failure");
    return {
      providerReferenceId: `authority-${input.operationId}`,
      paymentUrl: `/payments/${input.operationId}`,
      status: "pending" as const
    };
  },
  verify: async () => ({ verified: true }),
  refund: async (input) => {
    refundCalls += 1;
    await pause();
    if (failRefund) throw new Error("ambiguous refund transport failure");
    return { providerRefundId: `refund-${input.operationId}` };
  }
} satisfies BasePaymentAdapter;

const paymentService = {
  get: () => adapter,
  initiateWithProvider: (_providerCode: string, input: PaymentIntentInput) => adapter.initiate(input)
} as unknown as PaymentService;
const application = new PaymentApplicationService(
  prisma,
  paymentService,
  {} as PaymentCredentialService
);

before(async () => {
  await prisma.$connect();
  const created = await prisma.$transaction(async (transaction) => {
    const buyerUser = await transaction.users.create({
      data: { full_name: "Payment Buyer", email: `payment-buyer-${suffix}@example.com`, role: "buyer" }
    });
    const adminUser = await transaction.users.create({
      data: { full_name: "Payment Admin", email: `payment-admin-${suffix}@example.com`, role: "platform_admin" }
    });
    const sellerUser = await transaction.users.create({
      data: { full_name: "Payment Seller", email: `payment-seller-${suffix}@example.com`, role: "seller_admin" }
    });
    const seller = await transaction.sellers.create({
      data: {
        user_id: sellerUser.id,
        shop_name: "Payment Concurrency Shop",
        approved: true,
        commission: "0.10",
        holdback_rate: "0.05"
      }
    });
    const product = await transaction.products.create({
      data: {
        created_by_seller_id: seller.id,
        title: "Concurrent Payment Product",
        slug: `concurrent-payment-${suffix}`,
        kind: "simple",
        type: "physical",
        status: "active"
      }
    });
    const variant = await transaction.product_variants.create({
      data: { product_id: product.id, option_signature: "1".repeat(64) }
    });
    const listing = await transaction.seller_listings.create({
      data: { seller_id: seller.id, product_id: product.id, status: "active" }
    });
    const offer = await transaction.seller_offers.create({
      data: {
        listing_id: listing.id,
        variant_id: variant.id,
        price: "1000",
        currency: "IRR",
        status: "active",
        physical: { create: { stock: 20, weight_grams: 100 } }
      }
    });
    await transaction.payment_method_configs.upsert({
      where: { provider_code: "zarinpal" },
      create: { provider_code: "zarinpal", enabled: true },
      update: { enabled: true }
    });
    return { buyerUser, adminUser, seller, offer };
  });
  buyer = actor(created.buyerUser, "buyer");
  admin = actor(created.adminUser, "platform-admin");
  sellerId = created.seller.id;
  offerId = created.offer.id;
});

beforeEach(() => {
  initiateCalls = 0;
  refundCalls = 0;
  failInitiation = false;
  failRefund = false;
});

after(async () => {
  const emails = [buyer.email, admin.email, `payment-seller-${suffix}@example.com`];
  const [attempts, sellerOrders] = await Promise.all([
    prisma.payment_attempts.findMany({ where: { order: { seller_id: sellerId } }, select: { id: true } }),
    prisma.orders.findMany({ where: { seller_id: sellerId }, select: { id: true } })
  ]);
  await prisma.outbox_events.deleteMany({
    where: { aggregate_id: { in: [...attempts.map(({ id }) => id), ...sellerOrders.map(({ id }) => id)] } }
  });
  await prisma.$transaction(async (transaction) => {
    await transaction.payment_refunds.deleteMany({ where: { payment_attempt: { order: { seller_id: sellerId } } } });
    await transaction.payment_attempts.deleteMany({ where: { order: { seller_id: sellerId } } });
    await transaction.order_events.deleteMany({ where: { order: { seller_id: sellerId } } });
    await transaction.payout_ledger.deleteMany({ where: { seller_id: sellerId } });
    await transaction.order_items.deleteMany({ where: { order: { seller_id: sellerId } } });
    await transaction.orders.deleteMany({ where: { seller_id: sellerId } });
    await transaction.seller_offer_physical.deleteMany({ where: { offer: { listing: { seller_id: sellerId } } } });
    await transaction.seller_offers.deleteMany({ where: { listing: { seller_id: sellerId } } });
    await transaction.seller_listings.deleteMany({ where: { seller_id: sellerId } });
    await transaction.product_variants.deleteMany({ where: { product: { created_by_seller_id: sellerId } } });
    await transaction.products.deleteMany({ where: { created_by_seller_id: sellerId } });
    await transaction.sellers.deleteMany({ where: { id: sellerId } });
    await transaction.users.deleteMany({ where: { email: { in: emails } } });
  });
  await prisma.$disconnect();
});

describe("payment provider concurrency", () => {
  it("calls initiation once for simultaneous requests with the same key", async () => {
    const order = await createOrder();
    const key = randomUUID();
    const results = await Promise.allSettled(
      Array.from({ length: 12 }, () => application.initiate(buyer, order.id, key, "zarinpal"))
    );

    assert.equal(initiateCalls, 1);
    assert.equal(results.some((result) => result.status === "fulfilled"), true);
    assert.equal(await prisma.payment_attempts.count({ where: { order_id: order.id } }), 1);
    assert.equal((await prisma.payment_attempts.findFirstOrThrow({ where: { order_id: order.id } })).status, "pending");
  });

  it("allows only one live initiation across different keys", async () => {
    const order = await createOrder();
    await Promise.allSettled(
      Array.from({ length: 12 }, () => application.initiate(buyer, order.id, randomUUID(), "zarinpal"))
    );

    assert.equal(initiateCalls, 1);
    assert.equal(await prisma.payment_attempts.count({ where: { order_id: order.id } }), 1);
  });

  it("does not retry an ambiguous initiation", async () => {
    const order = await createOrder();
    const key = randomUUID();
    failInitiation = true;
    await assert.rejects(() => application.initiate(buyer, order.id, key, "zarinpal"));
    failInitiation = false;
    await assert.rejects(() => application.initiate(buyer, order.id, key, "zarinpal"), /requires reconciliation/);

    assert.equal(initiateCalls, 1);
    assert.equal((await prisma.payment_attempts.findFirstOrThrow({ where: { order_id: order.id } })).status, "initiation_unknown");
  });

  it("calls refund once and replays the completed operation", async () => {
    const attempt = await paidAttempt();
    const key = randomUUID();
    await Promise.allSettled(
      Array.from({ length: 12 }, () => application.refund(admin, attempt.id, "Approved refund", key))
    );
    const replay = await application.refund(admin, attempt.id, "Approved refund", key);

    assert.deepEqual(replay, { refunded: true });
    assert.equal(refundCalls, 1);
    assert.equal((await prisma.payment_attempts.findUniqueOrThrow({ where: { id: attempt.id } })).status, "refunded");
    assert.equal(await prisma.payment_refunds.count({ where: { payment_attempt_id: attempt.id } }), 1);
  });

  it("allows only one refund operation across different keys", async () => {
    const attempt = await paidAttempt();
    await Promise.allSettled(
      Array.from({ length: 12 }, () => application.refund(admin, attempt.id, "Approved refund", randomUUID()))
    );

    assert.equal(refundCalls, 1);
    assert.equal(await prisma.payment_refunds.count({ where: { payment_attempt_id: attempt.id } }), 1);
    assert.equal((await prisma.payment_attempts.findUniqueOrThrow({ where: { id: attempt.id } })).status, "refunded");
  });

  it("blocks retries after an ambiguous refund and keeps the order cancelled", async () => {
    const attempt = await paidAttempt();
    const key = randomUUID();
    failRefund = true;
    await assert.rejects(() => application.refund(admin, attempt.id, "Approved refund", key));
    failRefund = false;
    await assert.rejects(() => application.refund(admin, attempt.id, "Approved refund", key), /requires reconciliation/);

    assert.equal(refundCalls, 1);
    assert.equal((await prisma.payment_attempts.findUniqueOrThrow({ where: { id: attempt.id } })).status, "refund_unknown");
    assert.equal((await prisma.orders.findUniqueOrThrow({ where: { id: attempt.order_id } })).status, "cancelled");
  });
});

async function createOrder() {
  return orders.create(buyer, { offerId, quantity: 1 }, randomUUID());
}

async function paidAttempt() {
  const order = await createOrder();
  await prisma.orders.update({ where: { id: order.id }, data: { status: "paid" } });
  return prisma.payment_attempts.create({
    data: {
      order_id: order.id,
      provider: "zarinpal",
      status: "succeeded",
      amount: order.totalAmount,
      currency: order.currency,
      idempotency_key: randomUUID(),
      authority: `authority-${randomUUID()}`,
      verified_at: new Date()
    }
  });
}

function actor(user: { id: string; full_name: string; email: string }, role: AppUser["role"]): AppUser {
  return { id: user.id, fullName: user.full_name, email: user.email, role };
}

function pause() {
  return new Promise((resolve) => setTimeout(resolve, 25));
}
