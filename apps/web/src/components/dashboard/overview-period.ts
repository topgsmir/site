export type OverviewPeriod = "month" | "week" | "90d";

/** Settlement periods use Tehran civil dates, independent of browser timezone. */
export function overviewRange(period: OverviewPeriod, calendar: "persian" | "gregory", now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tehran", calendar: "gregory", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => parts.find((item) => item.type === type)!.value;
  const to = `${part("year")}-${part("month")}-${part("day")}`;
  const today = Date.parse(`${to}T00:00:00Z`);
  const dayOfMonth = Number(new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tehran", calendar, day: "numeric", numberingSystem: "latn",
  }).format(now));
  const elapsed = period === "month" ? dayOfMonth - 1
    : period === "week" ? (new Date(today).getUTCDay() + 1) % 7 : 89;
  return { from: new Date(today - elapsed * 86_400_000).toISOString().slice(0, 10), to };
}

/** Single-day API reports use hourly buckets; combine those into one day. */
export function overviewDailySales(points: ReadonlyArray<{ bucket: string; grossSales: string }>) {
  const totals = new Map<string, bigint>();
  for (const point of points) {
    const day = point.bucket.slice(0, 10);
    totals.set(day, (totals.get(day) ?? 0n) + BigInt(point.grossSales.split(".")[0] || "0"));
  }
  return new Map([...totals].map(([day, total]) => [day, total.toString()]));
}
