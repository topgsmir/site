import { strict as assert } from "node:assert";
import { after, before, describe, it } from "node:test";
import { randomUUID } from "node:crypto";
import type { AppUser } from "@topgsm/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { CheckoutService } from "../checkout/checkout.service";
import { ShippingPolicyService } from "../../integrations/shipping/shipping-policy.service";
import { UsdRateService } from "../usd-rate/usd-rate.service";
import { OrderService } from "./order.service";
import { PayoutService } from "../payout/payout.service";
import { assertDedicatedTestDatabase } from "../../test/test-database";

assertDedicatedTestDatabase();
const prisma = new PrismaService();
const orders = new OrderService(prisma);
const payouts = new PayoutService(prisma);
const paymentService = { listProviders: async () => [{ code: "zarinpal", name: "Test provider", available: true, currencies: ["TOMAN"] }] };
const checkouts = new CheckoutService(prisma, paymentService as never, {} as never, new UsdRateService(prisma), {} as never, new ShippingPolicyService(prisma), { active: () => ({ isConfigured: async () => true }) } as never);
const suffix = randomUUID();

let buyer: AppUser;
let secondBuyer: AppUser;
let thirdBuyer: AppUser;
let sellerActor: AppUser;
let admin: AppUser;
let sellerId: string;
let offerId: string;

before(async () => {
  await prisma.$connect();
  const created = await prisma.$transaction(async (transaction) => {
    const [buyerUser, secondBuyerUser, thirdBuyerUser, sellerUser, adminUser] =
      await Promise.all([
        transaction.users.create({
          data: {
            full_name: "Order Buyer",
            email: `buyer-${suffix}@example.com`,
            role: "buyer"
          }
        }),
        transaction.users.create({
          data: {
            full_name: "Second Buyer",
            email: `buyer-2-${suffix}@example.com`,
            role: "buyer"
          }
        }),
        transaction.users.create({
          data: {
            full_name: "Third Buyer",
            email: `buyer-3-${suffix}@example.com`,
            role: "buyer"
          }
        }),
        transaction.users.create({
          data: {
            full_name: "Order Seller",
            email: `seller-${suffix}@example.com`,
            role: "seller_admin"
          }
        }),
        transaction.users.create({
          data: {
            full_name: "Order Admin",
            email: `admin-${suffix}@example.com`,
            role: "platform_admin"
          }
        })
      ]);
    const seller = await transaction.sellers.create({
      data: {
        user_id: sellerUser.id,
        shop_name: "Secure Shop",
        approved: true,
        commission: "0.10",
        permissions: {
          createMany: {
            data: [
              { permission: "orders_manage" },
              { permission: "payouts_request" },
              { permission: "physical_products_manage" }
            ]
          }
        }
      }
    });
    await transaction.seller_memberships.create({
      data: {
        seller_id: seller.id,
        user_id: sellerUser.id,
        role: "admin"
      }
    });
    await transaction.seller_shipping_profiles.create({ data: { seller_id: seller.id, enabled: true, sender_name: "Test sender", sender_mobile: "09123456789", province: "Tehran", city: "Tehran", address_line: "A complete test sender address", postal_code: "1234567890", latitude: 35.7, longitude: 51.4, updated_by_user_id: sellerUser.id } });
    await transaction.payment_method_configs.upsert({ where: { provider_code: "zarinpal" }, create: { provider_code: "zarinpal", enabled: true }, update: { enabled: true } });
    const product = await transaction.products.create({
      data: {
        created_by_seller_id: seller.id,
        title: "Authoritative Phone",
        slug: `authoritative-phone-${suffix}`,
        kind: "simple",
        type: "physical",
        status: "active"
      }
    });
    const variant = await transaction.product_variants.create({
      data: {
        product_id: product.id,
        option_signature: "0".repeat(64)
      }
    });
    const listing = await transaction.seller_listings.create({
      data: { seller_id: seller.id, product_id: product.id, status: "active" }
    });
    const offer = await transaction.seller_offers.create({
      data: {
        listing_id: listing.id,
        variant_id: variant.id,
        price: "1001",
        currency: "TOMAN",
        status: "active",
        physical: { create: { stock: 3, weight_grams: 250 } }
      }
    });
    return { buyerUser, secondBuyerUser, thirdBuyerUser, sellerUser, adminUser, seller, offer };
  });

  buyer = thisActor(created.buyerUser, "buyer");
  secondBuyer = thisActor(created.secondBuyerUser, "buyer");
  thirdBuyer = thisActor(created.thirdBuyerUser, "buyer");
  sellerActor = thisActor(created.sellerUser, "seller-admin");
  admin = thisActor(created.adminUser, "platform-admin");
  sellerId = created.seller.id;
  offerId = created.offer.id;
});

