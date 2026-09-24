"use client";

import type { AnalyticsMetric, AnalyticsOverview } from "@topgsm/shared-types";
import type { Route } from "next";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api/client";
import { currencyLabel, formatCurrencyAmount } from "@/lib/currency";
import type { Locale } from "@/lib/i18n";
import { overviewRange, overviewDailySales, type OverviewPeriod } from "./overview-period";
import { OVERVIEW_COPY } from "./overview-copy";
import styles from "./PanelOverview.module.css";

type Destination = "orders" | "products" | "payouts" | "statistics";
type Props = {
  locale: Locale;
  audience: "admin" | "seller";
  analytics?: boolean;
  canManageOrders: boolean;
  canManageProducts: boolean;
  newOrderCount: number;
  onNavigate?: (destination: Destination) => void;
};

function Arrow() {
  return <svg className={styles.arrow} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" /></svg>;
}

export function PanelOverview({ locale, audience, analytics = true, canManageOrders, canManageProducts, newOrderCount, onNavigate }: Props) {
  const c = OVERVIEW_COPY[locale];
  const [period, setPeriod] = useState<OverviewPeriod>("month");
  const [refresh, setRefresh] = useState(0);
  const [data, setData] = useState<AnalyticsOverview | null>(null);
  const [loading, setLoading] = useState(analytics);
  const [error, setError] = useState(false);
  const seller = audience === "seller";
  const number = (value: number | string) => new Intl.NumberFormat(locale).format(Number(value));
  const money = (value: string) => formatCurrencyAmount(value, "TOMAN", locale);
  const unit = currencyLabel("TOMAN");
  const date = (value: string) => new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", timeZone: "Asia/Tehran" }).format(new Date(value.length === 10 ? `${value}T00:00:00Z` : value));

  useEffect(() => {
    if (!analytics) return;
    const controller = new AbortController();
    const frame = requestAnimationFrame(() => {
      setLoading(true);
      setError(false);
      void api.get<AnalyticsOverview>("/analytics/overview", { params: { ...overviewRange(period, "persian"), timezone: "Asia/Tehran" }, signal: controller.signal })
        .then((response) => { if (!controller.signal.aborted) setData(response.data); })
        .catch(() => { if (!controller.signal.aborted) setError(true); })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    });
    return () => { cancelAnimationFrame(frame); controller.abort(); };
  }, [analytics, period, refresh]);

  function destination(section: Destination, label: string, className = styles.textLink) {
    const reportRange = data?.range ?? overviewRange(period, "persian");
    const query = section === "statistics" ? `?analyticsFrom=${reportRange.from}&analyticsTo=${reportRange.to}` : "";
    if (onNavigate) return <button className={className} type="button" onClick={() => {
      if (section === "statistics") {
        const url = new URL(window.location.href);
        url.searchParams.set("analyticsFrom", reportRange.from);
        url.searchParams.set("analyticsTo", reportRange.to);
        window.history.replaceState(window.history.state, "", url);
      }
      onNavigate(section);
    }}>{label}<Arrow /></button>;
    return <Link className={className} href={`/${locale}/admin/${section}${query}` as Route}>{label}<Arrow /></Link>;
  }

  function change(metric: AnalyticsMetric) {
    const value = metric.changePercent;
    return <span className={styles.change} data-direction={value === null || value === 0 ? "neutral" : value > 0 ? "up" : "down"}>
      {value === null ? c.noComparison : value === 0 ? c.unchanged : <><b dir="ltr">{value > 0 ? "↗ +" : "↘ "}{new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value)}%</b> {c.previous}</>}
    </span>;
  }

  const metrics = data ? [
    { label: seller ? c.earnings : c.income, metric: data.summary.income, monetary: true },
    { label: c.orders, metric: data.summary.paidOrders, monetary: false },
    { label: c.average, metric: data.summary.averageOrderValue, monetary: true },
  ] : [];
  // The endpoint returns active days only. Keep quiet days on the timeline so
  // a week without sales cannot be visually compressed into a single interval.
  const seriesByDay = overviewDailySales(data?.series ?? []);
  const start = data ? Date.parse(`${data.range.from}T00:00:00Z`) : 0;
  const dayCount = data ? Math.round((Date.parse(`${data.range.to}T00:00:00Z`) - start) / 86_400_000) + 1 : 0;
  const series = Array.from({ length: Math.min(90, Math.max(0, dayCount)) }, (_, index) => {
    const bucket = new Date(start + index * 86_400_000).toISOString().slice(0, 10);
    return { bucket, grossSales: seriesByDay.get(bucket) ?? "0" };
  });
  const maximum = series.reduce((max, point) => { const value = BigInt(point.grossSales.split(".")[0]); return value > max ? value : max; }, 0n);
  const points = series.map((point, index, all) => `${all.length === 1 ? 320 : 8 + index / (all.length - 1) * 624},${174 - (maximum > 0n ? Number(BigInt(point.grossSales.split(".")[0]) * 10000n / maximum) / 10000 : 0) * 150}`).join(" ");

  const actions = [
    ...(canManageOrders ? [{ key: "orders" as const, label: c.manageOrders, hint: c.ordersHint, icon: "orders" }] : []),
    ...(canManageProducts ? [{ key: "products" as const, label: c.products, hint: c.productsHint, icon: "products" }] : []),
    ...(seller ? [{ key: "payouts" as const, label: c.payouts, hint: c.payoutsHint, icon: "payouts" }] : []),
  ];

  return <section className={styles.overview} aria-labelledby="panel-overview-title">
    <header className={styles.heading}>
      <div><p className={styles.eyebrow}>TOPGSM <span aria-hidden="true">/</span> {c.workspace}</p><h1 id="panel-overview-title">{seller ? c.seller : c.admin}</h1><p>{seller ? c.sellerIntro : c.adminIntro}</p></div>
      {seller && canManageProducts ? <Link className={styles.primary} href={`/${locale}/seller-dashboard/products/new` as Route}><span aria-hidden="true">＋</span>{c.add}</Link> : analytics ? destination("statistics", c.report, styles.primary) : null}
    </header>

    {analytics ? <div className={styles.toolbar}>
      <div className={styles.periods} role="group" aria-label={c.period}>{((seller ? ["month", "week"] : ["month", "week", "90d"]) as OverviewPeriod[]).map((value) => <button type="button" key={value} aria-pressed={period === value} onClick={() => setPeriod(value)}>{value === "week" ? c.thisWeek : value === "month" ? c.thisMonth : c.days90}</button>)}</div>
      <div className={styles.tools}><span>{c.timezone}</span><button className={styles.refresh} type="button" disabled={loading} onClick={() => setRefresh((value) => value + 1)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5M6 7a7 7 0 0 1 12-1l2 3M4 15l2 3a7 7 0 0 0 12-1" /></svg>{loading ? c.updating : c.refresh}</button></div>
    </div> : null}

    {error ? <div className={styles.error} role="alert"><span>{data ? c.stale : c.error}</span><button type="button" disabled={loading} onClick={() => setRefresh((value) => value + 1)}>{c.retry}</button></div> : null}

    <div className={styles.layout}>
      <div className={styles.performance} aria-busy={loading}>
        {analytics && !data ? <div className={styles.loading} role="status"><p>{error ? c.error : c.loading}</p>{!error ? <><i /><div><i /><i /><i /></div></> : null}</div> : null}
        {analytics && data ? <>
          <article className={styles.hero}>
            <div className={styles.heroTop}><h2>{c.sales}</h2><span>{date(data.range.from)} — {date(data.range.to)}</span></div>
            <div className={styles.total}><strong>{money(data.summary.grossSales.value)}</strong><span>{unit}</span></div>
            {change(data.summary.grossSales)}
            <div className={styles.metrics}>{metrics.map(({ label, metric, monetary }) => <div key={label}><h3>{label}</h3><strong>{monetary ? money(metric.value) : number(metric.value)}{monetary ? <small>{unit}</small> : null}</strong>{change(metric)}</div>)}</div>
          </article>
          <article className={styles.chartCard}>
            <div className={styles.sectionHead}><div><h2>{c.trend}</h2><p>{c.trendHint}</p></div>{destination("statistics", c.report)}</div>
            {maximum > 0n ? <>
              <div className={styles.chartScale}><span>{money(maximum.toString())} {unit}</span><span>{c.sales}</span></div>
              <svg className={styles.chart} viewBox="0 0 640 190" role="img" aria-label={c.trend} preserveAspectRatio="none"><path className={styles.gridline} d="M8 24H632M8 74H632M8 124H632M8 174H632" /><polygon className={styles.area} points={`${points.split(" ")[0]?.split(",")[0]},174 ${points} ${points.split(" ").at(-1)?.split(",")[0]},174`} /><polyline points={points} />{series.length === 1 ? <circle cx="320" cy="24" r="4" /> : null}</svg>
              <div className={styles.chartDates} dir="ltr"><span>{date(data.range.from)}</span><span>{date(data.range.to)}</span></div>
              <details className={styles.daily}><summary>{c.details}</summary><div className={styles.dailyRows}>{series.map((point) => <div key={point.bucket}><span>{date(point.bucket)}</span><strong>{money(point.grossSales)} {unit}</strong></div>)}</div></details>
            </> : <div className={styles.empty}><strong>{c.empty}</strong><p>{c.emptyHint}</p>{canManageProducts ? destination("products", c.products) : null}</div>}
          </article>
        </> : !analytics ? <div className={styles.welcome}><h2>{c.access}</h2><p>{c.accessHint}</p>{canManageProducts ? destination("products", c.products, styles.primary) : null}</div> : null}
      </div>

      <aside className={styles.operations} aria-labelledby="overview-operations">
        <div className={styles.sectionHead}><div><h2 id="overview-operations">{c.operations}</h2><p>{c.operationsHint}</p></div></div>
        <div className={styles.actions}>{actions.map((action) => <div className={styles.action} key={action.key}><span className={styles.actionIcon} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">{action.icon === "orders" ? <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Zm3 5h6m-6 4h6" /> : action.icon === "products" ? <path d="m12 3 9 5v9l-9 5-9-5V8l9-5Zm0 10 9-5m-9 5L3 8m9 5v9M7 6l9 5" /> : <><rect x="3" y="5" width="18" height="15" rx="2" /><path d="M3 9h18m-6 6h3" /></>}</svg></span><div>{destination(action.key, action.label)}<p>{action.hint}</p>{action.key === "orders" && newOrderCount > 0 ? <span className={styles.orderBadge}>{number(newOrderCount)} {c.newOrders}</span> : null}</div></div>)}
          {!seller && analytics ? <div className={styles.action}><span className={styles.actionIcon} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="7" r="4" /><path d="M4 21v-3a8 8 0 0 1 16 0v3" /></svg></span><div><Link className={styles.textLink} href={`/${locale}/admin/vendors` as Route}>{c.vendors}<Arrow /></Link><p>{c.vendorsHint}</p></div></div> : null}
        </div>
        {analytics && data ? <section className={styles.settlement}><h2>{c.finances}</h2><p>{c.liability}</p><strong>{money(data.summary.outstandingLiability)} <small>{unit}</small></strong><span>{c.liabilityHint}</span><dl><div><dt>{c.settled}</dt><dd>{money(data.summary.settledPayouts.value)} <small>{unit}</small></dd></div><div><dt>{c.refunds}</dt><dd>{money(data.summary.refunds.value)} <small>{unit}</small></dd></div></dl></section> : null}
      </aside>
    </div>

    {analytics && data ? <>
      <div className={styles.bottomGrid}>
        <article className={styles.listCard}><div className={styles.sectionHead}><div><h2>{c.activity}</h2><p>{c.activityHint}</p></div></div>{data.recentActivity.length ? <ul className={styles.activity}>{data.recentActivity.slice(0, 5).map((item) => <li key={`${item.kind}:${item.id}`}><span className={styles.kind} data-kind={item.kind}>{c[item.kind]}</span><div><strong>{item.label}</strong><time dateTime={item.occurredAt}>{new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Tehran" }).format(new Date(item.occurredAt))}</time></div><b>{money(item.amount)}<small>{unit}</small></b></li>)}</ul> : <p className={styles.empty}>{c.noActivity}</p>}</article>
        <article className={styles.listCard}><div className={styles.sectionHead}><div><h2>{c.leaders}</h2><p>{c.leadersHint}</p></div></div>{data.topProducts.length ? <ol className={styles.ranking}>{data.topProducts.slice(0, 5).map((item, index) => <li key={item.id}><span>{new Intl.NumberFormat(locale, { minimumIntegerDigits: 2 }).format(index + 1)}</span><div><strong>{item.label}</strong><small>{number(item.units)} {c.units}</small></div><b>{money(item.amount)}<small>{unit}</small></b></li>)}</ol> : <p className={styles.empty}>{c.noProducts}</p>}</article>
      </div>
      <p className={styles.updated} role="status">{loading ? c.updating : <>{c.updated}: {new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Tehran" }).format(new Date(data.generatedAt))} · {c.timezone}</>}</p>
    </> : null}
  </section>;
}
