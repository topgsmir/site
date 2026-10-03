import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "../../prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { ClubService } from "./club.service";
import type { ClubAdjustDto, ClubCampaignDto, ClubOverrideDto, ClubRewardDto, ClubSettingsDto, ClubTierDto } from "./dto/club.dto";

const money = (value: string) => {
  if (!/^(?:0|[1-9]\d{0,14})$/.test(value)) throw new BadRequestException("Amount must be a nonnegative whole Toman value");
  return new Prisma.Decimal(value);
};
const instant = (value: string) => {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new BadRequestException("Invalid date");
  return date;
};

@Injectable()
export class ClubAdminService {
  constructor(private readonly prisma: PrismaService, private readonly club: ClubService) {}

  private audit(tx: Prisma.TransactionClient, actor: string, action: string, target: string | null, detail: Prisma.InputJsonValue) {
    return tx.club_admin_events.create({ data: { actor_user_id: actor, action, target_id: target, detail } });
  }

  async updateSettings(actor: string, input: ClubSettingsDto) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.club_settings.findUniqueOrThrow({ where: { id: 1 } });
      if (input.enabled === null) throw new BadRequestException("Club status must be true or false");
      const next = { enabled: input.enabled ?? current.enabled,
        points_per_1000_toman: input.pointsPer1000Toman === undefined ? current.points_per_1000_toman : input.pointsPer1000Toman,
        toman_per_point: input.tomanPerPoint === undefined ? current.toman_per_point : input.tomanPerPoint,
        min_redeem_points: input.minRedeemPoints === undefined ? current.min_redeem_points : input.minRedeemPoints,
        max_redeem_points: input.maxRedeemPoints === undefined ? current.max_redeem_points : input.maxRedeemPoints };
      if (next.enabled && (!next.points_per_1000_toman || !next.toman_per_point || !next.min_redeem_points || !next.max_redeem_points)) throw new ConflictException("Set earning and redemption rates before activation");
      if (next.min_redeem_points && next.max_redeem_points && next.min_redeem_points > next.max_redeem_points) throw new BadRequestException("Minimum redemption exceeds maximum");
      if (next.enabled && !await tx.club_tiers.count({ where: { active: true, threshold_toman: 0 } })) throw new ConflictException("Configure a base tier before activation");
      if (next.enabled && !await tx.club_rewards.count({ where: { active: true } })) throw new ConflictException("Configure a reward before activation");
      const updated = await tx.club_settings.update({ where: { id: 1 }, data: {
        enabled: input.enabled ?? current.enabled,
        activated_at: input.enabled && !current.activated_at ? new Date() : current.activated_at,
        enabled_since: input.enabled && !current.enabled ? new Date() : current.enabled_since,
        points_per_1000_toman: input.pointsPer1000Toman,
        toman_per_point: input.tomanPerPoint,
        signup_points: input.signupPoints,
        first_purchase_points: input.firstPurchasePoints,
        min_redeem_points: input.minRedeemPoints,
        max_redeem_points: input.maxRedeemPoints,
        expiry_days: input.expiryDays
      } });
      await tx.club_rule_versions.create({ data: { effective_at: new Date(), enabled: updated.enabled,
        points_per_1000_toman: updated.points_per_1000_toman, first_purchase_points: updated.first_purchase_points, expiry_days: updated.expiry_days } });
      await this.audit(tx, actor, "settings.update", "1", { before: current, after: updated } as unknown as Prisma.InputJsonValue);
      return updated;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  tiers() { return this.prisma.club_tiers.findMany({ orderBy: { sort_order: "asc" } }); }
  async putTier(actor: string, id: string | null, input: ClubTierDto) {
    const threshold = money(input.thresholdToman);
    return this.prisma.$transaction(async (tx) => {
      const data = { name_fa: input.nameFa.trim(), name_en: input.nameEn.trim(), name_ar: input.nameAr.trim(), threshold_toman: threshold, sort_order: input.sortOrder, active: input.active ?? true };
      if (!data.name_fa || !data.name_en || !data.name_ar) throw new BadRequestException("Tier names are required");
      const tier = id ? await tx.club_tiers.update({ where: { id }, data }) : await tx.club_tiers.create({ data });
      const settings = await tx.club_settings.findUniqueOrThrow({ where: { id: 1 } });
      if (settings.enabled && !await tx.club_tiers.count({ where: { active: true, threshold_toman: 0 } })) throw new ConflictException("An active club needs a base tier");
      await this.audit(tx, actor, id ? "tier.update" : "tier.create", tier.id, { ...data, threshold_toman: threshold.toString() });
      return tier;
    });
  }

