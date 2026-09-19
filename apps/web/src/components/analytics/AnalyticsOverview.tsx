"use client";

import type { AnalyticsMetric, AnalyticsOverview as AnalyticsOverviewData } from "@topgsm/shared-types";
import type { Route } from "next";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api/client";
import { currencyLabel, formatCurrencyAmount } from "@/lib/currency";
import type { Locale } from "@/lib/i18n";
import styles from "./AnalyticsOverview.module.css";

type Audience = "admin" | "seller";
type Preset = "today" | "7d" | "30d" | "90d" | "ytd" | "12m" | "custom";
type Range = { from: string; to: string };

const COPY = {
  en: {
    title: "Sales and income", intro: "Track verified sales, earned income, refunds, and payout movement.", refresh: "Refresh", retry: "Try again", loading: "Loading analytics…", error: "Analytics could not be loaded.", empty: "No financial activity in this period.",
    today: "Today", d7: "7 days", d30: "30 days", d90: "90 days", ytd: "Year to date", m12: "12 months", custom: "Custom", from: "From", to: "To", apply: "Apply", compared: "Previous period", noComparison: "No previous activity", grossSales: "Gross sales", netSales: "Net sales", adminIncome: "Commission income", sellerIncome: "Net earned", paidOrders: "Paid orders", unitsSold: "Units sold", averageOrder: "Average order", settled: "Settled payouts", liability: "Outstanding liability", refunds: "Refunds", commission: "Commission", holdback: "Holdback", salesTrend: "Sales and income trend", sales: "Sales", income: "Income", financial: "Gross-to-net", orders: "Order status", productTypes: "Product mix", payouts: "Payout pipeline", products: "Top products", categories: "Top categories", sellers: "Top sellers", activity: "Recent financial activity", ordersCount: "orders", units: "units", amount: "Amount", date: "Date", status: "Status", viewOrders: "View orders", viewProducts: "View products", viewSellers: "View sellers"
  },
  fa: {
    title: "فروش و درآمد", intro: "فروش‌های تأییدشده، درآمد، بازپرداخت و جریان تسویه را بررسی کنید.", refresh: "تازه‌سازی", retry: "تلاش دوباره", loading: "در حال دریافت آمار…", error: "دریافت آمار انجام نشد.", empty: "در این بازه فعالیت مالی ثبت نشده است.",
    today: "امروز", d7: "۷ روز", d30: "۳۰ روز", d90: "۹۰ روز", ytd: "از ابتدای سال", m12: "۱۲ ماه", custom: "بازه دلخواه", from: "از", to: "تا", apply: "اعمال", compared: "نسبت به بازه قبل", noComparison: "بدون فعالیت قبلی", grossSales: "فروش ناخالص", netSales: "فروش خالص", adminIncome: "درآمد کارمزد", sellerIncome: "درآمد خالص", paidOrders: "سفارش پرداخت‌شده", unitsSold: "تعداد فروش", averageOrder: "میانگین سفارش", settled: "تسویه‌شده", liability: "بدهی تسویه‌نشده", refunds: "بازپرداخت", commission: "کارمزد", holdback: "ذخیره", salesTrend: "روند فروش و درآمد", sales: "فروش", income: "درآمد", financial: "از ناخالص تا خالص", orders: "وضعیت سفارش‌ها", productTypes: "ترکیب محصولات", payouts: "روند تسویه", products: "محصولات برتر", categories: "دسته‌های برتر", sellers: "فروشندگان برتر", activity: "فعالیت مالی اخیر", ordersCount: "سفارش", units: "عدد", amount: "مبلغ", date: "تاریخ", status: "وضعیت", viewOrders: "مشاهده سفارش‌ها", viewProducts: "مشاهده محصولات", viewSellers: "مشاهده فروشندگان"
  },
  ar: {
    title: "المبيعات والدخل", intro: "تابع المبيعات المؤكدة والدخل والمبالغ المستردة وحركة الدفعات.", refresh: "تحديث", retry: "حاول مجدداً", loading: "جارٍ تحميل التحليلات…", error: "تعذر تحميل التحليلات.", empty: "لا يوجد نشاط مالي في هذه الفترة.",
    today: "اليوم", d7: "7 أيام", d30: "30 يوماً", d90: "90 يوماً", ytd: "منذ بداية السنة", m12: "12 شهراً", custom: "مخصص", from: "من", to: "إلى", apply: "تطبيق", compared: "مقارنة بالفترة السابقة", noComparison: "لا يوجد نشاط سابق", grossSales: "إجمالي المبيعات", netSales: "صافي المبيعات", adminIncome: "دخل العمولة", sellerIncome: "صافي الدخل", paidOrders: "الطلبات المدفوعة", unitsSold: "الوحدات المباعة", averageOrder: "متوسط الطلب", settled: "دفعات مسوّاة", liability: "التزامات معلقة", refunds: "مبالغ مستردة", commission: "العمولة", holdback: "المبلغ المحجوز", salesTrend: "اتجاه المبيعات والدخل", sales: "المبيعات", income: "الدخل", financial: "من الإجمالي إلى الصافي", orders: "حالة الطلبات", productTypes: "مزيج المنتجات", payouts: "مسار الدفعات", products: "أفضل المنتجات", categories: "أفضل الفئات", sellers: "أفضل البائعين", activity: "النشاط المالي الأخير", ordersCount: "طلبات", units: "وحدات", amount: "المبلغ", date: "التاريخ", status: "الحالة", viewOrders: "عرض الطلبات", viewProducts: "عرض المنتجات", viewSellers: "عرض البائعين"
  }
} as const;

