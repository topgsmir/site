import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { AppUser } from "@topgsm/shared-types";
import { Prisma } from "../../prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { assertDedicatedTestDatabase } from "../../test/test-database";
import { WalletLedgerService } from "../wallet/wallet-ledger.service";
import { WalletService } from "../wallet/wallet.service";
import { CheckoutService } from "../checkout/checkout.service";
import { CheckoutExpiryService } from "../checkout/checkout-expiry.service";
import { PaymentApplicationService } from "../../integrations/payments/payment-application.service";
import type { PaymentCredentialService } from "../../integrations/payments/payment-credential.service";
import { UsdRateService } from "../usd-rate/usd-rate.service";
import { ShippingPolicyService } from "../../integrations/shipping/shipping-policy.service";
import type { PaymentService } from "../../integrations/payments/payment.service";
import { ClubService } from "./club.service";
import { ClubAdminService } from "./club-admin.service";

assertDedicatedTestDatabase();
const prisma = new PrismaService();
const wallet = new WalletLedgerService(prisma);
const club = new ClubService(prisma, wallet);
const now = new Date();
const start = new Date(now.getTime() - 60_000);

before(async () => {
  await prisma.$connect();
  await prisma.club_settings.update({ where: { id: 1 }, data: { enabled: true, activated_at: start, enabled_since: start,
    points_per_1000_toman: 2, toman_per_point: 100, first_purchase_points: 5, min_redeem_points: 1, max_redeem_points: 1000 } });
  await prisma.club_rule_versions.create({ data: { enabled: true, effective_at: start, points_per_1000_toman: 2, first_purchase_points: 5, expiry_days: 365 } });
  await prisma.club_tiers.upsert({ where: { sort_order: 0 }, create: { name_fa: "پایه", name_en: "Base", name_ar: "أساسي", threshold_toman: 0, sort_order: 0 }, update: {} });
});
after(() => prisma.$disconnect());

async function buyer() {
  return prisma.users.create({ data: { full_name: "Club test buyer", email: `club-${randomUUID()}@example.com`, role: "buyer" } });
}

async function paidOrder(buyerId: string, amount = "10000") {
  const owner = await prisma.users.create({ data: { full_name: "Club seller", email: `club-seller-${randomUUID()}@example.com`, role: "seller_admin" } });
  const seller = await prisma.sellers.create({ data: { user_id: owner.id, shop_name: "Club shop", approved: true, commission: "0.1" } });
  return prisma.orders.create({ data: { buyer_id: buyerId, seller_id: seller.id, status: "paid", currency: "TOMAN", total_amount: amount,
    shipping_fee: "0", commission_rate: "0.1", holdback_rate: "0.05", idempotency_key: randomUUID(), request_hash: randomUUID().replaceAll("-", "").repeat(2) } });
}