  rewards() { return this.prisma.club_rewards.findMany({ orderBy: { created_at: "desc" } }); }
  async putReward(actor: string, id: string | null, input: ClubRewardDto) {
    const value = money(input.value);
    if (value.lte(0) || (input.kind === "percentage_discount" && value.gt(100)) || (input.kind === "wallet" && value.gt(1_000_000_000))) throw new BadRequestException("Invalid reward value");
    if (input.kind === "percentage_discount" && !input.maxDiscount) throw new BadRequestException("Percentage rewards require a maximum discount");
    return this.prisma.$transaction(async (tx) => {
      const data = { name_fa: input.nameFa.trim(), name_en: input.nameEn.trim(), name_ar: input.nameAr.trim(), kind: input.kind,
        points_cost: input.pointsCost, value, max_discount: input.maxDiscount ? money(input.maxDiscount) : null,
        min_order: input.minOrder ? money(input.minOrder) : null, active: input.active ?? true };
      if (!data.name_fa || !data.name_en || !data.name_ar) throw new BadRequestException("Reward names are required");
      const reward = id ? await tx.club_rewards.update({ where: { id }, data }) : await tx.club_rewards.create({ data });
      const settings = await tx.club_settings.findUniqueOrThrow({ where: { id: 1 } });
      if (settings.enabled && !await tx.club_rewards.count({ where: { active: true } })) throw new ConflictException("An active club needs an available reward");
      await this.audit(tx, actor, id ? "reward.update" : "reward.create", reward.id, { ...data, value: value.toString(), max_discount: data.max_discount?.toString(), min_order: data.min_order?.toString() });
      return reward;
    });
  }

  campaigns() { return this.prisma.club_campaigns.findMany({ orderBy: { starts_at: "desc" } }); }
  async putCampaign(actor: string, id: string | null, input: ClubCampaignDto) {
    if (!/^(?:0|[1-9]\d{0,6})(?:\.\d{1,2})?$/.test(input.value)) throw new BadRequestException("Invalid campaign value");
    const value = new Prisma.Decimal(input.value);
    if (value.lte(0) || value.gt(input.kind === "multiplier" ? 100 : 1_000_000) || (input.kind === "multiplier" && value.lt(1)) || (input.kind === "bonus" && !value.isInteger())) throw new BadRequestException("Invalid campaign value");
    const starts = instant(input.startsAt); const ends = instant(input.endsAt);
    if (ends <= starts) throw new BadRequestException("Campaign must end after it starts");
    return this.prisma.$transaction(async (tx) => {
      const data = { name_fa: input.nameFa.trim(), name_en: input.nameEn.trim(), name_ar: input.nameAr.trim(), kind: input.kind,
        value, starts_at: starts, ends_at: ends, min_tier_id: input.minTierId ?? null, active: input.active ?? true };
      if (!data.name_fa || !data.name_en || !data.name_ar) throw new BadRequestException("Campaign names are required");
      const campaign = id ? await tx.club_campaigns.update({ where: { id }, data }) : await tx.club_campaigns.create({ data });
      await tx.club_campaign_versions.create({ data: { campaign_id: campaign.id, effective_at: new Date(), kind: data.kind, value,
        starts_at: starts, ends_at: ends, min_tier_id: data.min_tier_id, active: data.active } });
      await this.audit(tx, actor, id ? "campaign.update" : "campaign.create", campaign.id, { ...data, value: value.toString(), starts_at: starts.toISOString(), ends_at: ends.toISOString() });
      return campaign;
    });
  }