after(async () => {
  const emails = [buyer, secondBuyer, thirdBuyer, sellerActor, admin]
    .map((actor) => actor.email)
    .filter((email): email is string => email !== null);
  await prisma.outbox_events.deleteMany({
    where: { payload: { path: ["sellerId"], equals: sellerId } }
  });
  await prisma.$transaction(async (transaction) => {
    await transaction.payout_events.deleteMany({ where: { actor: { email: { in: emails } } } });
    await transaction.order_events.deleteMany({ where: { actor: { email: { in: emails } } } });
    await transaction.payment_attempts.deleteMany({ where: { order: { seller_id: sellerId } } });
    await transaction.checkout_payment_group_orders.deleteMany({ where: { order: { seller_id: sellerId } } });
    await transaction.checkout_payment_groups.deleteMany({ where: { checkout: { buyer_id: { in: [buyer.id, secondBuyer.id, thirdBuyer.id] } } } });
    await transaction.order_shipping_addresses.deleteMany({ where: { order: { seller_id: sellerId } } });
    await transaction.payout_ledger.deleteMany({ where: { seller_id: sellerId } });
    await transaction.inventory_reservations.deleteMany({ where: { order_item: { order: { seller_id: sellerId } } } });
    await transaction.order_items.deleteMany({ where: { order: { seller_id: sellerId } } });
    await transaction.orders.deleteMany({ where: { seller_id: sellerId } });
    await transaction.checkouts.deleteMany({ where: { buyer_id: { in: [buyer.id, secondBuyer.id, thirdBuyer.id] } } });
    await transaction.seller_listings.deleteMany({ where: { seller_id: sellerId } });
    await transaction.product_variants.deleteMany({ where: { product: { created_by_seller_id: sellerId } } });
    await transaction.products.deleteMany({ where: { created_by_seller_id: sellerId } });
    await transaction.seller_permissions.deleteMany({ where: { seller_id: sellerId } });
    await transaction.sellers.deleteMany({ where: { id: sellerId } });
    await transaction.users.deleteMany({ where: { email: { in: emails } } });
  });
  await prisma.$disconnect();
});

