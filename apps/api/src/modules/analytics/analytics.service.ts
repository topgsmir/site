import { BadRequestException, ForbiddenException, Injectable } from "@nestjs/common";
import type {
  AnalyticsActivityItem,
  AnalyticsBreakdownItem,
  AnalyticsGranularity,
  AnalyticsMetric,
  AnalyticsOverview,
  AnalyticsRankingItem,
  AnalyticsScope,
  AnalyticsSeriesPoint,
  AppUser
} from "@topgsm/shared-types";
import { Prisma } from "../../prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import type { AnalyticsOverviewQueryDto } from "./dto/analytics.dto";

type TotalsRow = {
  gross_sales: unknown;
  refunds: unknown;
  refund_commission: unknown;
  refund_holdback: unknown;
  refund_payable: unknown;
  income: unknown;
  commission: unknown;
  holdback: unknown;
  paid_orders: bigint | number;
  units_sold: bigint | number;
  settled_payouts: unknown;
  outstanding_liability: unknown;
};

type SeriesRow = {
  bucket: string;
  gross_sales: unknown;
  income: unknown;
  refunds: unknown;
  paid_orders: bigint | number;
};

type BreakdownRow = { key: string; label: string; count: bigint | number; amount: unknown };
type RankingRow = {
  id: string;
  label: string;
  secondary_label: string | null;
  count: bigint | number;
  units: bigint | number;
  amount: unknown;
};
type ActivityRow = {
  id: string;
  kind: "sale" | "refund" | "payout";
  label: string;
  secondary_label: string | null;
  amount: unknown;
  occurred_at: Date;
  status: string;
};