  async members(cursor?: string, limit = 25) {
    const rows = await this.prisma.users.findMany({ where: { account_status: "active" }, orderBy: { id: "asc" }, take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}), select: { id: true, full_name: true, created_at: true, club_member: { select: { balance: true, point_debt: true, override_until: true, override_tier: true } } } });
    return { items: rows.slice(0, limit), nextCursor: rows.length > limit ? rows[limit - 1]?.id : null };
  }

  async adjust(actor: string, userId: string, input: ClubAdjustDto, key: string) {
    if (!input.points || input.reason.trim().length < 3) throw new BadRequestException("Points and a reason are required");
    return this.prisma.$transaction(async (tx) => {
      const settings = await tx.club_settings.findUniqueOrThrow({ where: { id: 1 } });
      if (!settings.enabled) throw new ConflictException("Activate the club before adjusting points");
      const operationKey = `club-adjust:${actor}:${key}`;
      const priorLot = input.points > 0 ? await tx.club_point_lots.findUnique({ where: { source_key: operationKey } }) : null;
      if (priorLot) {
        if (priorLot.user_id !== userId || priorLot.original !== input.points || priorLot.reference_id !== input.reason) throw new ConflictException("Adjustment key was reused");
        return priorLot;
      }
      const prior = await tx.club_point_entries.findUnique({ where: { operation_key: operationKey } });
      if (prior) {
        if (prior.user_id !== userId || prior.delta !== input.points || prior.reference_id !== input.reason) throw new ConflictException("Adjustment key was reused");
        return prior;
      }
      if (input.points > 0) await this.club.award(tx, userId, input.points, operationKey, "admin_award", input.reason);
      else await this.club.spend(tx, userId, -input.points, operationKey, "admin_debit", input.reason);
      await this.audit(tx, actor, "member.adjust", userId, { points: input.points, reason: input.reason });
      return tx.club_point_entries.findUnique({ where: { operation_key: operationKey } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async override(actor: string, userId: string, input: ClubOverrideDto) {
    const until = instant(input.until);
    if (until <= new Date() || input.reason.trim().length < 3) throw new BadRequestException("A future end date and reason are required");
    return this.prisma.$transaction(async (tx) => {
      await this.club.ensureMember(tx, userId);
      const tier = await tx.club_tiers.findUnique({ where: { id: input.tierId } });
      if (!tier?.active) throw new NotFoundException("Active tier not found");
      const member = await tx.club_members.update({ where: { user_id: userId }, data: { tier_override_id: tier.id, override_until: until, override_reason: input.reason.trim() } });
      await this.audit(tx, actor, "member.tier_override", userId, { tierId: tier.id, until: until.toISOString(), reason: input.reason });
      return member;
    });
  }

  async reports() {
    const [members, issued, spent, expired, tiers, campaigns, balances, credits, subsidy, sales, campaignEarnings] = await Promise.all([
      this.prisma.users.count({ where: { account_status: "active" } }),
      this.prisma.club_point_entries.aggregate({ where: { delta: { gt: 0 }, kind: { not: "release" } }, _sum: { delta: true } }),
      this.prisma.club_point_entries.aggregate({ where: { delta: { lt: 0 }, kind: { in: ["checkout", "wallet_reward"] } }, _sum: { delta: true } }),
      this.prisma.club_point_entries.aggregate({ where: { kind: "expiry" }, _sum: { delta: true } }),
      this.prisma.club_tiers.findMany({ where: { active: true }, orderBy: { threshold_toman: "asc" } }),
      this.prisma.club_campaigns.count({ where: { active: true, starts_at: { lte: new Date() }, ends_at: { gt: new Date() } } }),
      this.prisma.club_members.aggregate({ _sum: { balance: true, point_debt: true } }),
      this.prisma.club_wallet_credits.aggregate({ where: { expires_at: { gt: new Date() } }, _sum: { remaining_toman: true } }),
      this.prisma.club_order_discounts.aggregate({ where: { status: "paid" }, _sum: { subsidy_toman: true } }),
      this.prisma.club_order_earnings.aggregate({ where: { reversed_at: null }, _sum: { eligible_toman: true }, _count: true }),
      this.prisma.club_order_earnings.groupBy({ by: ["campaign_id"], where: { campaign_id: { not: null }, reversed_at: null }, _count: true, _sum: { campaign_points: true, eligible_toman: true } })
    ]);
    return { members, pointsIssued: issued._sum.delta ?? 0, pointsRedeemed: -(spent._sum.delta ?? 0), pointsExpired: -(expired._sum.delta ?? 0),
      pointsOutstanding: balances._sum.balance ?? 0, pointDebt: balances._sum.point_debt ?? 0,
      walletCreditLiabilityToman: (credits._sum.remaining_toman ?? new Prisma.Decimal(0)).toString(),
      platformSubsidyToman: (subsidy._sum.subsidy_toman ?? new Prisma.Decimal(0)).toString(),
      eligibleSalesToman: (sales._sum.eligible_toman ?? new Prisma.Decimal(0)).toString(),
      rewardedOrders: sales._count,
      campaignPerformance: campaignEarnings.map((row) => ({ campaignId: row.campaign_id, orders: row._count, bonusPoints: row._sum.campaign_points ?? 0, eligibleSalesToman: (row._sum.eligible_toman ?? new Prisma.Decimal(0)).toString() })),
      tiers, activeCampaigns: campaigns };
  }
}
