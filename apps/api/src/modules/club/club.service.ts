import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "../../prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { WalletLedgerService } from "../wallet/wallet-ledger.service";
import { DateTime } from "luxon";

const DAY = 86_400_000;
const MAX_AWARD_POINTS = 1_000_000_000;
type Tx = Prisma.TransactionClient;
type QuoteGroup = { key: string; totalAmount: string; shippingFee: string };

@Injectable()
export class ClubService {
  constructor(private readonly prisma: PrismaService, private readonly wallet: WalletLedgerService) {}

  settings() { return this.prisma.club_settings.findUniqueOrThrow({ where: { id: 1 } }); }

  async ensureMember(tx: Tx, userId: string) {
    const user = await tx.users.findUnique({ where: { id: userId }, select: { role: true, account_status: true } });
    if (!user || user.role !== "buyer" || user.account_status !== "active") throw new NotFoundException("Active buyer not found");
    return tx.club_members.upsert({ where: { user_id: userId }, create: { user_id: userId }, update: {} });
  }

  async award(tx: Tx, userId: string, points: number, sourceKey: string, kind: string, referenceId: string, awardedAt = new Date(), expiryDays?: number) {
    if (!Number.isSafeInteger(points) || points < 0) throw new BadRequestException("Invalid points");
    if (!points || await tx.club_point_lots.findUnique({ where: { source_key: sourceKey }, select: { id: true } })) return;
    const settings = await tx.club_settings.findUniqueOrThrow({ where: { id: 1 } });
    if (!settings.activated_at || awardedAt < settings.activated_at) return;
    const member = await this.ensureMember(tx, userId);
    const debtPaid = Math.min(member.point_debt, points);
    const spendable = points - debtPaid;
    const updatedMember = await tx.club_members.update({ where: { user_id: userId }, data: {
      point_debt: { decrement: debtPaid }, balance: { increment: spendable }, lifetime_earned: { increment: points }
    } });
    if (debtPaid) await tx.club_point_debt_events.create({ data: { user_id: userId, operation_key: `debt:${sourceKey}`,
      delta: -debtPaid, debt_after: updatedMember.point_debt, kind: "repayment", reference_id: referenceId } });
    {
      const validityDays = expiryDays ?? settings.expiry_days;
      const expiresAt = validityDays === 365
        ? DateTime.fromJSDate(awardedAt, { zone: "utc" }).plus({ months: 12 }).toJSDate()
        : new Date(awardedAt.getTime() + validityDays * DAY);
      await tx.club_point_lots.create({ data: { user_id: userId, source_key: sourceKey, reference_id: referenceId, original: points, remaining: spendable, debt_paid: debtPaid, expires_at: expiresAt, created_at: awardedAt } });
    }
    if (spendable) {
      const after = await tx.club_members.findUniqueOrThrow({ where: { user_id: userId }, select: { balance: true } });
      await tx.club_point_entries.create({ data: { user_id: userId, operation_key: sourceKey, delta: spendable, balance_after: after.balance, kind, reference_id: referenceId } });
    }
  }

  async spend(tx: Tx, userId: string, points: number, operationKey: string, kind: string, referenceId: string, reservationId?: string) {
    if (!Number.isSafeInteger(points) || points <= 0) throw new BadRequestException("Invalid points");
    const existing = await tx.club_point_entries.findUnique({ where: { operation_key: operationKey } });
    if (existing) {
      if (existing.user_id !== userId || existing.delta !== -points) throw new ConflictException("Point operation key was reused");
      return;
    }
    await this.ensureMember(tx, userId);
    const debit = await tx.club_members.updateMany({ where: { user_id: userId, balance: { gte: points } }, data: { balance: { decrement: points } } });
    if (debit.count !== 1) throw new ConflictException("Insufficient club points");
    const lots = await tx.club_point_lots.findMany({ where: { user_id: userId, remaining: { gt: 0 }, expires_at: { gt: new Date() } }, orderBy: [{ expires_at: "asc" }, { id: "asc" }] });
    let left = points;
    for (const lot of lots) {
      if (!left) break;
      const amount = Math.min(lot.remaining, left);
      const changed = await tx.club_point_lots.updateMany({ where: { id: lot.id, remaining: { gte: amount } }, data: { remaining: { decrement: amount } } });
      if (changed.count !== 1) throw new ConflictException("Point lot changed during redemption");
      await tx.club_point_allocations.create({ data: { operation_key: operationKey, lot_id: lot.id, points: amount, reservation_id: reservationId } });
      left -= amount;
    }
    if (left) throw new ConflictException("Available point lots do not cover the balance");
    const after = await tx.club_members.findUniqueOrThrow({ where: { user_id: userId }, select: { balance: true } });
    await tx.club_point_entries.create({ data: { user_id: userId, operation_key: operationKey, delta: -points, balance_after: after.balance, kind, reference_id: referenceId } });
  }

