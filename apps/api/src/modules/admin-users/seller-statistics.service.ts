import { Injectable } from "@nestjs/common";
import type { SellerStatisticsPage, SellerStatisticsPeriod } from "@topgsm/shared-types";
import { DateTime } from "luxon";
import { PrismaService } from "../../prisma/prisma.service";
import type { SellerStatisticsQueryDto } from "./dto/seller-statistics.dto";

const zone = "Asia/Tehran";
const persianMonth = new Intl.DateTimeFormat("en-US-u-ca-persian", {
  timeZone: zone, year: "numeric", month: "numeric"
});

function monthKey(day: DateTime): string {
  const parts = persianMonth.formatToParts(day.toJSDate());
  return `${parts.find((part) => part.type === "year")?.value}-${parts.find((part) => part.type === "month")?.value}`;
}

function monthStart(day: DateTime): DateTime {
  const key = monthKey(day);
  let start = day.startOf("day");
  while (monthKey(start.minus({ days: 1 })) === key) start = start.minus({ days: 1 });
  return start;
}

export function sellerStatisticsWindow(period: SellerStatisticsPeriod, now = new Date()) {
  const today = DateTime.fromJSDate(now).setZone(zone).startOf("day");
  let from: DateTime | null = null;
  if (period === "7d") from = today.minus({ days: 6 });
  if (period === "month") from = monthStart(today);
  if (period === "3months") {
    from = monthStart(today);
    for (let month = 0; month < 2; month += 1) from = monthStart(from.minus({ days: 1 }));
  }
  return { from: from?.toJSDate() ?? null, to: now };
}

@Injectable()
export class SellerStatisticsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(input: SellerStatisticsQueryDto): Promise<SellerStatisticsPage> {
    const { from, to } = sellerStatisticsWindow(input.period);
    const where = { merged_into_seller_id: null };
    const [total, sellers] = await Promise.all([
      this.prisma.sellers.count({ where }),
      this.prisma.sellers.findMany({
        where, orderBy: [{ shop_name: "asc" }, { id: "asc" }],
        skip: (input.page - 1) * input.limit, take: input.limit,
        select: { id: true, user_id: true, shop_name: true }
      })
    ]);
    const ids = sellers.map((seller) => seller.id);
    if (!ids.length) return { period: input.period, from: from?.toISOString() ?? null, to: to.toISOString(), items: [], total, page: input.page, limit: input.limit };

    const createdAt = { ...(from ? { gte: from } : {}), lt: to };
    const paidOrder = {
      status: "delivered" as const,
      OR: [
        { payment_attempts: { some: { status: "succeeded" as const, verified_at: { not: null } } } },
        { payment_groups: { some: { payment_group: { status: "paid" as const } } } }
      ]
    };
    const [products, posts, income, balance, comments] = await Promise.all([
      this.prisma.seller_listings.groupBy({ by: ["seller_id"], where: { seller_id: { in: ids }, created_at: createdAt }, _count: { _all: true } }),
      this.prisma.blog_posts.groupBy({ by: ["seller_id"], where: { seller_id: { in: ids }, created_at: createdAt }, _count: { _all: true } }),
      this.prisma.payout_ledger.groupBy({ by: ["seller_id"], where: { seller_id: { in: ids }, currency: "TOMAN", created_at: createdAt, order: paidOrder }, _sum: { payable_amount: true } }),
      this.prisma.payout_ledger.groupBy({ by: ["seller_id"], where: { seller_id: { in: ids }, currency: "TOMAN", status: { not: "settled" }, order: paidOrder }, _sum: { payable_amount: true } }),
      this.prisma.comment_assignments.groupBy({ by: ["seller_id"], where: { seller_id: { in: ids }, comment: { created_at: createdAt } }, _count: { _all: true } })
    ]);
    const productCounts = new Map(products.map((row) => [row.seller_id, row._count._all]));
    const postCounts = new Map(posts.map((row) => [row.seller_id, row._count._all]));
    const commentCounts = new Map(comments.map((row) => [row.seller_id, row._count._all]));
    const incomes = new Map(income.map((row) => [row.seller_id, row._sum.payable_amount?.toString() ?? "0"]));
    const balances = new Map(balance.map((row) => [row.seller_id, row._sum.payable_amount?.toString() ?? "0"]));
    return {
      period: input.period, from: from?.toISOString() ?? null, to: to.toISOString(), total,
      page: input.page, limit: input.limit,
      items: sellers.map((seller) => ({
        id: seller.id, userId: seller.user_id, name: seller.shop_name,
        productCount: productCounts.get(seller.id) ?? 0,
        postCount: postCounts.get(seller.id) ?? 0,
        commentCount: commentCounts.get(seller.id) ?? 0,
        income: incomes.get(seller.id) ?? "0",
        balance: balances.get(seller.id) ?? "0"
      }))
    };
  }
}
