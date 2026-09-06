import { strict as assert } from "node:assert";
import { after, before, describe, it } from "node:test";
import { randomUUID } from "node:crypto";
import type { AppUser } from "@topgsm/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { OrderService } from "./order.service";
import { PayoutService } from "../payout/payout.service";

const prisma = new PrismaService();
const orders = new OrderService(prisma);
const payouts = new PayoutService(prisma);
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
        holdback_rate: "0.05",
        permissions: {
          createMany: {
            data: [
              { permission: "orders_manage" },
              { permission: "payouts_request" }
            ]
          }
        }
      }
    });
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
        currency: "IRR",
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
  const emails = [buyer, secondBuyer, thirdBuyer, sellerActor, admin].map(
    (actor) => actor.email
  );
  await prisma.outbox_events.deleteMany({
    where: { payload: { path: ["sellerId"], equals: sellerId } }
  });
  await prisma.$transaction(async (transaction) => {
    await transaction.payout_events.deleteMany({ where: { actor: { email: { in: emails } } } });
    await transaction.order_events.deleteMany({ where: { actor: { email: { in: emails } } } });
    await transaction.payout_ledger.deleteMany({ where: { seller_id: sellerId } });
    await transaction.order_items.deleteMany({ where: { order: { seller_id: sellerId } } });
    await transaction.orders.deleteMany({ where: { seller_id: sellerId } });
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
    const first = await orders.create(buyer, { offerId, quantity: 1 }, key);
    const replay = await orders.create(buyer, { offerId, quantity: 1 }, key);

    assert.equal(replay.id, first.id);
    assert.equal(first.seller.id, sellerId);
    assert.equal(first.totalAmount, "1001");
    const ledger = await prisma.payout_ledger.findUniqueOrThrow({
      where: { order_id: first.id }
    });
    assert.equal(ledger.commission_amount.toString(), "100");
    assert.equal(ledger.holdback_amount.toString(), "50");
    assert.equal(ledger.payable_amount.toString(), "851");
    assert.equal(
      await prisma.orders.count({ where: { buyer_id: buyer.id, idempotency_key: key } }),
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
      () => orders.create(buyer, { offerId, quantity: 2 }, key),
      /Idempotency-Key was already used/
    );
  });

  it("scopes reads and prevents overselling under concurrent buyers", async () => {
    const results = await Promise.allSettled([
      orders.create(secondBuyer, { offerId, quantity: 2 }, randomUUID()),
      orders.create(thirdBuyer, { offerId, quantity: 2 }, randomUUID())
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
    // simulates a future verified provider transition.
    await prisma.orders.update({ where: { id: row.id }, data: { status: "paid" } });
    await orders.transition(sellerActor, row.id, { status: "processing" }, randomUUID());
    await orders.transition(sellerActor, row.id, { status: "shipped" }, randomUUID());
    await orders.transition(buyer, row.id, { status: "delivered" }, randomUUID());

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
  user: { id: string; full_name: string; email: string },
  role: AppUser["role"]
): AppUser {
  return { id: user.id, fullName: user.full_name, email: user.email, role };
}