  async release(tx: Tx, userId: string, operationKey: string, reason: string) {
    const allocations = await tx.club_point_allocations.findMany({ where: { operation_key: operationKey, released_at: null }, include: { lot: true } });
    let restored = 0;
    for (const allocation of allocations) {
      const changed = await tx.club_point_allocations.updateMany({ where: { id: allocation.id, released_at: null }, data: { released_at: new Date() } });
      if (changed.count && allocation.lot.expires_at > new Date()) {
        await tx.club_point_lots.update({ where: { id: allocation.lot_id }, data: { remaining: { increment: allocation.points } } });
        restored += allocation.points;
      }
    }
    if (restored) {
      const member = await tx.club_members.update({ where: { user_id: userId }, data: { balance: { increment: restored } } });
      await tx.club_point_entries.create({ data: { user_id: userId, operation_key: `release:${operationKey}`, delta: restored, balance_after: member.balance, kind: "release", reference_id: reason } });
    }
  }

  async summary(userId: string) {
    const [settings, member, tiers, spend] = await Promise.all([
      this.settings(), this.prisma.club_members.findUnique({ where: { user_id: userId }, include: { override_tier: true } }),
      this.prisma.club_tiers.findMany({ where: { active: true }, orderBy: { threshold_toman: "asc" } }),
      this.prisma.club_order_earnings.aggregate({ where: { user_id: userId, reversed_at: null, created_at: { gte: DateTime.utc().minus({ months: 12 }).toJSDate() } }, _sum: { eligible_toman: true } })
    ]);
    const rolling = spend._sum.eligible_toman ?? new Prisma.Decimal(0);
    const computed = tiers.filter((tier) => tier.threshold_toman.lte(rolling)).at(-1) ?? null;
    const tier = member?.override_until && member.override_until > new Date() ? member.override_tier : computed;
    const expiring = await this.prisma.club_point_lots.aggregate({ where: { user_id: userId, remaining: { gt: 0 }, expires_at: { gt: new Date(), lte: new Date(Date.now() + 30 * DAY) } }, _sum: { remaining: true } });
    return { enabled: settings.enabled, balance: member?.balance ?? 0, pointDebt: member?.point_debt ?? 0,
      redemption: settings.enabled && settings.min_redeem_points && settings.max_redeem_points && settings.toman_per_point
        ? { minPoints: settings.min_redeem_points, maxPoints: settings.max_redeem_points, tomanPerPoint: settings.toman_per_point } : null,
      tier: tier && { id: tier.id, nameFa: tier.name_fa, nameEn: tier.name_en, nameAr: tier.name_ar },
      rollingSpend: rolling.toString(), nextTier: tiers.find((item) => item.threshold_toman.gt(rolling)) ?? null,
      expiringPoints: expiring._sum.remaining ?? 0 };
  }