const DAY_MS = 86_400_000;

function dateInTehran() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tehran", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function addDays(value: string, days: number) {
  return new Date(Date.parse(`${value}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

function rangeFor(preset: Exclude<Preset, "custom">): Range {
  const to = dateInTehran();
  if (preset === "today") return { from: to, to };
  if (preset === "ytd") return { from: `${to.slice(0, 4)}-01-01`, to };
  if (preset === "12m") return { from: addDays(to, -364), to };
  return { from: addDays(to, preset === "7d" ? -6 : preset === "30d" ? -29 : -89), to };
}

function readInitialRange(): { preset: Preset; range: Range } {
  if (typeof window === "undefined") return { preset: "30d", range: rangeFor("30d") };
  const params = new URLSearchParams(window.location.search);
  const from = params.get("analyticsFrom");
  const to = params.get("analyticsTo");
  if (from && to && /^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to)) return { preset: "custom", range: { from, to } };
  return { preset: "30d", range: rangeFor("30d") };
}

function money(value: string, locale: Locale) {
  return `${formatCurrencyAmount(value, "IRR", locale)} ${currencyLabel("IRR")}`;
}

function metricChange(metric: AnalyticsMetric, copy: (typeof COPY)[Locale], locale: Locale) {
  if (metric.changePercent === null) return copy.noComparison;
  const sign = metric.changePercent > 0 ? "+" : "";
  return `${sign}${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(metric.changePercent)}% ${copy.compared}`;
}

function safeRatio(value: string, maximum: bigint) {
  const current = BigInt(value.split(".")[0] || "0");
  if (maximum <= 0n || current <= 0n) return 0;
  return Number((current * 10_000n) / maximum) / 10_000;
}

export function AnalyticsOverview({ locale, audience }: { locale: Locale; audience: Audience }) {
  const copy = COPY[locale];
  const initial = useMemo(readInitialRange, []);
  const [preset, setPreset] = useState<Preset>(initial.preset);
  const [range, setRange] = useState<Range>(initial.range);
  const [draft, setDraft] = useState<Range>(initial.range);
  const [data, setData] = useState<AnalyticsOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await api.get<AnalyticsOverviewData>("/analytics/overview", { params: { ...range, timezone: "Asia/Tehran" } });
      setData(response.data);
    } catch {
      setError(copy.error);
    } finally {
      setLoading(false);
    }
  }, [copy.error, range]);

  useEffect(() => { void refreshKey; const frame = requestAnimationFrame(() => void load()); return () => cancelAnimationFrame(frame); }, [load, refreshKey]);
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("analyticsFrom", range.from);
    url.searchParams.set("analyticsTo", range.to);
    window.history.replaceState(window.history.state, "", url);
  }, [range]);

  function choosePreset(next: Exclude<Preset, "custom">) {
    const nextRange = rangeFor(next);
    setPreset(next); setRange(nextRange); setDraft(nextRange);
  }

  const metrics = data ? audience === "admin"
    ? [[copy.grossSales, data.summary.grossSales, true], [copy.netSales, data.summary.netSales, true], [copy.adminIncome, data.summary.income, true], [copy.paidOrders, data.summary.paidOrders, false], [copy.averageOrder, data.summary.averageOrderValue, true], [copy.liability, { value: data.summary.outstandingLiability, previousValue: "0", changePercent: null }, true]] as const
    : [[copy.grossSales, data.summary.grossSales, true], [copy.netSales, data.summary.netSales, true], [copy.sellerIncome, data.summary.income, true], [copy.paidOrders, data.summary.paidOrders, false], [copy.settled, data.summary.settledPayouts, true], [copy.liability, { value: data.summary.outstandingLiability, previousValue: "0", changePercent: null }, true]] as const
    : [];

  const chartMaximum = data?.series.reduce((maximum, point) => {
    const values = [point.grossSales, point.income].map((value) => BigInt(value.split(".")[0] || "0"));
    return values.reduce((result, value) => value > result ? value : result, maximum);
  }, 0n) ?? 0n;
  const chartPoints = (key: "grossSales" | "income") => data?.series.map((point, index, points) => {
    const x = points.length <= 1 ? 360 : 28 + (index / (points.length - 1)) * 664;
    const y = 218 - safeRatio(point[key], chartMaximum) * 180;
    return `${x},${y}`;
  }).join(" ") ?? "";

  const links = audience === "admin"
    ? { orders: `/${locale}/admin/orders`, products: `/${locale}/admin/products`, sellers: `/${locale}/admin/vendors` }
    : { orders: `/${locale}/seller-dashboard?section=orders`, products: `/${locale}/seller-dashboard?section=products`, sellers: `/${locale}/seller-dashboard` };

  return <section className={styles.workspace} aria-labelledby="analytics-title">
    <header className={styles.header}>
      <div><h1 id="analytics-title">{copy.title}</h1><p>{copy.intro}</p></div>
      <button className={styles.refresh} type="button" onClick={() => setRefreshKey((value) => value + 1)} disabled={loading}>{copy.refresh}</button>
    </header>

    <div className={styles.filters} aria-label={copy.custom}>
      <div className={styles.presets} role="group" aria-label={copy.custom}>
        {(["today", "7d", "30d", "90d", "ytd", "12m"] as const).map((item) => <button key={item} type="button" aria-pressed={preset === item} onClick={() => choosePreset(item)}>{item === "today" ? copy.today : item === "7d" ? copy.d7 : item === "30d" ? copy.d30 : item === "90d" ? copy.d90 : item === "ytd" ? copy.ytd : copy.m12}</button>)}
        <button type="button" aria-pressed={preset === "custom"} onClick={() => setPreset("custom")}>{copy.custom}</button>
      </div>
      {preset === "custom" ? <form className={styles.customRange} onSubmit={(event) => { event.preventDefault(); if (draft.from <= draft.to) setRange(draft); }}>
        <label><span>{copy.from}</span><input type="date" value={draft.from} max={draft.to} onChange={(event) => setDraft((current) => ({ ...current, from: event.target.value }))}/></label>
        <label><span>{copy.to}</span><input type="date" value={draft.to} min={draft.from} max={dateInTehran()} onChange={(event) => setDraft((current) => ({ ...current, to: event.target.value }))}/></label>
        <button type="submit" disabled={!draft.from || !draft.to || draft.from > draft.to}>{copy.apply}</button>
      </form> : null}
    </div>

    {loading && !data ? <div className={styles.skeleton} aria-live="polite"><span>{copy.loading}</span>{Array.from({ length: 6 }, (_, index) => <i key={index}/>)}</div> : null}
    {error && !data ? <div className={styles.error} role="alert"><p>{error}</p><button type="button" onClick={() => void load()}>{copy.retry}</button></div> : null}
    {data ? <>
      {error ? <p className={styles.inlineError} role="status">{error}</p> : null}
      <div className={styles.metrics} aria-label={copy.title} aria-busy={loading}>
        {metrics.map(([label, metric, monetary]) => <article key={label}><span>{label}</span><strong>{monetary ? money(metric.value, locale) : new Intl.NumberFormat(locale).format(Number(metric.value))}</strong><small data-tone={metric.changePercent !== null && metric.changePercent < 0 ? "down" : "up"}>{metricChange(metric, copy, locale)}</small></article>)}
      </div>

      <article className={styles.chartCard}>
        <div className={styles.cardHead}><div><h2>{copy.salesTrend}</h2><p>{new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(`${data.range.from}T00:00:00Z`))} — {new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(`${data.range.to}T00:00:00Z`))}</p></div><div className={styles.legend}><span data-series="sales">{copy.sales}</span><span data-series="income">{copy.income}</span></div></div>
        {data.series.length ? <svg className={styles.chart} viewBox="0 0 720 250" role="img" aria-label={copy.salesTrend} preserveAspectRatio="none">
          <path d="M28 38H692M28 98H692M28 158H692M28 218H692" />
          <polyline data-series="sales" points={chartPoints("grossSales")}/><polyline data-series="income" points={chartPoints("income")}/>
          {data.series.map((point, index, points) => { const x = points.length <= 1 ? 360 : 28 + (index / (points.length - 1)) * 664; const y = 218 - safeRatio(point.grossSales, chartMaximum) * 180; return <circle key={point.bucket} cx={x} cy={y} r="4"><title>{point.bucket}: {money(point.grossSales, locale)}</title></circle>; })}
        </svg> : <p className={styles.empty}>{copy.empty}</p>}
        <table className={styles.srOnly}><caption>{copy.salesTrend}</caption><thead><tr><th>{copy.date}</th><th>{copy.sales}</th><th>{copy.income}</th><th>{copy.refunds}</th></tr></thead><tbody>{data.series.map((point) => <tr key={point.bucket}><td>{point.bucket}</td><td>{point.grossSales}</td><td>{point.income}</td><td>{point.refunds}</td></tr>)}</tbody></table>
      </article>

      <div className={styles.detailGrid}>
        <Breakdown title={copy.financial} items={[{ key: "gross", label: copy.grossSales, count: Number(data.summary.paidOrders.value), amount: data.summary.grossSales.value }, { key: "commission", label: copy.commission, count: 0, amount: data.summary.commission.value }, { key: "holdback", label: copy.holdback, count: 0, amount: data.summary.holdback.value }, { key: "refunds", label: copy.refunds, count: 0, amount: data.summary.refunds.value }, { key: "net", label: copy.netSales, count: Number(data.summary.paidOrders.value), amount: data.summary.netSales.value }]} locale={locale}/>
        <Breakdown title={copy.orders} items={data.orderStatuses} locale={locale}/>
        <Breakdown title={copy.productTypes} items={data.productTypes} locale={locale}/>
        <Breakdown title={copy.payouts} items={data.payoutPipeline} locale={locale}/>
      </div>

      <div className={styles.rankGrid}>
        <Ranking title={copy.products} items={data.topProducts} locale={locale} units={copy.units} orders={copy.ordersCount} link={{ href: links.products, label: copy.viewProducts }}/>
        {audience === "admin" && data.topSellers ? <Ranking title={copy.sellers} items={data.topSellers} locale={locale} units={copy.units} orders={copy.ordersCount} link={{ href: links.sellers, label: copy.viewSellers }}/> : <Ranking title={copy.categories} items={data.topCategories} locale={locale} units={copy.units} orders={copy.ordersCount}/>} 
      </div>

      <article className={styles.activity}>
        <div className={styles.cardHead}><h2>{copy.activity}</h2><Link href={links.orders as Route}>{copy.viewOrders}</Link></div>
        {data.recentActivity.length ? <ul>{data.recentActivity.map((item) => <li key={`${item.kind}:${item.id}`}><span data-kind={item.kind}>{item.kind}</span><div><strong>{item.label}</strong><small>{item.secondaryLabel}</small></div><div><strong>{money(item.amount, locale)}</strong><small>{new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.occurredAt))} · {item.status}</small></div></li>)}</ul> : <p className={styles.empty}>{copy.empty}</p>}
      </article>
    </> : null}
  </section>;
}

function Breakdown({ title, items, locale }: { title: string; items: AnalyticsOverviewData["orderStatuses"]; locale: Locale }) {
  const maximum = items.reduce((result, item) => { const amount = BigInt(item.amount.split(".")[0] || "0"); return amount > result ? amount : result; }, 0n);
  return <article className={styles.breakdown}><h2>{title}</h2>{items.length ? <ul>{items.map((item) => <li key={item.key}><div><span>{item.label}</span><strong>{money(item.amount, locale)}</strong></div><i><b style={{ inlineSize: `${safeRatio(item.amount, maximum) * 100}%` }}/></i>{item.count ? <small>{new Intl.NumberFormat(locale).format(item.count)}</small> : null}</li>)}</ul> : <p className={styles.empty}>—</p>}</article>;
}

function Ranking({ title, items, locale, units, orders, link }: { title: string; items: AnalyticsOverviewData["topProducts"]; locale: Locale; units: string; orders: string; link?: { href: string; label: string } }) {
  return <article className={styles.ranking}><div className={styles.cardHead}><h2>{title}</h2>{link ? <Link href={link.href as Route}>{link.label}</Link> : null}</div>{items.length ? <ol>{items.map((item, index) => <li key={item.id}><span>{new Intl.NumberFormat(locale).format(index + 1)}</span><div><strong>{item.label}</strong><small>{item.secondaryLabel ?? `${new Intl.NumberFormat(locale).format(item.count)} ${orders} · ${new Intl.NumberFormat(locale).format(item.units)} ${units}`}</small></div><strong>{money(item.amount, locale)}</strong></li>)}</ol> : <p className={styles.empty}>—</p>}</article>;
}
