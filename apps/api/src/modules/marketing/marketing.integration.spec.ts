import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import test from "node:test";
import { PrismaService } from "../../prisma/prisma.service";
import { assertDedicatedTestDatabase } from "../../test/test-database";
import { MarketingService } from "./marketing.service";

assertDedicatedTestDatabase();

test("referral earning, seller deduction, and paid transition commit together", async () => {
  const prisma = new PrismaService();
  await prisma.$connect();
  const marketing = new MarketingService(prisma);
  const rollback = new Error("rollback marketing fixture");
  try {
    await assert.rejects(prisma.$transaction(async (tx) => {
      const sellerUser = await tx.users.create({ data: { full_name: "Marketing seller", email: `marketing-seller-${randomUUID()}@example.com`, role: "seller_admin" } });
      const buyer = await tx.users.create({ data: { full_name: "Marketing buyer", email: `marketing-buyer-${randomUUID()}@example.com`, role: "buyer" } });
      const seller = await tx.sellers.create({ data: { user_id: sellerUser.id, shop_name: "Marketing test shop", approved: true, commission: "0.1" } });
      const product = await tx.products.create({ data: { created_by_seller_id: seller.id, title: "Referral test product", slug: `marketing-${randomUUID()}`, type: "digital" } });
      const variant = await tx.product_variants.create({ data: { product_id: product.id, option_signature: randomBytes(32).toString("hex") } });
      const listing = await tx.seller_listings.create({ data: { seller_id: seller.id, product_id: product.id } });
      const offer = await tx.seller_offers.create({ data: { listing_id: listing.id, variant_id: variant.id, price: "1000", currency: "TOMAN" } });
      const order = await tx.orders.create({ data: { buyer_id: buyer.id, seller_id: seller.id, status: "pending", currency: "TOMAN", total_amount: "900", commission_rate: "0.1", holdback_rate: "0", idempotency_key: randomUUID(), request_hash: "a".repeat(64) } });
      await tx.payout_ledger.create({ data: { order_id: order.id, seller_id: seller.id, gross_amount: "900", commission_amount: "90", holdback_amount: "0", payable_amount: "810", currency: "TOMAN" } });
      const item = await tx.order_items.create({ data: { order_id: order.id, offer_id: offer.id, product_type: "digital", product_title: product.title, quantity: 1, unit_price: "1000", total_amount: "1000" } });
      const link = await tx.marketing_links.create({ data: { code: randomBytes(15).toString("base64url"), seller_id: seller.id, product_id: product.id, created_by_user_id: sellerUser.id, recipient_name: "Partner", commission_rate: "0.1" } });
      const visit = await tx.marketing_visits.create({ data: { link_id: link.id } });

      await marketing.reserve(tx, order.id, seller.id, order.total_amount, [{ id: item.id, offerId: offer.id, productId: product.id, totalAmount: "1000" }], [{ offerId: offer.id, visitId: visit.id }]);
      const ledger = await tx.payout_ledger.findUniqueOrThrow({ where: { order_id: order.id } });
      const earning = await tx.marketing_earnings.findUniqueOrThrow({ where: { order_item_id: item.id } });
      assert.equal(ledger.payable_amount.toString(), "720");
      assert.equal(ledger.marketing_commission_amount.toString(), "90");
      assert.equal(earning.base_amount.toString(), "900");
      assert.equal(earning.amount.toString(), "90");
      assert.equal(earning.status, "pending");
      await marketing.onPaid(tx, order.id);
      assert.equal((await tx.marketing_earnings.findUniqueOrThrow({ where: { id: earning.id } })).status, "payable");
      throw rollback;
    }), (error: unknown) => error === rollback);
  } finally { await prisma.$disconnect(); }
});