describe("customer club ledger", () => {
  it("awards a paid order once, applies one campaign, and reverses spent points into debt", async () => {
    const user = await buyer();
    const order = await paidOrder(user.id);
    const campaign = await prisma.club_campaigns.create({ data: { name_fa: "آزمایشی", name_en: "Test", name_ar: "اختبار", kind: "bonus", value: 3,
      starts_at: new Date(start.getTime() - 1000), ends_at: new Date(Date.now() + 60_000), active: true } });
    await prisma.club_campaign_versions.create({ data: { campaign_id: campaign.id, effective_at: start, kind: "bonus", value: 3,
      starts_at: campaign.starts_at, ends_at: campaign.ends_at, active: true } });
    const paidAt = new Date();
    await club.processPaid(order.id, paidAt);
    await club.processPaid(order.id, paidAt);
    const earning = await prisma.club_order_earnings.findUniqueOrThrow({ where: { order_id: order.id } });
    assert.equal(earning.points, 28);
    assert.equal(earning.campaign_points, 3);
    assert.ok(earning.campaign_id);
    assert.equal(await prisma.club_point_lots.count({ where: { source_key: `club-order:${order.id}` } }), 1);
    await prisma.$transaction((tx) => club.spend(tx, user.id, 10, `test-spend:${order.id}`, "checkout", order.id));
    await club.processReversal(order.id);
    await club.processReversal(order.id);
    const member = await prisma.club_members.findUniqueOrThrow({ where: { user_id: user.id } });
    assert.equal(member.balance, 0);
    assert.equal(member.point_debt, 10);
    await prisma.$transaction((tx) => club.award(tx, user.id, 15, `test-award:${order.id}`, "admin_award", "test"));
    const repaid = await prisma.club_members.findUniqueOrThrow({ where: { user_id: user.id } });
    assert.equal(repaid.balance, 5);
    assert.equal(repaid.point_debt, 0);
    const debtEvents = await prisma.club_point_debt_events.findMany({ where: { user_id: user.id }, orderBy: { created_at: "asc" } });
    assert.equal(debtEvents.reduce((sum, event) => sum + event.delta, 0), 0);
    assert.equal(debtEvents.length, 2);
  });

  it("does not award a first-purchase bonus or tier progress for orders before club launch", async () => {
    const user = await buyer();
    const historical = await paidOrder(user.id);
    await prisma.orders.update({ where: { id: historical.id }, data: { created_at: new Date(start.getTime() - 86_400_000) } });
    const current = await paidOrder(user.id);
    const paidAt = new Date();
    await club.processPaid(current.id, paidAt);
    const earning = await prisma.club_order_earnings.findUniqueOrThrow({ where: { order_id: current.id } });
    const rule = await prisma.club_rule_versions.findFirstOrThrow({ where: { effective_at: { lte: paidAt } }, orderBy: [{ effective_at: "desc" }, { id: "desc" }] });
    assert.equal(earning.points, 10 * rule.points_per_1000_toman! + earning.campaign_points);
    assert.equal(await prisma.club_order_earnings.count({ where: { order_id: historical.id } }), 0);
    assert.equal((await club.summary(user.id)).rollingSpend, "10000");
  });

  it("prevents concurrent redemption and allocates a two seller discount exactly", async () => {
    const user = await buyer();
    await prisma.$transaction((tx) => club.award(tx, user.id, 100, `test-award:${user.id}`, "admin_award", "test"));
    const spend = (key: string) => prisma.$transaction((tx) => club.spend(tx, user.id, 70, key, "checkout", key), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    const settled = await Promise.allSettled([spend(`race-a:${user.id}`), spend(`race-b:${user.id}`)]);
    assert.equal(settled.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal((await prisma.club_members.findUniqueOrThrow({ where: { user_id: user.id } })).balance, 30);
    const quote = await club.quoteCheckout(prisma, user.id, [
      { key: "seller-a", totalAmount: "5000", shippingFee: "500" },
      { key: "seller-b", totalAmount: "5000", shippingFee: "500" }
    ], 10);
    assert.equal(quote.discount.toString(), "1000");
    assert.equal([...quote.groups.values()].reduce((sum, part) => sum + part.points, 0), 10);
    assert.equal([...quote.groups.values()].reduce((sum, part) => sum.add(part.discount), new Prisma.Decimal(0)).toString(), "1000");
  });

  it("restores club wallet credit on refund with its original expiry", async () => {
    const user = await buyer();
    const owner = await prisma.users.create({ data: { full_name: "Club refund seller", email: `club-refund-${randomUUID()}@example.com`, role: "seller_admin" } });
    const seller = await prisma.sellers.create({ data: { user_id: owner.id, shop_name: "Club refund shop", approved: true, commission: "0.1" } });
    const checkout = await prisma.checkouts.create({ data: { buyer_id: user.id, currency: "TOMAN", total_amount: "600", idempotency_key: randomUUID(), request_hash: "a".repeat(64), expires_at: new Date(Date.now() + 600_000) } });
    const order = await prisma.orders.create({ data: { buyer_id: user.id, seller_id: seller.id, checkout_id: checkout.id, currency: "TOMAN", total_amount: "600",
      commission_rate: "0.1", holdback_rate: "0.05", idempotency_key: randomUUID(), request_hash: "b".repeat(64),
      payout_records: { create: { gross_amount: "600", commission_amount: "60", holdback_amount: "30", payable_amount: "510", currency: "TOMAN" } } } });
    const group = await prisma.checkout_payment_groups.create({ data: { checkout_id: checkout.id, provider: "wallet", amount: "600", currency: "TOMAN", expires_at: new Date(Date.now() + 600_000), orders: { create: { order_id: order.id, amount: "600" } } } });
    const credit = await prisma.club_wallet_credits.create({ data: { user_id: user.id, source_key: `test-credit:${user.id}`, original_toman: "500", remaining_toman: "500", expires_at: new Date(Date.now() + 90_000) } });
    await prisma.$transaction(async (tx) => {
      await wallet.apply(tx, { userId: user.id, amount: new Prisma.Decimal(500), kind: "club_credit", reason: "Test club credit", referenceType: "test", referenceId: credit.id, operationKey: `credit:${user.id}` });
      await wallet.apply(tx, { userId: user.id, amount: new Prisma.Decimal(100), kind: "topup", reason: "Test cash", referenceType: "test", referenceId: user.id, operationKey: `cash:${user.id}` });
    });
    await wallet.payCheckoutGroup(group.id, user.id);
    assert.equal((await prisma.club_wallet_credits.findUniqueOrThrow({ where: { id: credit.id } })).remaining_toman.toString(), "0");
    const admin = await prisma.users.create({ data: { full_name: "Club admin", email: `club-admin-${randomUUID()}@example.com`, role: "platform_admin" } });
    const actor: AppUser = { id: admin.id, fullName: admin.full_name, email: admin.email, role: "platform-admin" };
    const service = new WalletService(prisma, wallet, {} as PaymentService);
    const key = randomUUID();
    assert.deepEqual(await service.refundOrder(actor, user.id, order.id, "Customer refund", key), { refunded: true });
    assert.deepEqual(await service.refundOrder(actor, user.id, order.id, "Customer refund", key), { refunded: true });
    assert.equal((await wallet.balance(user.id)).balance, "600");
    assert.equal((await prisma.club_wallet_credits.findUniqueOrThrow({ where: { id: credit.id } })).remaining_toman.toString(), "500");
    assert.equal(await prisma.club_wallet_refund_allocations.count({ where: { order_id: order.id } }), 1);
    await prisma.club_wallet_credits.update({ where: { id: credit.id }, data: { expires_at: new Date(Date.now() - 1000) } });
    await club.expireDue();
    await club.expireDue();
    assert.equal((await wallet.balance(user.id)).balance, "100");
    assert.equal(await prisma.wallet_entries.count({ where: { operation_key: `club-wallet-expiry:${credit.id}` } }), 1);
  });

  it("blocks spending an overdue wallet reward and expires it for a blocked account", async () => {
    const user = await buyer();
    const credit = await prisma.club_wallet_credits.create({ data: {
      user_id: user.id, source_key: `overdue-credit:${user.id}`,
      original_toman: "500", remaining_toman: "500", expires_at: new Date(Date.now() + 60_000)
    } });
    await prisma.$transaction((tx) => wallet.apply(tx, {
      userId: user.id, amount: new Prisma.Decimal(500), kind: "club_credit",
      reason: "Test reward", referenceType: "club_credit", referenceId: credit.id,
      operationKey: `overdue-credit:${credit.id}`
    }));
    await prisma.club_wallet_credits.update({ where: { id: credit.id }, data: { expires_at: new Date(Date.now() - 1000) } });
    assert.equal((await wallet.balance(user.id)).balance, "0");
    await assert.rejects(() => prisma.$transaction((tx) => wallet.apply(tx, {
      userId: user.id, amount: new Prisma.Decimal(-500), kind: "checkout_debit",
      reason: "Checkout", referenceType: "checkout_group", referenceId: randomUUID(),
      operationKey: `overdue-debit:${credit.id}`
    })), /Insufficient wallet balance/);
    await prisma.users.update({ where: { id: user.id }, data: { account_status: "blocked" } });
    await club.expireDue();
    assert.equal((await prisma.club_wallet_credits.findUniqueOrThrow({ where: { id: credit.id } })).remaining_toman.toString(), "0");
    assert.equal(await prisma.wallet_entries.count({ where: { operation_key: `club-wallet-expiry:${credit.id}` } }), 1);
  });

  it("expires point lots once and uses the payment-time rule version", async () => {
    const user = await buyer();
    const order = await paidOrder(user.id);
    const paidAt = new Date(start.getTime() + 20_000);
    await prisma.club_rule_versions.create({ data: { enabled: true, effective_at: new Date(), points_per_1000_toman: 50, first_purchase_points: 100, expiry_days: 30 } });
    await club.processPaid(order.id, paidAt);
    const earning = await prisma.club_order_earnings.findUniqueOrThrow({ where: { order_id: order.id } });
    assert.equal(earning.points, 28);
    const lot = await prisma.club_point_lots.findUniqueOrThrow({ where: { source_key: `club-order:${order.id}` } });
    assert.equal(lot.expires_at.getTime(), paidAt.getTime() + 365 * 86_400_000);
    await prisma.club_point_lots.update({ where: { id: lot.id }, data: { expires_at: new Date(Date.now() - 1000) } });
    await club.expireDue();
    await club.expireDue();
    assert.equal((await prisma.club_members.findUniqueOrThrow({ where: { user_id: user.id } })).balance, 0);
    assert.equal(await prisma.club_point_entries.count({ where: { operation_key: `club-expiry:${lot.id}` } }), 1);
  });

  it("includes a campaign at its start and excludes it at its end", async () => {
    const user = await buyer();
    const startsAt = new Date(start.getTime() + 30_000);
    const endsAt = new Date(start.getTime() + 40_000);
    const campaign = await prisma.club_campaigns.create({ data: { name_fa: "مرزی", name_en: "Boundary", name_ar: "حدودي", kind: "bonus", value: 7, starts_at: startsAt, ends_at: endsAt } });
    await prisma.club_campaign_versions.create({ data: { campaign_id: campaign.id, effective_at: start, kind: "bonus", value: 7, starts_at: startsAt, ends_at: endsAt, active: true } });
    const first = await paidOrder(user.id);
    const second = await paidOrder(user.id);
    await club.processPaid(first.id, startsAt);
    await club.processPaid(second.id, endsAt);
    assert.equal((await prisma.club_order_earnings.findUniqueOrThrow({ where: { order_id: first.id } })).campaign_points, 7);
    assert.notEqual((await prisma.club_order_earnings.findUniqueOrThrow({ where: { order_id: second.id } })).campaign_id, campaign.id);
  });

  it("stacks coupon, club reward, direct points and mixed wallet payment without reducing seller proceeds", async () => {
    const user = await buyer();
    const owner = await prisma.users.create({ data: { full_name: "Club checkout seller", email: `club-stack-${randomUUID()}@example.com`, role: "seller_admin" } });
    const seller = await prisma.sellers.create({ data: { user_id: owner.id, shop_name: "Club checkout shop", approved: true, commission: "0.1" } });
    const product = await prisma.products.create({ data: { created_by_seller_id: seller.id, title: "Club digital item", slug: `club-item-${randomUUID()}`, type: "digital" } });
    const variant = await prisma.product_variants.create({ data: { product_id: product.id, option_signature: "c".repeat(64) } });
    const listing = await prisma.seller_listings.create({ data: { seller_id: seller.id, product_id: product.id } });
    const offer = await prisma.seller_offers.create({ data: { listing_id: listing.id, variant_id: variant.id, price: "2000", currency: "TOMAN", digital: { create: { file_reference: "https://uploads.example/club.zip", max_downloads: 1 } } } });
    const coupon = await prisma.coupons.create({ data: { seller_id: null, code: `CLUB${randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`, discount_type: "fixed", discount_value: "100", currency: "TOMAN" } });
    const reward = await prisma.club_rewards.create({ data: { name_fa: "تخفیف", name_en: "Discount", name_ar: "خصم", kind: "fixed_discount", points_cost: 1, value: "100" } });
    await prisma.payment_method_configs.upsert({ where: { provider_code: "zarinpal" }, create: { provider_code: "zarinpal", enabled: true }, update: { enabled: true } });
    await prisma.$transaction((tx) => club.award(tx, user.id, 20, `checkout-points:${user.id}`, "admin_award", "test"));
    const credit = await prisma.club_wallet_credits.create({ data: { user_id: user.id, source_key: `checkout-credit:${user.id}`, original_toman: "200", remaining_toman: "200", expires_at: new Date(Date.now() + 90 * 86_400_000) } });
    await prisma.$transaction(async (tx) => {
      await wallet.apply(tx, { userId: user.id, amount: new Prisma.Decimal(200), kind: "club_credit", reason: "Test club credit", referenceType: "test", referenceId: credit.id, operationKey: `stack-credit:${user.id}` });
      await wallet.apply(tx, { userId: user.id, amount: new Prisma.Decimal(300), kind: "topup", reason: "Test cash", referenceType: "test", referenceId: user.id, operationKey: `stack-cash:${user.id}` });
    });
    const adapter = { providerCode: "zarinpal", displayName: "Gateway", supportedCurrencies: ["TOMAN"], supportsRefunds: true,
      availability: async () => ({ available: true, unavailabilityReason: null, configuration: null }),
      paymentUrl: (authority: string) => `https://pay.example/${authority}`,
      initiate: async (input: { operationId: string }) => ({ providerReferenceId: `club-${input.operationId}`, paymentUrl: `https://pay.example/${input.operationId}`, status: "pending" as const }),
      verify: async () => ({ verified: true, referenceId: `club-ref-${randomUUID()}` }) };
    const payments = { get: () => adapter, listProviders: async () => [{ code: "zarinpal", name: "Gateway", available: true, unavailabilityReason: null, currencies: ["TOMAN"], supportsRefunds: true, configuration: null }],
      initiateWithProvider: (_code: string, input: { operationId: string }) => adapter.initiate(input) } as unknown as PaymentService;
    const application = new PaymentApplicationService(prisma, payments, {} as PaymentCredentialService, wallet);
    const checkout = new CheckoutService(prisma, payments, application, new UsdRateService(prisma), {} as never, new ShippingPolicyService(prisma), { active: () => ({ isConfigured: async () => true }) } as never, undefined, club);
    const input = { items: [{ offerId: offer.id, quantity: 1 }], couponCode: coupon.code, clubPoints: 1, clubRewardId: reward.id };
    const quote = await checkout.quote(input, user.id);
    assert.equal(quote.clubDiscountAmount, "200");
    assert.equal(quote.discountAmount, "300");
    assert.equal(quote.totalAmount, "1700");
    const actor: AppUser = { id: user.id, fullName: user.full_name, email: user.email, role: "buyer" };
    const created = await checkout.create(actor, { ...input, paymentSelections: quote.groups.map((group) => ({ orderGroupKey: group.key, providerCode: "zarinpal" })) }, randomUUID());
    const order = await prisma.orders.findFirstOrThrow({ where: { checkout_id: created.id }, include: { payout_records: true, club_discount: true } });
    assert.equal(order.total_amount.toString(), "1700");
    assert.equal(order.payout_records[0]?.gross_amount.toString(), "1900");
    assert.equal(order.club_discount?.subsidy_toman.toString(), "200");
    const group = created.paymentGroups[0]!;
    const initiated = await application.initiateCheckoutGroup(actor, created.id, group.id, randomUUID(), "500");
    assert.equal((await prisma.payment_attempts.findFirstOrThrow({ where: { checkout_payment_group_id: group.id } })).amount.toString(), "1200");
    assert.equal((await application.callback("zarinpal", initiated.authority!, "OK")).status, "succeeded");
    await club.processPaid(order.id, new Date());
    const earning = await prisma.club_order_earnings.findUniqueOrThrow({ where: { order_id: order.id } });
    assert.equal(earning.eligible_toman.toString(), "1500");
    assert.equal((await prisma.club_wallet_credits.findUniqueOrThrow({ where: { id: credit.id } })).remaining_toman.toString(), "0");
  });

  it("releases reserved points when an unpaid checkout expires", async () => {
    const user = await buyer();
    await prisma.$transaction((tx) => club.award(tx, user.id, 20, `expiry-points:${user.id}`, "admin_award", "test"));
    const owner = await prisma.users.create({ data: { full_name: "Expiry seller", email: `club-expiry-${randomUUID()}@example.com`, role: "seller_admin" } });
    const seller = await prisma.sellers.create({ data: { user_id: owner.id, shop_name: "Expiry shop", approved: true, commission: "0.1" } });
    const expiredAt = new Date(Date.now() - 1000);
    const checkout = await prisma.checkouts.create({ data: { buyer_id: user.id, currency: "TOMAN", total_amount: "700", idempotency_key: randomUUID(), request_hash: "e".repeat(64), expires_at: expiredAt } });
    const order = await prisma.orders.create({ data: { buyer_id: user.id, seller_id: seller.id, checkout_id: checkout.id, currency: "TOMAN", total_amount: "700", commission_rate: "0.1", holdback_rate: "0.05", idempotency_key: randomUUID(), request_hash: "f".repeat(64) } });
    const group = await prisma.checkout_payment_groups.create({ data: { checkout_id: checkout.id, provider: "zarinpal", amount: "700", currency: "TOMAN", expires_at: expiredAt, orders: { create: { order_id: order.id, amount: "700" } } } });
    const quote = await club.quoteCheckout(prisma, user.id, [{ key: "one", totalAmount: "900", shippingFee: "0" }], 2);
    await prisma.$transaction((tx) => club.reserveCheckout(tx, checkout.id, user.id, quote, new Map([["one", { id: order.id }]])));
    assert.equal((await prisma.club_members.findUniqueOrThrow({ where: { user_id: user.id } })).balance, 18);
    const expiry = new CheckoutExpiryService(prisma, {} as PaymentApplicationService, wallet) as unknown as { expireGroup(groupId: string): Promise<void> };
    await expiry.expireGroup(group.id);
    assert.equal((await prisma.orders.findUniqueOrThrow({ where: { id: order.id } })).status, "cancelled");
    assert.equal(await prisma.outbox_events.count({ where: { dedupe_key: `order.expired:${order.id}` } }), 1);
    await club.processReversal(order.id);
    await club.processReversal(order.id);
    assert.equal((await prisma.club_members.findUniqueOrThrow({ where: { user_id: user.id } })).balance, 20);
    assert.equal((await prisma.club_checkout_reservations.findUniqueOrThrow({ where: { checkout_id: checkout.id } })).status, "released");
  });

  it("audits admin changes and replays a point adjustment only once", async () => {
    const user = await buyer();
    const admin = await prisma.users.create({ data: { full_name: "Club audit admin", email: `club-audit-${randomUUID()}@example.com`, role: "platform_admin" } });
    const service = new ClubAdminService(prisma, club);
    const key = randomUUID();
    await service.adjust(admin.id, user.id, { points: 10, reason: "Service recovery" }, key);
    await service.adjust(admin.id, user.id, { points: 10, reason: "Service recovery" }, key);
    await assert.rejects(service.adjust(admin.id, user.id, { points: 10, reason: "Changed reason" }, key));
    assert.equal((await prisma.club_members.findUniqueOrThrow({ where: { user_id: user.id } })).balance, 10);
    assert.equal(await prisma.club_admin_events.count({ where: { actor_user_id: admin.id, action: "member.adjust" } }), 1);
    await assert.rejects(service.updateSettings(admin.id, { pointsPer1000Toman: null as unknown as number }));
    const before = await prisma.club_rule_versions.count();
    await service.updateSettings(admin.id, { signupPoints: 12 });
    assert.equal(await prisma.club_rule_versions.count(), before + 1);
    assert.equal(await prisma.club_admin_events.count({ where: { actor_user_id: admin.id, action: "settings.update" } }), 1);
    const version = await prisma.club_rule_versions.findFirstOrThrow({ orderBy: { effective_at: "desc" } });
    await assert.rejects(prisma.club_rule_versions.update({ where: { id: version.id }, data: { first_purchase_points: 99 } }), /club audit records are immutable/);
  });

  it("funds and spends wallet and club balances for every shopper role", async () => {
    const roles = ["buyer", "seller_admin", "seller_staff", "platform_admin", "platform_staff"] as const;
    for (const role of roles) {
      const user = await prisma.users.create({ data: { full_name: `Rewards ${role}`, email: `club-role-${role}-${randomUUID()}@example.com`, role } });
      const creditKey = `role-credit:${user.id}`;
      const debitKey = `role-debit:${user.id}`;
      const pointKey = `role-points:${user.id}`;
      await prisma.$transaction(async (tx) => {
        await wallet.apply(tx, { userId: user.id, amount: new Prisma.Decimal(1000), kind: "topup", reason: "Test funding", referenceType: "test", referenceId: user.id, operationKey: creditKey });
        await wallet.apply(tx, { userId: user.id, amount: new Prisma.Decimal(-300), kind: "checkout_debit", reason: "Test purchase", referenceType: "checkout", referenceId: user.id, operationKey: debitKey });
        await club.award(tx, user.id, 10, pointKey, "admin_award", user.id);
        await club.spend(tx, user.id, 5, `spend:${pointKey}`, "checkout", user.id);
      });
      assert.equal((await wallet.balance(user.id)).balance, "700");
      assert.equal((await club.summary(user.id)).balance, 5);
      if (role === "seller_staff") {
        await prisma.users.update({ where: { id: user.id }, data: { account_status: "blocked" } });
        await assert.rejects(prisma.$transaction((tx) => wallet.apply(tx, { userId: user.id, amount: new Prisma.Decimal(-300), kind: "checkout_debit", reason: "Test purchase", referenceType: "checkout", referenceId: user.id, operationKey: debitKey })), /Account is unavailable/);
        await assert.rejects(prisma.$transaction((tx) => club.spend(tx, user.id, 5, `spend:${pointKey}`, "checkout", user.id)), /Active account not found/);
      }
    }
  });
});
