import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { Prisma } from "../../prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import type { CreateMarketingLinkDto, UpdateMarketingLinkDto } from "./dto/marketing.dto";

type ReferralLine = { id: string; offerId: string; productId: string; totalAmount: string };
type RequestedLine = { offerId: string; visitId?: string };

const linkSelect = {
  id: true, code: true, seller_id: true, product_id: true, recipient_name: true, recipient_contact: true,
  commission_rate: true, funding_source: true, active: true, expires_at: true, created_at: true,
  product: { select: { title: true, slug: true } }, seller: { select: { shop_name: true } }
} satisfies Prisma.marketing_linksSelect;

@Injectable()
export class MarketingService {
  constructor(private readonly prisma: PrismaService) {}

  private mapLink(row: Prisma.marketing_linksGetPayload<{ select: typeof linkSelect }>, visits = 0, purchases = 0, earned = "0") {
    return {
      id: row.id, code: row.code, sellerId: row.seller_id, sellerName: row.seller.shop_name,
      productId: row.product_id, productTitle: row.product.title, productSlug: row.product.slug,
      recipientName: row.recipient_name, recipientContact: row.recipient_contact,
      percentage: row.commission_rate.mul(100).toString(), fundingSource: row.funding_source,
      active: row.active, expiresAt: row.expires_at?.toISOString() ?? null,
      createdAt: row.created_at.toISOString(), visits, purchases, earned
    };
  }

  async create(sellerId: string | undefined, actorId: string, input: CreateMarketingLinkDto, admin: boolean) {
    if (!sellerId) throw new BadRequestException("Choose a seller");
    if (!admin && input.sellerId && input.sellerId !== sellerId) throw new BadRequestException("Seller cannot be changed");
    if (!admin && input.fundingSource === "platform") throw new BadRequestException("Only admins can use platform funding");
    const fundingSource = input.fundingSource ?? "seller";
    const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;
    if (expiresAt && (Number.isNaN(expiresAt.getTime()) || expiresAt <= new Date())) throw new BadRequestException("Expiry must be in the future");
    const listing = await this.prisma.seller_listings.findFirst({
      where: { seller_id: sellerId, product_id: input.productId, status: "active", offers: { some: { status: "active" } }, product: { status: "active" }, seller: { approved: true, suspended_at: null, merged_into_seller_id: null } },
      select: { id: true, seller: { select: { commission: true } } }
    });
    if (!listing) throw new NotFoundException("Active seller product not found");
    const rate = new Prisma.Decimal(input.percentage).div(100);
    if (fundingSource === "platform" && rate.gt(listing.seller.commission)) throw new BadRequestException("Referral percentage exceeds platform commission");
    const row = await this.prisma.$transaction(async (tx) => {
      const link = await tx.marketing_links.create({
        data: { code: randomBytes(15).toString("base64url"), seller_id: sellerId, product_id: input.productId,
          created_by_user_id: actorId, recipient_name: input.recipientName.trim(),
          recipient_contact: input.recipientContact?.trim() || null, commission_rate: rate,
          funding_source: fundingSource, expires_at: expiresAt }, select: linkSelect
      });
      await tx.marketing_events.create({ data: { link_id: link.id, actor_user_id: actorId, action: "created" } });
      return link;
    });
    return this.mapLink(row);
  }

  async update(id: string, sellerId: string | undefined, actorId: string, input: UpdateMarketingLinkDto) {
    if (Object.keys(input).length === 0) throw new BadRequestException("No changes supplied");
    const row = await this.prisma.$transaction(async (tx) => {
      const changed = await tx.marketing_links.updateMany({
        where: { id, ...(sellerId ? { seller_id: sellerId } : {}) },
        data: { ...(input.active !== undefined ? { active: input.active } : {}),
          ...(input.recipientName !== undefined ? { recipient_name: input.recipientName.trim() } : {}),
          ...(input.recipientContact !== undefined ? { recipient_contact: input.recipientContact.trim() || null } : {}) }
      });
      if (changed.count !== 1) throw new NotFoundException("Referral link not found");
      await tx.marketing_events.create({ data: { link_id: id, actor_user_id: actorId, action: "updated", detail: input.active === undefined ? "recipient" : input.active ? "activated" : "deactivated" } });
      return tx.marketing_links.findUniqueOrThrow({ where: { id }, select: linkSelect });
    });
    return this.mapLink(row);
  }

