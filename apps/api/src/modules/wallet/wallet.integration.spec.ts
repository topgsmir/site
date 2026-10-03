import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { ConflictException } from "@nestjs/common";
import { Prisma } from "../../prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { assertDedicatedTestDatabase } from "../../test/test-database";
import { WalletLedgerService } from "./wallet-ledger.service";
import { WalletService } from "./wallet.service";
import { PaymentApplicationService } from "../../integrations/payments/payment-application.service";
import type { PaymentService } from "../../integrations/payments/payment.service";
import type { PaymentCredentialService } from "../../integrations/payments/payment-credential.service";
import type { AppUser } from "@topgsm/shared-types";

assertDedicatedTestDatabase();
const prisma = new PrismaService();
const ledger = new WalletLedgerService(prisma);

before(() => prisma.$connect());
after(() => prisma.$disconnect());

describe("wallet ledger", () => {
  async function checkoutFixture(provider: string, amount = "600") {
    const suffix = randomUUID();
    const buyer = await prisma.users.create({ data: { full_name: "Wallet checkout buyer", email: `wallet-buyer-${suffix}@example.com`, role: "buyer" } });
    const other = await prisma.users.create({ data: { full_name: "Other wallet buyer", email: `wallet-other-${suffix}@example.com`, role: "buyer" } });
    const sellerOwner = await prisma.users.create({ data: { full_name: "Wallet test seller", email: `wallet-seller-${suffix}@example.com`, role: "seller_admin" } });
    const seller = await prisma.sellers.create({ data: { user_id: sellerOwner.id, shop_name: "Wallet test shop", approved: true, commission: "0.1" } });
    const checkout = await prisma.checkouts.create({ data: { buyer_id: buyer.id, currency: "TOMAN", total_amount: amount, idempotency_key: randomUUID(), request_hash: "a".repeat(64), expires_at: new Date(Date.now() + 900_000) } });
    const order = await prisma.orders.create({ data: { buyer_id: buyer.id, seller_id: seller.id, checkout_id: checkout.id, currency: "TOMAN", total_amount: amount, commission_rate: "0.1", holdback_rate: "0.05", idempotency_key: randomUUID(), request_hash: "b".repeat(64), payout_records: { create: { gross_amount: amount, commission_amount: "60", holdback_amount: "30", payable_amount: "510", currency: "TOMAN" } } } });
    const group = await prisma.checkout_payment_groups.create({ data: { checkout_id: checkout.id, provider, amount, currency: "TOMAN", expires_at: new Date(Date.now() + 900_000), orders: { create: { order_id: order.id, amount } } } });
    await prisma.$transaction((tx) => ledger.apply(tx, { userId: buyer.id, amount: new Prisma.Decimal(1000), kind: "admin_credit", reason: "Checkout test funding", referenceType: "test", referenceId: suffix, operationKey: `admin:${suffix}`, actorUserId: buyer.id }));
    return { buyer, other, order, group, checkout };
  }

  it("enforces exact balances, idempotency and the nonnegative account invariant", async () => {
    const rollback = new Error("rollback test fixture");
    await assert.rejects(prisma.$transaction(async (tx) => {
      const buyer = await tx.users.create({ data: { full_name: "Wallet test buyer", email: `wallet-${randomUUID()}@example.com`, role: "buyer" } });
      const base = { userId: buyer.id, actorUserId: buyer.id, reason: "Verified test credit", referenceType: "test", referenceId: randomUUID() };
      assert.equal((await ledger.apply(tx, { ...base, amount: new Prisma.Decimal(1000), kind: "topup", operationKey: `topup:${base.referenceId}` })).toString(), "1000");
      assert.equal((await ledger.apply(tx, { ...base, amount: new Prisma.Decimal(1000), kind: "topup", operationKey: `topup:${base.referenceId}` })).toString(), "1000");
      assert.equal(await tx.wallet_entries.count({ where: { user_id: buyer.id } }), 1);
      await assert.rejects(ledger.apply(tx, { ...base, amount: new Prisma.Decimal(2000), kind: "topup", operationKey: `topup:${base.referenceId}` }), ConflictException);
      await assert.rejects(ledger.apply(tx, { ...base, amount: new Prisma.Decimal(-1001), kind: "admin_debit", referenceType: "admin", operationKey: `admin:${randomUUID()}` }), ConflictException);
      assert.equal((await tx.wallet_accounts.findUniqueOrThrow({ where: { user_id: buyer.id } })).balance.toString(), "1000");
      assert.equal((await ledger.apply(tx, { ...base, amount: new Prisma.Decimal(-400), kind: "admin_debit", referenceType: "admin", operationKey: `admin:${randomUUID()}` })).toString(), "600");
      assert.equal(await tx.wallet_entries.count({ where: { user_id: buyer.id } }), 2);
      throw rollback;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }), rollback);
  });

  it("rejects changes to posted ledger entries", async () => {
    await assert.rejects(prisma.$transaction(async (tx) => {
      const buyer = await tx.users.create({ data: { full_name: "Wallet immutable buyer", email: `wallet-${randomUUID()}@example.com`, role: "buyer" } });
      const key = `admin:${randomUUID()}`;
      await ledger.apply(tx, { userId: buyer.id, amount: new Prisma.Decimal(1000), kind: "admin_credit", reason: "Immutable entry test", referenceType: "admin", referenceId: randomUUID(), operationKey: key, actorUserId: buyer.id });
      await tx.wallet_entries.update({ where: { operation_key: key }, data: { reason: "Modified audit entry" } });
    }), /wallet entries are immutable/);
  });

  it("pays an owned checkout once and rejects a different buyer", async () => {
    const { buyer, other, order, group, checkout } = await checkoutFixture("wallet");
    await assert.rejects(ledger.payCheckoutGroup(group.id, other.id));
    assert.equal((await ledger.balance(buyer.id)).balance, "1000");
    assert.equal((await ledger.payCheckoutGroup(group.id, buyer.id)).status, "succeeded");
    assert.equal((await ledger.payCheckoutGroup(group.id, buyer.id)).status, "succeeded");
    assert.equal((await ledger.balance(buyer.id)).balance, "400");
    assert.equal(await prisma.wallet_entries.count({ where: { user_id: buyer.id, kind: "checkout_debit" } }), 1);
    assert.equal((await prisma.orders.findUniqueOrThrow({ where: { id: order.id } })).status, "paid");
    assert.equal((await prisma.checkouts.findUniqueOrThrow({ where: { id: checkout.id } })).status, "paid");
  });

  it("reserves a partial wallet contribution once and releases it once", async () => {
    const { buyer, group } = await checkoutFixture("zarinpal");
    assert.equal((await ledger.reserveCheckoutAmount(group.id, buyer.id, new Prisma.Decimal(300))).toString(), "300");
    assert.equal((await ledger.reserveCheckoutAmount(group.id, buyer.id, new Prisma.Decimal(300))).toString(), "300");
    assert.equal((await ledger.balance(buyer.id)).balance, "700");
    await prisma.$transaction(async (tx) => {
      await ledger.releaseCheckoutAmount(tx, group.id, buyer.id, new Prisma.Decimal(300));
      await tx.checkout_payment_groups.update({ where: { id: group.id }, data: { status: "expired" } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    assert.equal((await ledger.balance(buyer.id)).balance, "1000");
    assert.equal(await prisma.wallet_entries.count({ where: { user_id: buyer.id, reference_id: group.id } }), 2);
  });

  it("allows only one active gateway attempt for a checkout group", async () => {
    const { order, group } = await checkoutFixture("zarinpal");
    await prisma.payment_attempts.create({ data: { order_id: order.id, checkout_payment_group_id: group.id, provider: "zarinpal", amount: "600", currency: "TOMAN", idempotency_key: randomUUID() } });
    await assert.rejects(prisma.payment_attempts.create({ data: { order_id: order.id, checkout_payment_group_id: group.id, provider: "zarinpal", amount: "600", currency: "TOMAN", idempotency_key: randomUUID() } }), (error: unknown) => error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002");
  });

  it("settles a mixed wallet and verified gateway payment once", async () => {
    const { buyer, order, group, checkout } = await checkoutFixture("zarinpal");
    await ledger.reserveCheckoutAmount(group.id, buyer.id, new Prisma.Decimal(250));
    const authority = `mixed-${randomUUID()}`;
    await prisma.payment_attempts.create({ data: { order_id: order.id, checkout_payment_group_id: group.id, provider: "zarinpal", amount: "350", currency: "TOMAN", idempotency_key: randomUUID(), status: "pending", authority } });
    const fakePayments = { get: () => ({ verify: async (_authority: string, amount: string) => ({ verified: amount === "350", referenceId: `verified-${authority}` }) }) } as unknown as PaymentService;
    const application = new PaymentApplicationService(prisma, fakePayments, {} as PaymentCredentialService, ledger);
    assert.equal((await application.callback("zarinpal", authority, "OK")).status, "succeeded");
    assert.equal((await application.callback("zarinpal", authority, "OK")).status, "succeeded");
    assert.equal((await ledger.balance(buyer.id)).balance, "750");
    assert.equal((await prisma.orders.findUniqueOrThrow({ where: { id: order.id } })).status, "paid");
    assert.equal((await prisma.checkouts.findUniqueOrThrow({ where: { id: checkout.id } })).status, "paid");
    assert.equal(await prisma.wallet_entries.count({ where: { operation_key: `checkout-debit:${group.id}` } }), 1);
  });

  it("credits a top-up only after verified provider callback and never twice", async () => {
    const suffix = randomUUID();
    const buyer = await prisma.users.create({ data: { full_name: "Wallet top-up buyer", email: `wallet-topup-${suffix}@example.com`, role: "buyer" } });
    const actor: AppUser = { id: buyer.id, fullName: buyer.full_name, email: buyer.email, role: "buyer" };
    await prisma.payment_method_configs.upsert({ where: { provider_code: "zarinpal" }, create: { provider_code: "zarinpal", enabled: true }, update: { enabled: true } });
    const fakePayments = {
      get: () => ({ providerCode: "zarinpal", availability: async () => ({ available: true }), paymentUrl: (authority: string) => `https://pay.example/${authority}`, verify: async () => ({ verified: true, referenceId: `verified-${suffix}` }) }),
      initiateWithProvider: async (_provider: string, input: { operationId: string }) => ({ providerReferenceId: `topup-${input.operationId}`, paymentUrl: `https://pay.example/${input.operationId}`, status: "pending" }),
      listProviders: async () => [{ code: "zarinpal", name: "Test gateway", available: true }]
    } as unknown as PaymentService;
    const wallet = new WalletService(prisma, ledger, fakePayments);
    const application = new PaymentApplicationService(prisma, fakePayments, {} as PaymentCredentialService, ledger);
    const key = randomUUID();
    const initiated = await wallet.topup(actor, { amount: "1000", provider: "zarinpal" }, key);
    assert.equal(initiated.status, "pending");
    assert.equal((await ledger.balance(buyer.id)).balance, "0");
    assert.equal((await wallet.topup(actor, { amount: "1000", provider: "zarinpal" }, key)).id, initiated.id);
    await prisma.users.update({ where: { id: buyer.id }, data: { account_status: "blocked" } });
    const authority = `topup-${initiated.id}`;
    assert.equal((await application.callback("zarinpal", authority, "OK")).status, "succeeded");
    assert.equal((await application.callback("zarinpal", authority, "OK")).status, "succeeded");
    assert.equal((await ledger.balance(buyer.id)).balance, "1000");
    assert.equal(await prisma.wallet_entries.count({ where: { user_id: buyer.id, kind: "topup" } }), 1);
    await assert.rejects(prisma.$transaction((tx) => ledger.apply(tx, { userId: buyer.id, amount: new Prisma.Decimal(-100), kind: "admin_debit", reason: "Blocked buyer debit", referenceType: "test", referenceId: suffix, operationKey: `blocked:${suffix}`, actorUserId: buyer.id })), ConflictException);
    await assert.rejects(wallet.topup(actor, { amount: "2000", provider: "zarinpal" }, key), ConflictException);
  });

  it("does not overspend under concurrent debits", async () => {
    const buyer = await prisma.users.create({ data: { full_name: "Concurrent wallet buyer", email: `wallet-race-${randomUUID()}@example.com`, role: "buyer" } });
    await prisma.$transaction((tx) => ledger.apply(tx, { userId: buyer.id, amount: new Prisma.Decimal(1000), kind: "admin_credit", reason: "Concurrent debit funding", referenceType: "test", referenceId: buyer.id, operationKey: `fund:${buyer.id}`, actorUserId: buyer.id }));
    const debit = (key: string) => prisma.$transaction((tx) => ledger.apply(tx, { userId: buyer.id, amount: new Prisma.Decimal(-600), kind: "admin_debit", reason: "Concurrent debit test", referenceType: "test", referenceId: key, operationKey: `debit:${key}`, actorUserId: buyer.id }), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    const results = await Promise.allSettled([debit(randomUUID()), debit(randomUUID())]);
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal((await ledger.balance(buyer.id)).balance, "400");
    assert.equal(await prisma.wallet_entries.count({ where: { user_id: buyer.id, kind: "admin_debit" } }), 1);
  });

  it("refunds an eligible paid order to the correct buyer once", async () => {
    const { buyer, other, order, group } = await checkoutFixture("wallet");
    await ledger.payCheckoutGroup(group.id, buyer.id);
    const admin = await prisma.users.create({ data: { full_name: "Wallet refund admin", email: `wallet-admin-${randomUUID()}@example.com`, role: "platform_admin" } });
    const actor: AppUser = { id: admin.id, fullName: admin.full_name, email: admin.email, role: "platform-admin" };
    const wallet = new WalletService(prisma, ledger, {} as PaymentService);
    const key = randomUUID();
    await assert.rejects(wallet.refundOrder(actor, other.id, order.id, "Customer requested wallet refund", key));
    assert.deepEqual(await wallet.refundOrder(actor, buyer.id, order.id, "Customer requested wallet refund", key), { refunded: true });
    assert.deepEqual(await wallet.refundOrder(actor, buyer.id, order.id, "Customer requested wallet refund", key), { refunded: true });
    assert.equal((await ledger.balance(buyer.id)).balance, "1000");
    assert.equal(await prisma.wallet_entries.count({ where: { user_id: buyer.id, kind: "order_refund" } }), 1);
    assert.equal((await prisma.orders.findUniqueOrThrow({ where: { id: order.id } })).status, "cancelled");
  });
});