const DAY_MS = 86_400_000;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(actor: AppUser, input: AnalyticsOverviewQueryDto): Promise<AnalyticsOverview> {
    const { scope, sellerId } = await this.resolveScope(actor);
    const range = this.normalizeRange(input);
    const previous = this.previousRange(range.from, range.to);
    const [current, prior, series, orderStatuses, productTypes, payoutPipeline, topProducts, topCategories, recentActivity, topSellers] = await Promise.all([
      this.totals(scope, sellerId, range.from, range.to, input.timezone),
      this.totals(scope, sellerId, previous.from, previous.to, input.timezone),
      this.series(scope, sellerId, range.from, range.to, input.timezone, range.granularity),
      this.orderStatusBreakdown(sellerId, range.from, range.to, input.timezone),
      this.productTypeBreakdown(sellerId, range.from, range.to, input.timezone),
      this.payoutPipeline(sellerId),
      this.topProducts(sellerId, range.from, range.to, input.timezone),
      this.topCategories(sellerId, range.from, range.to, input.timezone),
      this.recentActivity(scope, sellerId, range.from, range.to, input.timezone),
      scope === "admin" ? this.topSellers(range.from, range.to, input.timezone) : Promise.resolve(undefined)
    ]);

    const summary = {
      grossSales: this.metric(current.gross_sales, prior.gross_sales),
      netSales: this.metric(this.minus(current.gross_sales, current.refunds), this.minus(prior.gross_sales, prior.refunds)),
      income: this.metric(this.minus(current.income, this.refundIncome(scope, current)), this.minus(prior.income, this.refundIncome(scope, prior))),
      paidOrders: this.metric(current.paid_orders, prior.paid_orders),
      unitsSold: this.metric(current.units_sold, prior.units_sold),
      averageOrderValue: this.metric(this.average(current.gross_sales, current.paid_orders), this.average(prior.gross_sales, prior.paid_orders)),
      refunds: this.metric(current.refunds, prior.refunds),
      commission: this.metric(this.minus(current.commission, current.refund_commission), this.minus(prior.commission, prior.refund_commission)),
      holdback: this.metric(this.minus(current.holdback, current.refund_holdback), this.minus(prior.holdback, prior.refund_holdback)),
      settledPayouts: this.metric(current.settled_payouts, prior.settled_payouts),
      outstandingLiability: this.money(current.outstanding_liability)
    };

    return {
      scope,
      currency: "IRR",
      range: {
        ...range,
        timezone: input.timezone,
        previousFrom: previous.from,
        previousTo: previous.to
      },
      summary,
      series,
      orderStatuses,
      productTypes,
      payoutPipeline,
      topProducts,
      topCategories,
      ...(topSellers ? { topSellers } : {}),
      recentActivity,
      generatedAt: new Date().toISOString()
    };
  }

  private async resolveScope(actor: AppUser): Promise<{ scope: AnalyticsScope; sellerId: string | null }> {
    if (actor.role === "platform-admin") return { scope: "admin", sellerId: null };
    if (actor.role !== "seller-admin" && actor.role !== "seller-staff") {
      throw new ForbiddenException("Analytics access is not allowed");
    }
    const membership = await this.prisma.seller_memberships.findFirst({
      where: {
        user_id: actor.id,
        active: true,
        seller: {
          invited: false,
          approved: true,
          suspended_at: null,
          permissions: { some: { permission: "analytics_view" } }
        }
      },
      select: { seller_id: true }
    });
    if (!membership) throw new ForbiddenException("Active seller analytics permission is required");
    return { scope: "seller", sellerId: membership.seller_id };
  }

  private normalizeRange(input: AnalyticsOverviewQueryDto) {
    const today = this.todayInTehran();
    const to = input.to ?? today;
    const from = input.from ?? this.addDays(to, -29);
    if (!DATE_PATTERN.test(from) || !DATE_PATTERN.test(to) || !this.isDate(from) || !this.isDate(to)) {
      throw new BadRequestException("Analytics dates must be valid YYYY-MM-DD values");
    }
    const days = this.daysBetween(from, to) + 1;
    if (days < 1) throw new BadRequestException("Analytics from date must not be after the to date");
    if (days > 366) throw new BadRequestException("Analytics range cannot exceed 366 days");
    const granularity: AnalyticsGranularity = days === 1 ? "hour" : days <= 90 ? "day" : days <= 180 ? "week" : "month";
    return { from, to, granularity };
  }

  private previousRange(from: string, to: string) {
    const days = this.daysBetween(from, to) + 1;
    return { from: this.addDays(from, -days), to: this.addDays(from, -1) };
  }

  private async totals(scope: AnalyticsScope, sellerId: string | null, from: string, to: string, timezone: string) {
    const seller = this.sellerPredicate(sellerId);
    const incomeColumn = scope === "admin" ? Prisma.sql`pl.commission_amount` : Prisma.sql`pl.payable_amount`;
    const rows = await this.prisma.$queryRaw<TotalsRow[]>(Prisma.sql`
      WITH paid AS (
        SELECT o.id, o.total_amount, pl.gross_amount, pl.commission_amount, pl.holdback_amount,
               pl.payable_amount, ${incomeColumn} AS income
        FROM order_events oe
        JOIN orders o ON o.id = oe.order_id
        JOIN payout_ledger pl ON pl.order_id = o.id
        WHERE oe.to_status = 'paid'
          AND oe.created_at >= (${from}::date AT TIME ZONE ${timezone})
          AND oe.created_at < ((${to}::date + 1) AT TIME ZONE ${timezone})
          ${seller}
      ), refunded AS (
        SELECT pl.gross_amount, pl.commission_amount, pl.holdback_amount, pl.payable_amount
        FROM payment_refunds pr
        JOIN payment_attempts pa ON pa.id = pr.payment_attempt_id
        JOIN orders o ON o.id = pa.order_id
        JOIN payout_ledger pl ON pl.order_id = o.id
        WHERE pr.status = 'succeeded'
          AND pr.completed_at >= (${from}::date AT TIME ZONE ${timezone})
          AND pr.completed_at < ((${to}::date + 1) AT TIME ZONE ${timezone})
          ${seller}
      ), unit_totals AS (
        SELECT COALESCE(SUM(oi.quantity), 0) AS units_sold
        FROM paid p JOIN order_items oi ON oi.order_id = p.id
      ), settled AS (
        SELECT COALESCE(SUM(pl.payable_amount), 0) AS settled_payouts
        FROM payout_ledger pl
        WHERE pl.status = 'settled'
          AND pl.settled_at >= (${from}::date AT TIME ZONE ${timezone})
          AND pl.settled_at < ((${to}::date + 1) AT TIME ZONE ${timezone})
          ${sellerId ? Prisma.sql`AND pl.seller_id = ${sellerId}` : Prisma.empty}
      ), liability AS (
        SELECT COALESCE(SUM(pl.payable_amount), 0) AS outstanding_liability
        FROM payout_ledger pl JOIN orders liability_order ON liability_order.id = pl.order_id
        WHERE pl.status IN ('draft', 'requested', 'approved')
          AND liability_order.status NOT IN ('pending', 'cancelled')
          ${sellerId ? Prisma.sql`AND pl.seller_id = ${sellerId}` : Prisma.empty}
      )
      SELECT COALESCE(SUM(p.gross_amount), 0) AS gross_sales,
             COALESCE((SELECT SUM(r.gross_amount) FROM refunded r), 0) AS refunds,
             COALESCE((SELECT SUM(r.commission_amount) FROM refunded r), 0) AS refund_commission,
             COALESCE((SELECT SUM(r.holdback_amount) FROM refunded r), 0) AS refund_holdback,
             COALESCE((SELECT SUM(r.payable_amount) FROM refunded r), 0) AS refund_payable,
             COALESCE(SUM(p.income), 0) AS income,
             COALESCE(SUM(p.commission_amount), 0) AS commission,
             COALESCE(SUM(p.holdback_amount), 0) AS holdback,
             COUNT(p.id) AS paid_orders,
             (SELECT units_sold FROM unit_totals) AS units_sold,
             (SELECT settled_payouts FROM settled) AS settled_payouts,
             (SELECT outstanding_liability FROM liability) AS outstanding_liability
      FROM paid p
    `);
    return rows[0] ?? this.emptyTotals();
  }

  private async series(scope: AnalyticsScope, sellerId: string | null, from: string, to: string, timezone: string, granularity: AnalyticsGranularity): Promise<AnalyticsSeriesPoint[]> {
    const seller = this.sellerPredicate(sellerId);
    const incomeColumn = scope === "admin" ? Prisma.sql`pl.commission_amount` : Prisma.sql`pl.payable_amount`;
    const format = granularity === "hour" ? "YYYY-MM-DD\"T\"HH24:00:00" : "YYYY-MM-DD";
    const rows = await this.prisma.$queryRaw<SeriesRow[]>(Prisma.sql`
      WITH activity AS (
        SELECT to_char(date_trunc(${granularity}, oe.created_at AT TIME ZONE ${timezone}), ${format}) AS bucket,
               pl.gross_amount AS gross_sales, ${incomeColumn} AS income, 0::numeric AS refunds, 1::bigint AS paid_orders
        FROM order_events oe
        JOIN orders o ON o.id = oe.order_id
        JOIN payout_ledger pl ON pl.order_id = o.id
        WHERE oe.to_status = 'paid'
          AND oe.created_at >= (${from}::date AT TIME ZONE ${timezone})
          AND oe.created_at < ((${to}::date + 1) AT TIME ZONE ${timezone})
          ${seller}
        UNION ALL
        SELECT to_char(date_trunc(${granularity}, pr.completed_at AT TIME ZONE ${timezone}), ${format}) AS bucket,
               0::numeric, -${incomeColumn}, pl.gross_amount, 0::bigint
        FROM payment_refunds pr
        JOIN payment_attempts pa ON pa.id = pr.payment_attempt_id
        JOIN orders o ON o.id = pa.order_id
        JOIN payout_ledger pl ON pl.order_id = o.id
        WHERE pr.status = 'succeeded'
          AND pr.completed_at >= (${from}::date AT TIME ZONE ${timezone})
          AND pr.completed_at < ((${to}::date + 1) AT TIME ZONE ${timezone})
          ${seller}
      )
      SELECT bucket, SUM(gross_sales) AS gross_sales, SUM(income) AS income,
             SUM(refunds) AS refunds, SUM(paid_orders) AS paid_orders
      FROM activity GROUP BY bucket ORDER BY bucket
    `);
    return rows.map((row) => ({
      bucket: row.bucket,
      grossSales: this.money(row.gross_sales),
      income: this.money(row.income),
      refunds: this.money(row.refunds),
      netSales: this.minus(row.gross_sales, row.refunds),
      paidOrders: Number(row.paid_orders)
    }));
  }

  private async orderStatusBreakdown(sellerId: string | null, from: string, to: string, timezone: string) {
    const rows = await this.prisma.$queryRaw<BreakdownRow[]>(Prisma.sql`
      SELECT o.status::text AS key, initcap(replace(o.status::text, '_', ' ')) AS label,
             COUNT(*) AS count, COALESCE(SUM(o.total_amount), 0) AS amount
      FROM order_events oe JOIN orders o ON o.id = oe.order_id
      WHERE oe.to_status = 'paid'
        AND oe.created_at >= (${from}::date AT TIME ZONE ${timezone})
        AND oe.created_at < ((${to}::date + 1) AT TIME ZONE ${timezone})
        ${this.sellerPredicate(sellerId)}
      GROUP BY o.status ORDER BY amount DESC
    `);
    return this.mapBreakdown(rows);
  }

  private async productTypeBreakdown(sellerId: string | null, from: string, to: string, timezone: string) {
    const rows = await this.prisma.$queryRaw<BreakdownRow[]>(Prisma.sql`
      SELECT oi.product_type::text AS key, initcap(oi.product_type::text) AS label,
             COUNT(DISTINCT o.id) AS count, COALESCE(SUM(oi.total_amount), 0) AS amount
      FROM order_events oe JOIN orders o ON o.id = oe.order_id JOIN order_items oi ON oi.order_id = o.id
      WHERE oe.to_status = 'paid'
        AND oe.created_at >= (${from}::date AT TIME ZONE ${timezone})
        AND oe.created_at < ((${to}::date + 1) AT TIME ZONE ${timezone})
        ${this.sellerPredicate(sellerId)}
      GROUP BY oi.product_type ORDER BY amount DESC
    `);
    return this.mapBreakdown(rows);
  }

  private async payoutPipeline(sellerId: string | null) {
    const rows = await this.prisma.$queryRaw<BreakdownRow[]>(Prisma.sql`
      SELECT pl.status::text AS key, initcap(pl.status::text) AS label,
             COUNT(*) AS count, COALESCE(SUM(pl.payable_amount), 0) AS amount
      FROM payout_ledger pl JOIN orders o ON o.id = pl.order_id
      WHERE o.status NOT IN ('pending', 'cancelled') ${sellerId ? Prisma.sql`AND pl.seller_id = ${sellerId}` : Prisma.empty}
      GROUP BY pl.status ORDER BY CASE pl.status
        WHEN 'draft' THEN 1 WHEN 'requested' THEN 2 WHEN 'approved' THEN 3
        WHEN 'settled' THEN 4 ELSE 5 END
    `);
    return this.mapBreakdown(rows);
  }

  private async topProducts(sellerId: string | null, from: string, to: string, timezone: string) {
    const rows = await this.prisma.$queryRaw<RankingRow[]>(Prisma.sql`
      SELECT p.id, p.title AS label, p.category AS secondary_label,
             COUNT(DISTINCT o.id) AS count, COALESCE(SUM(oi.quantity), 0) AS units,
             COALESCE(SUM(CASE WHEN o.status = 'cancelled' THEN 0 ELSE oi.total_amount END), 0) AS amount
      FROM order_events oe
      JOIN orders o ON o.id = oe.order_id JOIN order_items oi ON oi.order_id = o.id
      JOIN seller_offers so ON so.id = oi.offer_id JOIN seller_listings sl ON sl.id = so.listing_id
      JOIN products p ON p.id = sl.product_id
      WHERE oe.to_status = 'paid'
        AND oe.created_at >= (${from}::date AT TIME ZONE ${timezone})
        AND oe.created_at < ((${to}::date + 1) AT TIME ZONE ${timezone})
        ${this.sellerPredicate(sellerId)}
      GROUP BY p.id, p.title, p.category ORDER BY amount DESC, units DESC LIMIT 8
    `);
    return this.mapRanking(rows);
  }

  private async topCategories(sellerId: string | null, from: string, to: string, timezone: string) {
    const rows = await this.prisma.$queryRaw<RankingRow[]>(Prisma.sql`
      SELECT COALESCE(p.category, 'uncategorized') AS id, COALESCE(p.category, 'Uncategorized') AS label,
             NULL::text AS secondary_label, COUNT(DISTINCT o.id) AS count,
             COALESCE(SUM(oi.quantity), 0) AS units,
             COALESCE(SUM(CASE WHEN o.status = 'cancelled' THEN 0 ELSE oi.total_amount END), 0) AS amount
      FROM order_events oe
      JOIN orders o ON o.id = oe.order_id JOIN order_items oi ON oi.order_id = o.id
      JOIN seller_offers so ON so.id = oi.offer_id JOIN seller_listings sl ON sl.id = so.listing_id
      JOIN products p ON p.id = sl.product_id
      WHERE oe.to_status = 'paid'
        AND oe.created_at >= (${from}::date AT TIME ZONE ${timezone})
        AND oe.created_at < ((${to}::date + 1) AT TIME ZONE ${timezone})
        ${this.sellerPredicate(sellerId)}
      GROUP BY p.category ORDER BY amount DESC, units DESC LIMIT 8
    `);
    return this.mapRanking(rows);
  }

  private async topSellers(from: string, to: string, timezone: string) {
    const rows = await this.prisma.$queryRaw<RankingRow[]>(Prisma.sql`
      WITH seller_orders AS (
        SELECT o.id, o.seller_id, o.status, o.total_amount, COALESCE(SUM(oi.quantity), 0) AS units
        FROM order_events oe JOIN orders o ON o.id = oe.order_id JOIN order_items oi ON oi.order_id = o.id
        WHERE oe.to_status = 'paid'
          AND oe.created_at >= (${from}::date AT TIME ZONE ${timezone})
          AND oe.created_at < ((${to}::date + 1) AT TIME ZONE ${timezone})
        GROUP BY o.id, o.seller_id, o.status, o.total_amount
      )
      SELECT s.id, s.shop_name AS label, u.full_name AS secondary_label,
             COUNT(so.id) AS count, COALESCE(SUM(so.units), 0) AS units,
             COALESCE(SUM(CASE WHEN so.status = 'cancelled' THEN 0 ELSE so.total_amount END), 0) AS amount
      FROM seller_orders so JOIN sellers s ON s.id = so.seller_id JOIN users u ON u.id = s.user_id
      GROUP BY s.id, s.shop_name, u.full_name ORDER BY amount DESC, count DESC LIMIT 8
    `);
    return this.mapRanking(rows);
  }

  private async recentActivity(scope: AnalyticsScope, sellerId: string | null, from: string, to: string, timezone: string) {
    const rows = await this.prisma.$queryRaw<ActivityRow[]>(Prisma.sql`
      SELECT o.id, 'sale'::text AS kind,
             ${scope === "admin" ? Prisma.sql`s.shop_name` : Prisma.sql`concat('Order #', left(o.id, 8))`} AS label,
             concat(COUNT(oi.id), ' items') AS secondary_label, o.total_amount AS amount,
             oe.created_at AS occurred_at, o.status::text AS status
      FROM order_events oe JOIN orders o ON o.id = oe.order_id JOIN sellers s ON s.id = o.seller_id
      JOIN order_items oi ON oi.order_id = o.id
      WHERE oe.to_status = 'paid'
        AND oe.created_at >= (${from}::date AT TIME ZONE ${timezone})
        AND oe.created_at < ((${to}::date + 1) AT TIME ZONE ${timezone})
        ${this.sellerPredicate(sellerId)}
      GROUP BY o.id, s.shop_name, o.total_amount, oe.created_at, o.status
      UNION ALL
      SELECT pr.id, 'refund'::text, ${scope === "admin" ? Prisma.sql`s.shop_name` : Prisma.sql`concat('Refund #', left(pr.id, 8))`},
             concat('Order #', left(o.id, 8)), pa.amount, pr.completed_at, pr.status::text
      FROM payment_refunds pr JOIN payment_attempts pa ON pa.id = pr.payment_attempt_id
      JOIN orders o ON o.id = pa.order_id JOIN sellers s ON s.id = o.seller_id
      WHERE pr.status = 'succeeded'
        AND pr.completed_at >= (${from}::date AT TIME ZONE ${timezone})
        AND pr.completed_at < ((${to}::date + 1) AT TIME ZONE ${timezone})
        ${this.sellerPredicate(sellerId)}
      UNION ALL
      SELECT pl.id, 'payout'::text, ${scope === "admin" ? Prisma.sql`s.shop_name` : Prisma.sql`concat('Payout #', left(pl.id, 8))`},
             concat('Order #', left(pl.order_id, 8)), pl.payable_amount, pl.settled_at, pl.status::text
      FROM payout_ledger pl JOIN sellers s ON s.id = pl.seller_id
      WHERE pl.status = 'settled'
        AND pl.settled_at >= (${from}::date AT TIME ZONE ${timezone})
        AND pl.settled_at < ((${to}::date + 1) AT TIME ZONE ${timezone})
        ${sellerId ? Prisma.sql`AND pl.seller_id = ${sellerId}` : Prisma.empty}
      ORDER BY occurred_at DESC LIMIT 12
    `);
    return rows.map((row): AnalyticsActivityItem => ({
      id: row.id,
      kind: row.kind,
      label: row.label,
      secondaryLabel: row.secondary_label,
      amount: this.money(row.amount),
      occurredAt: row.occurred_at.toISOString(),
      status: row.status
    }));
  }

  private sellerPredicate(sellerId: string | null) {
    return sellerId ? Prisma.sql`AND o.seller_id = ${sellerId}` : Prisma.empty;
  }

  private mapBreakdown(rows: BreakdownRow[]): AnalyticsBreakdownItem[] {
    return rows.map((row) => ({ key: row.key, label: row.label, count: Number(row.count), amount: this.money(row.amount) }));
  }

  private mapRanking(rows: RankingRow[]): AnalyticsRankingItem[] {
    return rows.map((row) => ({
      id: row.id,
      label: row.label,
      secondaryLabel: row.secondary_label,
      count: Number(row.count),
      units: Number(row.units),
      amount: this.money(row.amount)
    }));
  }

  private metric(value: unknown, previous: unknown): AnalyticsMetric {
    const currentNumber = Number(this.money(value));
    const previousNumber = Number(this.money(previous));
    return {
      value: this.money(value),
      previousValue: this.money(previous),
      changePercent: previousNumber === 0 ? null : Number((((currentNumber - previousNumber) / Math.abs(previousNumber)) * 100).toFixed(1))
    };
  }

  private refundIncome(scope: AnalyticsScope, totals: TotalsRow) {
    return scope === "admin" ? totals.refund_commission : totals.refund_payable;
  }

  private average(total: unknown, count: bigint | number) {
    const divisor = Number(count);
    return divisor ? String(Math.round(Number(this.money(total)) / divisor)) : "0";
  }

  private money(value: unknown) {
    if (value === null || value === undefined) return "0";
    const text = String(value);
    return text.includes(".") ? text.replace(/\.0+$/, "") : text;
  }

  private minus(left: unknown, right: unknown) {
    return (BigInt(this.integerMoney(left)) - BigInt(this.integerMoney(right))).toString();
  }

  private integerMoney(value: unknown) {
    const text = this.money(value);
    return text.split(".")[0] || "0";
  }

  private emptyTotals(): TotalsRow {
    return { gross_sales: 0, refunds: 0, refund_commission: 0, refund_holdback: 0, refund_payable: 0, income: 0, commission: 0, holdback: 0, paid_orders: 0, units_sold: 0, settled_payouts: 0, outstanding_liability: 0 };
  }

  private todayInTehran() {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tehran", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
    const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${value.year}-${value.month}-${value.day}`;
  }

  private isDate(value: string) {
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
  }

  private daysBetween(from: string, to: string) {
    return Math.round((Date.parse(`${to}T00:00:00.000Z`) - Date.parse(`${from}T00:00:00.000Z`)) / DAY_MS);
  }

  private addDays(value: string, days: number) {
    return new Date(Date.parse(`${value}T00:00:00.000Z`) + days * DAY_MS).toISOString().slice(0, 10);
  }
}