  async list(sellerId?: string, cursor?: string) {
    const rows = await this.prisma.marketing_links.findMany({
      where: sellerId ? { seller_id: sellerId } : {}, select: linkSelect,
      orderBy: [{ created_at: "desc" }, { id: "desc" }], take: 21,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {})
    });
    const page = rows.slice(0, 20);
    const ids = page.map((row) => row.id);
    const [visitCounts, earningCounts, amounts] = await Promise.all([
      this.prisma.marketing_visits.groupBy({ by: ["link_id"], where: { link_id: { in: ids } }, _count: { _all: true } }),
      this.prisma.marketing_earnings.groupBy({ by: ["link_id"], where: { link_id: { in: ids }, status: { in: ["payable", "paid"] } }, _count: { _all: true } }),
      this.prisma.marketing_earnings.groupBy({ by: ["link_id"], where: { link_id: { in: ids }, status: { in: ["payable", "paid"] } }, _sum: { amount: true } })
    ]);
    return { items: page.map((row) => this.mapLink(row,
      visitCounts.find((count) => count.link_id === row.id)?._count._all ?? 0,
      earningCounts.find((count) => count.link_id === row.id)?._count._all ?? 0,
      amounts.find((amount) => amount.link_id === row.id)?._sum.amount?.toString() ?? "0")),
      nextCursor: rows.length > 20 ? page.at(-1)!.id : null };
  }

  async options(sellerId?: string, search?: string) {
    const rows = await this.prisma.seller_listings.findMany({
      where: { ...(sellerId ? { seller_id: sellerId } : {}), status: "active", offers: { some: { status: "active" } }, product: { status: "active", ...(search?.trim() ? { title: { contains: search.trim(), mode: "insensitive" } } : {}) },
        seller: { approved: true, suspended_at: null, merged_into_seller_id: null } },
      orderBy: [{ created_at: "desc" }, { id: "desc" }], take: 30,
      select: { product_id: true, seller_id: true, product: { select: { title: true } }, seller: { select: { shop_name: true } } }
    });
    return rows.map((row) => ({ productId: row.product_id, sellerId: row.seller_id, title: row.product.title, sellerName: row.seller.shop_name }));
  }

  async visit(code: string) {
    const link = await this.prisma.marketing_links.findFirst({
      where: { code, active: true, OR: [{ expires_at: null }, { expires_at: { gt: new Date() } }],
        product: { status: "active" }, seller: { approved: true, suspended_at: null, merged_into_seller_id: null } },
      select: { id: true, seller_id: true, product_id: true, product: { select: { slug: true } } }
    });
    if (!link) throw new NotFoundException("Referral link is unavailable");
    const listing = await this.prisma.seller_listings.findFirst({ where: { seller_id: link.seller_id, product_id: link.product_id, status: "active", offers: { some: { status: "active" } } }, select: { id: true } });
    if (!listing) throw new NotFoundException("Referral link is unavailable");
    const visit = await this.prisma.marketing_visits.create({ data: { link_id: link.id }, select: { id: true } });
    return { visitId: visit.id, productSlug: link.product.slug };
  }

  async reserve(tx: Prisma.TransactionClient, orderId: string, sellerId: string, paidProductTotal: Prisma.Decimal, lines: ReferralLine[], requested: RequestedLine[]) {
    const requestedByOffer = new Map(requested.map((line) => [line.offerId, line.visitId]));
    const ids = [...new Set(lines.map((line) => requestedByOffer.get(line.offerId)).filter((id): id is string => Boolean(id)))];
    if (!ids.length) return;
    const visits = await tx.marketing_visits.findMany({ where: { id: { in: ids }, created_at: { gt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
      select: { id: true, link: { select: { id: true, seller_id: true, product_id: true, commission_rate: true, funding_source: true, active: true, expires_at: true } } } });
    const byVisit = new Map(visits.map((visit) => [visit.id, visit]));
    const rawTotal = lines.reduce((sum, line) => sum.add(line.totalAmount), new Prisma.Decimal(0));
    let sellerCost = new Prisma.Decimal(0);
    let platformCost = new Prisma.Decimal(0);
    for (const line of lines) {
      const visitId = requestedByOffer.get(line.offerId);
      if (!visitId) continue;
      const visit = byVisit.get(visitId);
      if (!visit || visit.link.seller_id !== sellerId || visit.link.product_id !== line.productId || !visit.link.active || (visit.link.expires_at && visit.link.expires_at <= new Date())) {
        throw new BadRequestException("Referral visit is invalid or expired");
      }
      const base = new Prisma.Decimal(line.totalAmount).mul(paidProductTotal).div(rawTotal).toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP);
      const amount = base.mul(visit.link.commission_rate).toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP);
      if (amount.isZero()) continue;
      await tx.marketing_earnings.create({ data: { link_id: visit.link.id, visit_id: visitId, order_id: orderId,
        order_item_id: line.id, base_amount: base, commission_rate: visit.link.commission_rate, amount,
        funding_source: visit.link.funding_source } });
      if (visit.link.funding_source === "seller") sellerCost = sellerCost.add(amount);
      else platformCost = platformCost.add(amount);
    }
    const ledger = await tx.payout_ledger.findUniqueOrThrow({ where: { order_id: orderId }, select: { payable_amount: true, commission_amount: true } });
    if (sellerCost.gt(ledger.payable_amount) || platformCost.gt(ledger.commission_amount)) throw new ConflictException("Referral commission exceeds available sale proceeds");
    if (!sellerCost.isZero()) await tx.payout_ledger.update({ where: { order_id: orderId }, data: {
      marketing_commission_amount: sellerCost, payable_amount: ledger.payable_amount.minus(sellerCost) } });
    if (!platformCost.isZero()) await tx.payout_ledger.update({ where: { order_id: orderId }, data: {
      platform_marketing_commission_amount: platformCost } });
  }

  async onPaid(tx: Prisma.TransactionClient, orderId: string) {
    await tx.marketing_earnings.updateMany({ where: { order_id: orderId, status: "pending" }, data: { status: "payable" } });
  }

  async onReversed(tx: Prisma.TransactionClient, orderId: string) {
    await tx.marketing_earnings.updateMany({ where: { order_id: orderId, status: { in: ["pending", "payable"] } }, data: { status: "reversed" } });
  }

  async earnings(linkId: string, cursor?: string, sellerId?: string) {
    const link = await this.prisma.marketing_links.findFirst({ where: { id: linkId, ...(sellerId ? { seller_id: sellerId } : {}) }, select: { id: true } });
    if (!link) throw new NotFoundException("Referral link not found");
    const rows = await this.prisma.marketing_earnings.findMany({ where: { link_id: linkId }, orderBy: [{ created_at: "desc" }, { id: "desc" }], take: 21,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}), select: { id: true, order_id: true, base_amount: true, amount: true, status: true, funding_source: true, created_at: true, paid_at: true, order: { select: { status: true } } } });
    return { items: rows.slice(0, 20).map((row) => ({ id: row.id, orderId: row.order_id, baseAmount: row.base_amount.toString(), amount: row.amount.toString(), status: row.status,
      fundingSource: row.funding_source, orderStatus: row.order.status, createdAt: row.created_at.toISOString(), paidAt: row.paid_at?.toISOString() ?? null })), nextCursor: rows.length > 20 ? rows[19].id : null };
  }

  async events(linkId: string, cursor?: string, sellerId?: string) {
    const link = await this.prisma.marketing_links.findFirst({ where: { id: linkId, ...(sellerId ? { seller_id: sellerId } : {}) }, select: { id: true } });
    if (!link) throw new NotFoundException("Referral link not found");
    const rows = await this.prisma.marketing_events.findMany({ where: { link_id: linkId }, orderBy: [{ created_at: "desc" }, { id: "desc" }], take: 21,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}), select: { id: true, action: true, detail: true, created_at: true, actor: { select: { full_name: true } } } });
    return { items: rows.slice(0, 20).map((row) => ({ id: row.id, action: row.action, detail: row.detail, actorName: row.actor.full_name, createdAt: row.created_at.toISOString() })), nextCursor: rows.length > 20 ? rows[19].id : null };
  }

  async markPaid(id: string, actorId: string, reference: string) {
    return this.prisma.$transaction(async (tx) => {
      const earning = await tx.marketing_earnings.findUnique({ where: { id }, select: { id: true, link_id: true, status: true, order: { select: { status: true, payment_attempts: { where: { status: "refunded" }, select: { id: true }, take: 1 } } } } });
      if (!earning) throw new NotFoundException("Referral earning not found");
      if (earning.status !== "payable" || earning.order.status !== "delivered" || earning.order.payment_attempts.length) throw new ConflictException("Commission is not ready for payout");
      const updated = await tx.marketing_earnings.updateMany({ where: { id, status: "payable" }, data: { status: "paid", paid_at: new Date() } });
      if (updated.count !== 1) throw new ConflictException("Commission changed");
      await tx.marketing_events.create({ data: { link_id: earning.link_id, actor_user_id: actorId, action: "payout_recorded", detail: reference.trim() } });
      return { id, status: "paid" };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}