  async history(userId: string, cursor: string | undefined, limit: number) {
    const rows = await this.prisma.club_point_entries.findMany({ where: { user_id: userId }, orderBy: [{ created_at: "desc" }, { id: "desc" }], take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) });
    return { items: rows.slice(0, limit), nextCursor: rows.length > limit ? rows[limit - 1]?.id : null };
  }

  rewards() { return this.prisma.club_rewards.findMany({ where: { active: true }, orderBy: { points_cost: "asc" } }); }

  async quoteCheckout(db: Tx | PrismaService, userId: string | undefined, groups: QuoteGroup[], directPoints = 0, rewardId?: string) {
    if (!directPoints && !rewardId) return { points: 0, rewardId: null, discount: new Prisma.Decimal(0), groups: new Map<string, { points: number; discount: Prisma.Decimal }>() };
    if (!userId) throw new BadRequestException("Sign in to redeem club points");
    const settings = await db.club_settings.findUniqueOrThrow({ where: { id: 1 } });
    if (!settings.enabled || !settings.toman_per_point) throw new ConflictException("Club redemption is unavailable");
    if (!Number.isSafeInteger(directPoints) || directPoints < 0) throw new BadRequestException("Invalid point amount");
    if (directPoints && (directPoints < (settings.min_redeem_points ?? 1) || directPoints > (settings.max_redeem_points ?? 0))) throw new BadRequestException("Point amount is outside redemption limits");
    const member = await db.club_members.findUnique({ where: { user_id: userId }, select: { balance: true } });
    const reward = rewardId ? await db.club_rewards.findFirst({ where: { id: rewardId, active: true, kind: { in: ["fixed_discount", "percentage_discount"] } } }) : null;
    if (rewardId && !reward) throw new NotFoundException("Discount reward unavailable");
    const points = directPoints + (reward?.points_cost ?? 0);
    if ((member?.balance ?? 0) < points) throw new ConflictException("Insufficient club points");
    const capacity = groups.reduce((sum, group) => sum.add(Prisma.Decimal.max(0, new Prisma.Decimal(group.totalAmount).minus(group.shippingFee).minus(1))), new Prisma.Decimal(0));
    const merch = groups.reduce((sum, group) => sum.add(new Prisma.Decimal(group.totalAmount).minus(group.shippingFee)), new Prisma.Decimal(0));
    if (reward?.min_order && merch.lt(reward.min_order)) throw new BadRequestException("Cart does not meet reward minimum");
    const rewardDiscount = !reward ? new Prisma.Decimal(0) : reward.kind === "fixed_discount" ? reward.value : Prisma.Decimal.min(
      merch.mul(reward.value).div(100).toDecimalPlaces(0, Prisma.Decimal.ROUND_DOWN), reward.max_discount ?? merch
    );
    const directDiscount = new Prisma.Decimal(directPoints).mul(settings.toman_per_point);
    const discount = rewardDiscount.add(directDiscount);
    if (discount.lte(0) || discount.gt(capacity)) throw new BadRequestException("Club discount exceeds eligible merchandise");
    const allocation = new Map<string, { points: number; discount: Prisma.Decimal }>();
    let leftDiscount = discount; let leftPoints = points;
    const eligible = groups.map((group) => ({ key: group.key, cap: Prisma.Decimal.max(0, new Prisma.Decimal(group.totalAmount).minus(group.shippingFee).minus(1)) })).filter((group) => group.cap.gt(0));
    eligible.forEach((group, index) => {
      const laterCapacity = eligible.slice(index + 1).reduce((sum, item) => sum.add(item.cap), new Prisma.Decimal(0));
      const proposed = index === eligible.length - 1 ? leftDiscount : discount.mul(group.cap).div(capacity).toDecimalPlaces(0, Prisma.Decimal.ROUND_DOWN);
      const amount = Prisma.Decimal.min(group.cap, Prisma.Decimal.max(leftDiscount.minus(laterCapacity), proposed));
      const part = index === eligible.length - 1 ? leftPoints : amount.mul(points).div(discount).toDecimalPlaces(0, Prisma.Decimal.ROUND_DOWN).toNumber();
      allocation.set(group.key, { points: part, discount: amount });
      leftDiscount = leftDiscount.minus(amount); leftPoints -= part;
    });
    if (!leftDiscount.isZero() || leftPoints !== 0) throw new ConflictException("Club allocation failed");
    return { points, rewardId: reward?.id ?? null, discount, groups: allocation };
  }

  async reserveCheckout(tx: Tx, checkoutId: string, userId: string, quote: Awaited<ReturnType<ClubService["quoteCheckout"]>>, orders: Map<string, { id: string }>) {
    if (!quote.points) return;
    const reservation = await tx.club_checkout_reservations.create({ data: { checkout_id: checkoutId, user_id: userId, reward_id: quote.rewardId, points: quote.points, discount_toman: quote.discount } });
    for (const [key, group] of quote.groups) {
      if (!group.discount.gt(0)) continue;
      const order = orders.get(key);
      if (!order) throw new ConflictException("Club allocation has no order");
      await tx.club_order_discounts.create({ data: { order_id: order.id, reservation_id: reservation.id, points: group.points, discount_toman: group.discount, subsidy_toman: group.discount } });
      if (group.points) await this.spend(tx, userId, group.points, `club-checkout:${checkoutId}:${order.id}`, "checkout", order.id, reservation.id);
    }
  }

  async redeemWallet(userId: string, rewardId: string, key: string) {
    return this.prisma.$transaction(async (tx) => {
      const operationKey = `club-wallet:${userId}:${key}`;
      const existing = await tx.wallet_entries.findUnique({ where: { operation_key: operationKey }, select: { amount: true } });
      if (existing) {
        const pointEntry = await tx.club_point_entries.findUnique({ where: { operation_key: operationKey } });
        if (pointEntry?.reference_id !== rewardId) throw new ConflictException("Redemption key was reused");
        return { creditedToman: existing.amount.toString(), pointsSpent: -(pointEntry?.delta ?? 0) };
      }
      const settings = await tx.club_settings.findUniqueOrThrow({ where: { id: 1 } });
      if (!settings.enabled) throw new ConflictException("Club is inactive");
      const reward = await tx.club_rewards.findFirst({ where: { id: rewardId, active: true, kind: "wallet" } });
      if (!reward) throw new NotFoundException("Wallet reward not found");
      await this.spend(tx, userId, reward.points_cost, operationKey, "wallet_reward", reward.id);
      const allocations = await tx.club_point_allocations.findMany({ where: { operation_key: operationKey }, include: { lot: true } });
      let allocated = new Prisma.Decimal(0);
      for (const [index, item] of allocations.entries()) {
        const amount = index === allocations.length - 1 ? reward.value.minus(allocated) : reward.value.mul(item.points).div(reward.points_cost).toDecimalPlaces(0, Prisma.Decimal.ROUND_DOWN);
        if (amount.gt(0)) await tx.club_wallet_credits.create({ data: { user_id: userId, source_key: `${operationKey}:${item.lot_id}`, original_toman: amount, remaining_toman: amount, expires_at: item.lot.expires_at } });
        allocated = allocated.add(amount);
      }
      await this.wallet.apply(tx, { userId, amount: reward.value, kind: "club_credit", reason: "Club wallet reward", referenceType: "club_reward", referenceId: operationKey, operationKey, actorUserId: userId });
      await tx.outbox_events.create({ data: { aggregate: "club", aggregate_id: userId, event_type: "club.wallet.redeemed", dedupe_key: operationKey, payload: { userId, amount: reward.value.toString() } } });
      return { creditedToman: reward.value.toString(), pointsSpent: reward.points_cost };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async processPaid(orderId: string, paidAt: Date) {
    return this.prisma.$transaction(async (tx) => {
      const settings = await tx.club_settings.findUniqueOrThrow({ where: { id: 1 } });
      const rules = await tx.club_rule_versions.findFirst({ where: { effective_at: { lte: paidAt } }, orderBy: [{ effective_at: "desc" }, { id: "desc" }] });
      if (!settings.activated_at || paidAt < settings.activated_at || !rules?.enabled || !rules.points_per_1000_toman) return;
      const order = await tx.orders.findUnique({ where: { id: orderId }, select: { id: true, buyer_id: true, status: true, created_at: true, currency: true, total_amount: true, shipping_fee: true, club_discount: true, payment_groups: { select: { payment_group: { select: { id: true, amount: true, orders: { select: { order_id: true, amount: true } } } } } } } });
      if (!order || !["paid", "processing", "shipped", "awaiting_confirmation", "delivered"].includes(order.status) || order.currency.trim() !== "TOMAN") return;
      if (await tx.club_order_earnings.findUnique({ where: { order_id: orderId } })) return;
      let promoPaid = new Prisma.Decimal(0);
      for (const join of order.payment_groups) {
        const group = join.payment_group;
        const promo = await tx.club_wallet_allocations.aggregate({ where: { operation_key: `checkout-debit:${group.id}`, released_at: null }, _sum: { amount_toman: true } });
        const total = promo._sum.amount_toman ?? new Prisma.Decimal(0);
        if (total.lte(0)) continue;
        const ordered = [...group.orders].sort((a, b) => a.order_id.localeCompare(b.order_id));
        let allocated = new Prisma.Decimal(0);
        for (const [index, item] of ordered.entries()) {
          const part = index === ordered.length - 1 ? total.minus(allocated) : total.mul(item.amount).div(group.amount).toDecimalPlaces(0, Prisma.Decimal.ROUND_DOWN);
          if (item.order_id === orderId) promoPaid = promoPaid.add(part);
          allocated = allocated.add(part);
        }
      }
      const eligible = Prisma.Decimal.max(0, order.total_amount.minus(order.shipping_fee).minus(promoPaid));
      const base = Prisma.Decimal.min(MAX_AWARD_POINTS, eligible.mul(rules.points_per_1000_toman).div(1000).toDecimalPlaces(0, Prisma.Decimal.ROUND_DOWN)).toNumber();
      const member = await this.ensureMember(tx, order.buyer_id);
      const pastClubOrders = await tx.club_order_earnings.count({ where: { user_id: order.buyer_id, order_id: { not: orderId } } });
      const pastPaidOrders = await tx.orders.count({ where: { buyer_id: order.buyer_id, id: { not: orderId }, created_at: { lt: order.created_at }, status: { in: ["paid", "processing", "shipped", "awaiting_confirmation", "delivered"] } } });
      const rolling = await tx.club_order_earnings.aggregate({ where: { user_id: order.buyer_id, reversed_at: null, created_at: { gte: DateTime.fromJSDate(paidAt, { zone: "utc" }).minus({ months: 12 }).toJSDate() } }, _sum: { eligible_toman: true } });
      const tiers = await tx.club_tiers.findMany({ where: { active: true }, orderBy: { threshold_toman: "asc" } });
      const threshold = member.override_until && member.override_until > paidAt
        ? tiers.find((tier) => tier.id === member.tier_override_id)?.threshold_toman ?? new Prisma.Decimal(0)
        : tiers.filter((tier) => tier.threshold_toman.lte(rolling._sum.eligible_toman ?? new Prisma.Decimal(0))).at(-1)?.threshold_toman ?? new Prisma.Decimal(0);
      const versions = await tx.club_campaign_versions.findMany({ where: { effective_at: { lte: paidAt } }, orderBy: [{ effective_at: "desc" }, { id: "desc" }] });
      const seenCampaigns = new Set<string>();
      const campaigns = versions.filter((version) => {
        if (seenCampaigns.has(version.campaign_id)) return false;
        seenCampaigns.add(version.campaign_id);
        return version.active && version.starts_at <= paidAt && version.ends_at > paidAt;
      });
      const selectedCampaign = campaigns.filter((campaign) => !campaign.min_tier_id || tiers.some((tier) => tier.id === campaign.min_tier_id && tier.threshold_toman.lte(threshold)))
        .map((campaign) => ({ id: campaign.campaign_id, bonus: campaign.kind === "bonus" ? campaign.value.toNumber() : new Prisma.Decimal(base).mul(campaign.value.minus(1)).toDecimalPlaces(0, Prisma.Decimal.ROUND_DOWN).toNumber() }))
        .sort((a, b) => b.bonus - a.bonus || a.id.localeCompare(b.id))[0];
      const campaignBonus = Math.min(MAX_AWARD_POINTS, Math.floor(selectedCampaign?.bonus ?? 0));
      const points = Math.min(MAX_AWARD_POINTS, base + campaignBonus + (pastClubOrders === 0 && pastPaidOrders === 0 ? rules.first_purchase_points : 0));
      await tx.club_order_earnings.create({ data: { order_id: orderId, user_id: order.buyer_id, eligible_toman: eligible, points, campaign_id: selectedCampaign?.id ?? null, campaign_points: campaignBonus, created_at: paidAt } });
      if (points) await this.award(tx, order.buyer_id, points, `club-order:${orderId}`, "purchase", orderId, paidAt, rules.expiry_days);
      if (order.club_discount?.status === "reserved") {
        const discount = await tx.club_order_discounts.update({ where: { order_id: orderId }, data: { status: "paid" } });
        await this.syncReservation(tx, discount.reservation_id);
      }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async processReversal(orderId: string) {
    return this.prisma.$transaction(async (tx) => {
      const earning = await tx.club_order_earnings.findUnique({ where: { order_id: orderId } });
      if (earning && !earning.reversed_at) {
        const changed = await tx.club_order_earnings.updateMany({ where: { order_id: orderId, reversed_at: null }, data: { reversed_at: new Date() } });
        if (changed.count) {
          const lot = await tx.club_point_lots.findUnique({ where: { source_key: `club-order:${orderId}` } });
          if (lot) {
            const spent = await tx.club_point_allocations.aggregate({ where: { lot_id: lot.id, released_at: null }, _sum: { points: true } });
            const available = lot.expires_at > new Date() ? lot.remaining : 0;
            if (available) {
              await tx.club_point_lots.update({ where: { id: lot.id }, data: { remaining: 0 } });
              const member = await tx.club_members.update({ where: { user_id: earning.user_id }, data: { balance: { decrement: available } } });
              await tx.club_point_entries.create({ data: { user_id: earning.user_id, operation_key: `club-reverse:${orderId}`, delta: -available, balance_after: member.balance, kind: "reversal", reference_id: orderId } });
            }
            const debt = (spent._sum.points ?? 0) + lot.debt_paid;
            if (debt > 0) {
              const member = await tx.club_members.update({ where: { user_id: earning.user_id }, data: { point_debt: { increment: debt } } });
              await tx.club_point_debt_events.create({ data: { user_id: earning.user_id, operation_key: `club-debt-reverse:${orderId}`,
                delta: debt, debt_after: member.point_debt, kind: "reversal", reference_id: orderId } });
            }
          }
        }
      }
      const discount = await tx.club_order_discounts.findUnique({ where: { order_id: orderId }, include: { reservation: true } });
      if (discount && discount.status !== "released") {
        await tx.club_order_discounts.update({ where: { order_id: orderId }, data: { status: "released" } });
        if (discount.points) await this.release(tx, discount.reservation.user_id, `club-checkout:${discount.reservation.checkout_id}:${orderId}`, orderId);
        await this.syncReservation(tx, discount.reservation_id);
      }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  private async syncReservation(tx: Tx, reservationId: string) {
    const statuses = await tx.club_order_discounts.findMany({ where: { reservation_id: reservationId }, select: { status: true } });
    const status = statuses.some((item) => item.status === "reserved") ? "reserved"
      : statuses.some((item) => item.status === "paid") ? "paid" : "released";
    await tx.club_checkout_reservations.update({ where: { id: reservationId }, data: { status } });
  }

  async expireDue() {
    const now = new Date();
    const lots = await this.prisma.club_point_lots.findMany({ where: { remaining: { gt: 0 }, expires_at: { lte: now } }, take: 50, orderBy: { expires_at: "asc" } });
    for (const lot of lots) await this.prisma.$transaction(async (tx) => {
      const current = await tx.club_point_lots.findUniqueOrThrow({ where: { id: lot.id } });
      if (!current.remaining || current.expires_at > new Date()) return;
      await tx.club_point_lots.update({ where: { id: lot.id }, data: { remaining: 0 } });
      const member = await tx.club_members.update({ where: { user_id: lot.user_id }, data: { balance: { decrement: current.remaining } } });
      await tx.club_point_entries.create({ data: { user_id: lot.user_id, operation_key: `club-expiry:${lot.id}`, delta: -current.remaining, balance_after: member.balance, kind: "expiry", reference_id: lot.id } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    const credits = await this.prisma.club_wallet_credits.findMany({ where: { remaining_toman: { gt: 0 }, expires_at: { lte: now } }, take: 50, orderBy: { expires_at: "asc" } });
    for (const credit of credits) await this.prisma.$transaction(async (tx) => {
      const current = await tx.club_wallet_credits.findUniqueOrThrow({ where: { id: credit.id } });
      if (current.remaining_toman.lte(0) || current.expires_at > new Date()) return;
      await tx.club_wallet_credits.update({ where: { id: credit.id }, data: { remaining_toman: 0 } });
      await this.wallet.apply(tx, { userId: credit.user_id, amount: current.remaining_toman.neg(), kind: "club_expiry", reason: "Club wallet credit expired", referenceType: "club_credit", referenceId: credit.id, operationKey: `club-wallet-expiry:${credit.id}` });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    const notices = await this.prisma.club_point_lots.findMany({ where: { remaining: { gt: 0 }, expires_at: { gt: now, lte: new Date(now.getTime() + 7 * DAY) } }, take: 50 });
    for (const lot of notices) await this.prisma.outbox_events.upsert({ where: { dedupe_key: `club-expiry-notice:${lot.id}` }, update: {}, create: { aggregate: "club", aggregate_id: lot.user_id, event_type: "club.points.expiring", dedupe_key: `club-expiry-notice:${lot.id}`, payload: { userId: lot.user_id, points: lot.remaining, expiresAt: lot.expires_at.toISOString() } } });
  }
}