describe("secure order and payout persistence", () => {
  it("derives money and seller identity and replays an idempotent create", async () => {
    const key = randomUUID();
    const first = await createPurchase(buyer, { offerId, quantity: 1 }, key);
    const replay = await createPurchase(buyer, { offerId, quantity: 1 }, key);

    assert.equal(replay.id, first.id);
    assert.equal((await prisma.orders.findUniqueOrThrow({ where: { id: first.id } })).seller_id, sellerId);
    assert.equal(first.totalAmount, "1001");
    assert.equal("commissionRate" in first, false);
    assert.equal("holdbackRate" in replay, false);
    const ledger = await prisma.payout_ledger.findUniqueOrThrow({
      where: { order_id: first.id }
    });
    assert.equal(ledger.commission_amount.toString(), "100");
    assert.equal(ledger.holdback_amount.toString(), "0");
    assert.equal(ledger.payable_amount.toString(), "901");
    assert.equal(
      await prisma.checkouts.count({ where: { buyer_id: buyer.id, idempotency_key: key } }),
      1
    );
    assert.equal(await prisma.order_events.count({ where: { order_id: first.id } }), 1);
    assert.equal(
      await prisma.outbox_events.count({
        where: { aggregate_id: first.id, event_type: "order.created" }
      }),
      1
    );
    await assert.rejects(
      () => createPurchase(buyer, { offerId, quantity: 2 }, key),
      /Idempotency|idempotency|another request/
    );
  });

  it("scopes reads and prevents overselling under concurrent buyers", async () => {
    const results = await Promise.allSettled([
      createPurchase(secondBuyer, { offerId, quantity: 2 }, randomUUID()),
      createPurchase(thirdBuyer, { offerId, quantity: 2 }, randomUUID())
    ]);
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(results.filter((result) => result.status === "rejected").length, 1);
    const stock = await prisma.seller_offer_physical.findUniqueOrThrow({
      where: { offer_id: offerId },
      select: { stock: true }
    });
    assert.equal(stock.stock, 0);

    const buyerPage = await orders.list(buyer, { limit: 20 });
    assert.equal(buyerPage.items.length, 1);
    assert.equal("commissionRate" in buyerPage.items[0]!, false);
    assert.equal("holdbackRate" in buyerPage.items[0]!, false);
    assert.equal("bridge" in buyerPage.items[0]!.items[0]!, false);
    const buyerOrder = await orders.get(buyer, buyerPage.items[0]!.id);
    assert.equal("commissionRate" in buyerOrder, false);
    assert.equal("holdbackRate" in buyerOrder, false);
    await assert.rejects(() => orders.get(secondBuyer, buyerPage.items[0]!.id), /Order was not found/);
    const sellerPage = await orders.list(sellerActor, { limit: 20 });
    assert.equal(sellerPage.items.length, 2);
  });

  it("enforces legal actor-specific order and payout transitions", async () => {
    const row = await prisma.orders.findFirstOrThrow({ where: { buyer_id: buyer.id } });
    await assert.rejects(
      () =>
        orders.transition(
          secondBuyer,
          row.id,
          { status: "cancelled" },
          randomUUID()
        ),
      /Order was not found/
    );
    await assert.rejects(
      () =>
        orders.transition(
          sellerActor,
          row.id,
          { status: "processing" },
          randomUUID()
        ),
      /not allowed/
    );

    // Payment settlement is intentionally absent from the client API; this
    // records a verified provider payment before testing fulfillment and payout.
    await prisma.orders.update({ where: { id: row.id }, data: { status: "paid" } });
    await prisma.payment_attempts.create({ data: {
      order_id: row.id, provider: "zarinpal", status: "succeeded", amount: row.total_amount,
      currency: row.currency, idempotency_key: randomUUID(), authority: randomUUID(),
      provider_ref_id: randomUUID(), verified_at: new Date()
    } });
    await assert.rejects(
      () => orders.transition(admin, row.id, { status: "shipped", confirmSensitive: true }, randomUUID()),
      /not allowed/
    );
    await orders.transition(sellerActor, row.id, { status: "processing" }, randomUUID());
    await orders.transition(sellerActor, row.id, { status: "shipped" }, randomUUID());
    const delivered = await orders.transition(admin, row.id, { status: "delivered", confirmSensitive: true }, randomUUID());
    assert.equal(delivered.status, "delivered");
    const completion = await prisma.order_events.findFirstOrThrow({ where: { order_id: row.id, to_status: "delivered" } });
    assert.equal(completion.actor_user_id, admin.id);

    const requestKey = randomUUID();
    const requested = await payouts.request(sellerActor, row.id, requestKey);
    assert.equal(requested.status, "requested");
    assert.equal((await payouts.request(sellerActor, row.id, requestKey)).id, requested.id);
    await payouts.setStatus(admin, requested.id, { status: "approved" }, randomUUID());
    const settled = await payouts.setStatus(
      admin,
      requested.id,
      { status: "settled" },
      randomUUID()
    );
    assert.equal(settled.status, "settled");
    assert.equal(await prisma.order_events.count({ where: { order_id: row.id } }), 4);
    assert.equal(
      await prisma.payout_events.count({ where: { payout_id: requested.id } }),
      3
    );
    assert.equal(
      await prisma.outbox_events.count({ where: { aggregate_id: row.id } }),
      4
    );
    assert.equal(
      await prisma.outbox_events.count({ where: { aggregate_id: requested.id } }),
      3
    );
    await assert.rejects(
      () => payouts.setStatus(admin, requested.id, { status: "approved" }, randomUUID()),
      /not allowed/
    );
  });
});

function thisActor(
  user: { id: string; full_name: string; email: string | null },
  role: AppUser["role"]
): AppUser {
  return { id: user.id, fullName: user.full_name, email: user.email, role };
}

async function createPurchase(actor: AppUser, line: { offerId: string; quantity: number }, key: string) {
  const created = await checkouts.create(actor, {
    items: [line], paymentSelections: [{ orderGroupKey: `${sellerId}:physical`, providerCode: "zarinpal" }],
    shippingAddress: { recipientName: "Order Buyer", phoneNumber: "09123456789", province: "Tehran", city: "Tehran", postalCode: "1234567890", addressLine: "A complete integration test shipping address" }
  }, key);
  return orders.getPurchase(actor, created.orders[0]!.id);
}
