import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "../../prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { createHash, randomUUID } from "node:crypto";

export type WalletChange = {
  userId: string;
  amount: Prisma.Decimal;
  kind: "topup" | "checkout_debit" | "checkout_release" | "order_refund" | "admin_credit" | "admin_debit" | "club_credit" | "club_expiry";
  reason: string;
  referenceType: string;
  referenceId: string;
  operationKey: string;
  actorUserId?: string;
};

@Injectable()
export class WalletLedgerService {
  constructor(private readonly prisma: PrismaService) {}

  async balance(userId: string) {
    const [account, expired] = await Promise.all([
      this.prisma.wallet_accounts.findUnique({ where: { user_id: userId }, select: { balance: true } }),
      this.prisma.club_wallet_credits.aggregate({
        where: { user_id: userId, remaining_toman: { gt: 0 }, expires_at: { lte: new Date() } },
        _sum: { remaining_toman: true }
      })
    ]);
    const spendable = Prisma.Decimal.max(
      new Prisma.Decimal(0),
      (account?.balance ?? new Prisma.Decimal(0)).minus(expired._sum.remaining_toman ?? 0)
    );
    return { currency: "TOMAN", balance: spendable.toString(), withdrawalsEnabled: false };
  }

  async history(userId: string, cursor: string | undefined, limit: number) {
    const entries = await this.prisma.wallet_entries.findMany({
      where: { user_id: userId },
      orderBy: [{ created_at: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: { id: true, amount: true, balance_after: true, kind: true, reason: true, reference_type: true, reference_id: true, actor_user_id: true, created_at: true }
    });
    const page = entries.slice(0, limit);
    return {
      items: page.map((entry) => ({ id: entry.id, amount: entry.amount.toString(), balanceAfter: entry.balance_after.toString(), kind: entry.kind, reason: entry.reason, referenceType: entry.reference_type, referenceId: entry.reference_id, actorUserId: entry.actor_user_id, createdAt: entry.created_at.toISOString() })),
      nextCursor: entries.length > limit ? page.at(-1)!.id : null
    };
  }

  async apply(tx: Prisma.TransactionClient, change: WalletChange) {
    if (!change.amount.isInteger() || change.amount.isZero() || change.amount.abs().greaterThan("1000000000")) {
      throw new ConflictException("Wallet amount is invalid");
    }
    const user = await tx.users.findUnique({ where: { id: change.userId }, select: { id: true, account_status: true } });
    if (!user) throw new NotFoundException("Wallet was not found");
    const blockedCredit = change.amount.isPositive() && ["topup", "checkout_release", "order_refund"].includes(change.kind);
    const inactiveExpiry = change.amount.isNegative() && change.kind === "club_expiry";
    if (user.account_status !== "active" && !inactiveExpiry && (user.account_status !== "blocked" || !blockedCredit)) {
      throw new ConflictException("Account is unavailable for wallet changes");
    }
    const existing = await tx.wallet_entries.findUnique({ where: { operation_key: change.operationKey }, select: { user_id: true, amount: true, kind: true, reference_type: true, reference_id: true, balance_after: true } });
    if (existing) {
      if (existing.user_id !== change.userId || existing.amount.comparedTo(change.amount) !== 0 || existing.kind !== change.kind || existing.reference_type !== change.referenceType || existing.reference_id !== change.referenceId) {
        throw new ConflictException("The wallet operation key belongs to a different transaction");
      }
      return existing.balance_after;
    }
    await tx.wallet_accounts.upsert({ where: { user_id: change.userId }, create: { user_id: change.userId }, update: {} });
    if (change.amount.isNegative() && change.kind !== "club_expiry") {
      let remaining = change.amount.abs();
      const credits = await tx.club_wallet_credits.findMany({
        where: { user_id: change.userId, remaining_toman: { gt: 0 }, expires_at: { gt: new Date() } },
        orderBy: [{ expires_at: "asc" }, { id: "asc" }]
      });
      for (const credit of credits) {
        if (remaining.lte(0)) break;
        const used = Prisma.Decimal.min(remaining, credit.remaining_toman);
        const claimed = await tx.club_wallet_credits.updateMany({ where: { id: credit.id, remaining_toman: { gte: used }, expires_at: { gt: new Date() } }, data: { remaining_toman: { decrement: used } } });
        if (claimed.count !== 1) throw new ConflictException("Club credit changed during wallet payment");
        await tx.club_wallet_allocations.create({ data: { credit_id: credit.id, operation_key: change.operationKey, amount_toman: used } });
        remaining = remaining.minus(used);
      }
    }
    if (change.amount.isNegative()) {
      const expired = change.kind === "club_expiry" ? new Prisma.Decimal(0) :
        (await tx.club_wallet_credits.aggregate({
          where: { user_id: change.userId, remaining_toman: { gt: 0 }, expires_at: { lte: new Date() } },
          _sum: { remaining_toman: true }
        }))._sum.remaining_toman ?? new Prisma.Decimal(0);
      const updated = await tx.wallet_accounts.updateMany({
        where: { user_id: change.userId, balance: { gte: change.amount.abs().add(expired) } },
        data: { balance: { decrement: change.amount.abs() } }
      });
      if (updated.count !== 1) throw new ConflictException("Insufficient wallet balance");
    } else {
      await tx.wallet_accounts.update({ where: { user_id: change.userId }, data: { balance: { increment: change.amount } } });
    }
    const account = await tx.wallet_accounts.findUniqueOrThrow({ where: { user_id: change.userId }, select: { balance: true } });
    await tx.wallet_entries.create({ data: {
      user_id: change.userId, actor_user_id: change.actorUserId ?? null,
      amount: change.amount, balance_after: account.balance, kind: change.kind,
      reason: change.reason, reference_type: change.referenceType, reference_id: change.referenceId,
      operation_key: change.operationKey
    } });
    if (change.kind === "checkout_release") {
      const prior = await tx.club_wallet_allocations.findMany({ where: { operation_key: `checkout-debit:${change.referenceId}`, released_at: null }, include: { credit: true } });
      for (const allocation of prior) {
        const marked = await tx.club_wallet_allocations.updateMany({ where: { id: allocation.id, released_at: null }, data: { released_at: new Date() } });
        if (marked.count === 1 && allocation.credit.expires_at > new Date()) {
          await tx.club_wallet_credits.update({ where: { id: allocation.credit_id }, data: { remaining_toman: { increment: allocation.amount_toman } } });
        }
      }
    }
    return account.balance;
  }

  async settleTopup(topupId: string, provider: string, authority: string, referenceId: string | undefined) {
    return this.serializable(async (tx) => {
      const topup = await tx.wallet_topups.findUnique({ where: { id: topupId }, select: { id: true, user_id: true, provider: true, authority: true, status: true, amount: true, provider_ref_id: true } });
      if (!topup || topup.provider !== provider || topup.authority !== authority) throw new NotFoundException("Wallet top-up was not found");
      if (topup.status === "succeeded") return { topupId, status: "succeeded" as const };
      if (topup.status !== "pending") throw new ConflictException("Wallet top-up is not awaiting verification");
      const changed = await tx.wallet_topups.updateMany({ where: { id: topupId, status: "pending" }, data: { status: "succeeded", provider_ref_id: referenceId ?? authority, verified_at: new Date() } });
      if (changed.count !== 1) throw new ConflictException("Wallet top-up changed during verification");
      await this.apply(tx, { userId: topup.user_id, amount: topup.amount, kind: "topup", reason: "Verified payment top-up", referenceType: "topup", referenceId: topupId, operationKey: `topup:${topupId}`, actorUserId: topup.user_id });
      return { topupId, status: "succeeded" as const };
    });
  }

  async reserveCheckoutAmount(groupId: string, buyerId: string, amount: Prisma.Decimal) {
    return this.serializable(async (tx) => {
      const group = await tx.checkout_payment_groups.findFirst({
        where: { id: groupId, checkout: { buyer_id: buyerId } },
        select: { id: true, amount: true, wallet_amount: true, status: true, currency: true, expires_at: true }
      });
      if (!group || group.currency.trim() !== "TOMAN" || group.status !== "pending" || group.expires_at <= new Date()) throw new ConflictException("Checkout group is not payable");
      if (!amount.isInteger() || amount.lessThanOrEqualTo(0) || amount.greaterThanOrEqualTo(group.amount)) throw new ConflictException("Wallet contribution is invalid");
      if (group.wallet_amount.greaterThan(0)) {
        if (group.wallet_amount.comparedTo(amount) !== 0) throw new ConflictException("Wallet contribution already differs");
        return group.amount.sub(group.wallet_amount);
      }
      const changed = await tx.checkout_payment_groups.updateMany({ where: { id: groupId, status: "pending", wallet_amount: 0 }, data: { wallet_amount: amount } });
      if (changed.count !== 1) throw new ConflictException("Checkout group changed during wallet reservation");
      await this.apply(tx, { userId: buyerId, amount: amount.neg(), kind: "checkout_debit", reason: "Checkout wallet contribution", referenceType: "checkout_group", referenceId: groupId, operationKey: `checkout-debit:${groupId}`, actorUserId: buyerId });
      return group.amount.sub(amount);
    });
  }

  async payCheckoutGroup(groupId: string, buyerId: string) {
    return this.serializable(async (tx) => {
      const group = await tx.checkout_payment_groups.findFirst({
        where: { id: groupId, provider: "wallet", checkout: { buyer_id: buyerId } },
        select: { id: true, checkout_id: true, status: true, amount: true, wallet_amount: true, currency: true, expires_at: true,
          orders: { select: { order: { select: { id: true, buyer_id: true, seller_id: true, status: true, total_amount: true, items: { select: { id: true, digital_delivery_url: true, digital_delivery_urls: true, digital_max_downloads: true } } } } } }
        }
      });
      if (!group) throw new NotFoundException("Wallet payment group was not found");
      if (group.status === "paid") return { checkoutId: group.checkout_id, paymentGroupId: group.id, status: "succeeded" as const };
      if (group.status !== "pending" || group.expires_at <= new Date() || group.currency.trim() !== "TOMAN" || group.wallet_amount.greaterThan(0)) throw new ConflictException("Wallet payment group is not payable");
      if (!group.orders.length || group.orders.some(({ order }) => order.status !== "pending" || order.buyer_id !== buyerId)) throw new ConflictException("Wallet payment orders are not pending");
      const allocated = group.orders.reduce((sum, row) => sum.add(row.order.total_amount), new Prisma.Decimal(0));
      if (allocated.comparedTo(group.amount) !== 0) throw new ConflictException("Wallet payment allocation is invalid");
      const changed = await tx.checkout_payment_groups.updateMany({ where: { id: groupId, status: "pending", wallet_amount: 0 }, data: { status: "paid", wallet_amount: group.amount } });
      if (changed.count !== 1) throw new ConflictException("Wallet payment group changed");
      await this.apply(tx, { userId: buyerId, amount: group.amount.neg(), kind: "checkout_debit", reason: "Checkout paid with wallet", referenceType: "checkout_group", referenceId: groupId, operationKey: `checkout-debit:${groupId}`, actorUserId: buyerId });
      for (const { order } of group.orders) {
        const orderChanged = await tx.orders.updateMany({ where: { id: order.id, status: "pending" }, data: { status: "paid" } });
        if (orderChanged.count !== 1) throw new ConflictException("Order changed during wallet payment");
        await tx.inventory_reservations.updateMany({ where: { order_item: { order_id: order.id }, status: "active" }, data: { status: "committed" } });
        const digital = order.items.filter((item) => item.digital_delivery_url && item.digital_max_downloads !== null);
        if (digital.length) await tx.digital_entitlements.createMany({ data: digital.flatMap((item) => (item.digital_delivery_urls.length ? item.digital_delivery_urls : [item.digital_delivery_url!]).map((url, fileIndex) => ({ order_item_id: item.id, buyer_id: buyerId, delivery_url: url, file_index: fileIndex, max_downloads: item.digital_max_downloads! }))), skipDuplicates: true });
        await tx.bridge_fulfillments.updateMany({ where: { order_item: { order_id: order.id }, status: "waiting_payment" }, data: { status: "queued", next_attempt_at: new Date() } });
        await tx.bridge_fulfillments.updateMany({ where: { order_item: { order_id: order.id }, mode: "manual", status: "queued" }, data: { status: "manual_required", next_attempt_at: null } });
        await tx.order_events.create({ data: { order_id: order.id, actor_user_id: buyerId, from_status: "pending", to_status: "paid", idempotency_key: randomUUID(), request_hash: createHash("sha256").update(`wallet:${group.id}:${order.id}`).digest("hex") } });
        await tx.outbox_events.create({ data: { aggregate: "order", aggregate_id: order.id, event_type: "order.paid", dedupe_key: `order.paid:${order.id}`, payload: { orderId: order.id, buyerId, sellerId: order.seller_id, checkoutId: group.checkout_id, status: "paid" } } });
      }
      const unpaid = await tx.checkout_payment_groups.count({ where: { checkout_id: group.checkout_id, status: { not: "paid" } } });
      await tx.checkouts.update({ where: { id: group.checkout_id }, data: { status: unpaid === 0 ? "paid" : "partially_paid" } });
      return { checkoutId: group.checkout_id, paymentGroupId: group.id, status: "succeeded" as const };
    });
  }

  async releaseCheckoutAmount(tx: Prisma.TransactionClient, groupId: string, buyerId: string, amount: Prisma.Decimal) {
    if (amount.lessThanOrEqualTo(0)) return;
    const expired = await tx.club_wallet_allocations.findMany({ where: { operation_key: `checkout-debit:${groupId}`, released_at: null, credit: { expires_at: { lte: new Date() } } } });
    const forfeited = expired.reduce((sum, allocation) => sum.add(allocation.amount_toman), new Prisma.Decimal(0));
    for (const allocation of expired) await tx.club_wallet_allocations.update({ where: { id: allocation.id }, data: { released_at: new Date() } });
    const refundable = amount.minus(forfeited);
    if (refundable.gt(0)) await this.apply(tx, { userId: buyerId, amount: refundable, kind: "checkout_release", reason: "Checkout payment expired", referenceType: "checkout_group", referenceId: groupId, operationKey: `checkout-release:${groupId}`, actorUserId: buyerId });
  }

  async refundOrderToWallet(tx: Prisma.TransactionClient, input: { orderId: string; buyerId: string; amount: Prisma.Decimal; reason: string; actorId: string }) {
    const groups = await tx.checkout_payment_group_orders.findMany({
      where: { order_id: input.orderId },
      select: { payment_group_id: true, payment_group: { select: { amount: true, orders: { select: { order_id: true, amount: true } } } } }
    });
    const shares = new Map<string, { amount: Prisma.Decimal; expiresAt: Date }>();
    for (const { payment_group_id: groupId, payment_group: group } of groups) {
      const allocations = await tx.club_wallet_allocations.findMany({ where: { operation_key: `checkout-debit:${groupId}`, released_at: null }, include: { credit: true } });
      const ordered = [...group.orders].sort((a, b) => a.order_id.localeCompare(b.order_id));
      for (const allocation of allocations) {
        let assigned = new Prisma.Decimal(0);
        for (const [index, item] of ordered.entries()) {
          const part = index === ordered.length - 1
            ? allocation.amount_toman.minus(assigned)
            : allocation.amount_toman.mul(item.amount).div(group.amount).toDecimalPlaces(0, Prisma.Decimal.ROUND_DOWN);
          if (item.order_id === input.orderId && part.gt(0)) {
            const prior = shares.get(allocation.credit_id);
            shares.set(allocation.credit_id, { amount: (prior?.amount ?? new Prisma.Decimal(0)).add(part), expiresAt: allocation.credit.expires_at });
          }
          assigned = assigned.add(part);
        }
      }
    }
    const now = new Date();
    const promotional = [...shares.values()].reduce((sum, share) => sum.add(share.amount), new Prisma.Decimal(0));
    if (promotional.gt(input.amount)) throw new ConflictException("Promotional refund allocation exceeds the order payment");
    const restored = [...shares.values()].reduce((sum, share) => sum.add(share.expiresAt > now ? share.amount : 0), new Prisma.Decimal(0));
    const walletAmount = input.amount.minus(promotional).add(restored);
    if (walletAmount.gt(0)) await this.apply(tx, {
      userId: input.buyerId, amount: walletAmount, kind: "order_refund", reason: input.reason,
      referenceType: "order", referenceId: input.orderId, operationKey: `order-refund:${input.orderId}`, actorUserId: input.actorId
    });
    for (const [creditId, share] of shares) {
      const restoredAmount = share.expiresAt > now ? share.amount : new Prisma.Decimal(0);
      if (restoredAmount.gt(0)) await tx.club_wallet_credits.update({ where: { id: creditId }, data: { remaining_toman: { increment: restoredAmount } } });
      await tx.club_wallet_refund_allocations.create({ data: { order_id: input.orderId, credit_id: creditId, amount_toman: share.amount, restored_toman: restoredAmount } });
    }
  }

  private async serializable<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt += 1) {
      try { return await this.prisma.$transaction(work, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }); }
      catch (error) {
        if (attempt >= 2 || !(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2034") throw error;
      }
    }
  }
}
