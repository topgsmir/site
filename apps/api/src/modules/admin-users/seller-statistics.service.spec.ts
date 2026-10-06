import { strict as assert } from "node:assert";
import { test } from "node:test";
import { DateTime } from "luxon";
import type { PrismaService } from "../../prisma/prisma.service";
import { SellerStatisticsService, sellerStatisticsWindow } from "./seller-statistics.service";

const zone = "Asia/Tehran";

test("seven days starts at Tehran midnight six calendar days before today", () => {
  const now = new Date("2026-10-06T12:00:00.000Z");
  const window = sellerStatisticsWindow("7d", now);
  assert.equal(DateTime.fromJSDate(window.from!).setZone(zone).toISODate(), "2026-09-30");
  assert.equal(window.to, now);
});

test("month ranges follow Persian calendar boundaries", () => {
  const now = new Date("2026-10-06T12:00:00.000Z");
  const month = sellerStatisticsWindow("month", now);
  const threeMonths = sellerStatisticsWindow("3months", now);
  const calendar = new Intl.DateTimeFormat("en-US-u-ca-persian", { timeZone: zone, year: "numeric", month: "numeric" });
  assert.equal(calendar.format(month.from!), calendar.format(now));
  assert.notEqual(calendar.format(DateTime.fromJSDate(month.from!).setZone(zone).minus({ days: 1 }).toJSDate()), calendar.format(now));
  const threeMonthStart = DateTime.fromJSDate(threeMonths.from!).setZone(zone);
  assert.notEqual(calendar.format(threeMonthStart.minus({ days: 1 }).toJSDate()), calendar.format(threeMonths.from!));
  const months = new Set([calendar.format(threeMonths.from!), calendar.format(threeMonthStart.plus({ months: 1 }).toJSDate()), calendar.format(now)]);
  assert.equal(months.size, 3);
  assert.ok(threeMonths.from! < month.from!);
  assert.equal(sellerStatisticsWindow("all", now).from, null);
});

test("seller statistics aggregate the selected period and keep balance current", async () => {
  const payoutQueries: Array<{ where: { created_at?: unknown; status?: unknown; order: unknown } }> = [];
  const prisma = {
    sellers: {
      count: async () => 1,
      findMany: async () => [{ id: "seller-1", user_id: "user-1", shop_name: "Test shop" }]
    },
    seller_listings: { groupBy: async () => [{ seller_id: "seller-1", _count: { _all: 3 } }] },
    blog_posts: { groupBy: async () => [{ seller_id: "seller-1", _count: { _all: 2 } }] },
    payout_ledger: { groupBy: async (query: typeof payoutQueries[number]) => {
      payoutQueries.push(query);
      return [{ seller_id: "seller-1", _sum: { payable_amount: { toString: () => query.where.created_at ? "1200" : "700" } } }];
    } },
    comment_assignments: { groupBy: async () => [{ seller_id: "seller-1", _count: { _all: 4 } }] }
  } as unknown as PrismaService;
  const page = await new SellerStatisticsService(prisma).list({ period: "7d", page: 1, limit: 20 });
  assert.equal(page.total, 1);
  assert.deepEqual(page.items, [{ id: "seller-1", userId: "user-1", name: "Test shop", productCount: 3, postCount: 2, commentCount: 4, income: "1200", balance: "700" }]);
  assert.equal(payoutQueries.length, 2);
  assert.ok(payoutQueries[0]?.where.created_at);
  assert.equal(payoutQueries[1]?.where.created_at, undefined);
  assert.deepEqual(payoutQueries[1]?.where.status, { not: "settled" });
  assert.equal((payoutQueries[0]?.where.order as { status: string }).status, "delivered");
});
