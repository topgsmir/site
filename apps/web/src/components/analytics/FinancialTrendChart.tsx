"use client";

import type { AnalyticsOverview, AnalyticsSeriesPoint } from "@topgsm/shared-types";
import { useMemo, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import { currencyLabel, formatCurrencyAmount } from "@/lib/currency";
import type { Locale } from "@/lib/i18n";
import styles from "./FinancialTrendChart.module.css";

type MetricKey = "grossSales" | "netSales" | "income" | "refunds";
type Props = {
  series: AnalyticsSeriesPoint[];
  range: AnalyticsOverview["range"];
  locale: Locale;
  title: string;
  inspectHint: string;
  empty: string;
  dateLabel: string;
  labels: Record<MetricKey, string>;
};

const METRICS: MetricKey[] = ["grossSales", "netSales", "income", "refunds"];
const ZERO_POINT = { grossSales: "0", netSales: "0", income: "0", refunds: "0", paidOrders: 0 };
const DAY_MS = 86_400_000;

function amount(value: string) {
  return BigInt(value.split(".")[0] || "0");
}

function dateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

function nowInTehran() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tehran", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return { date: `${values.year}-${values.month}-${values.day}`, hour: Number(values.hour) };
}

function completeSeries(series: AnalyticsSeriesPoint[], range: AnalyticsOverview["range"]) {
  if (!series.length) return series;
  const byBucket = new Map(series.map((point) => [point.bucket, point]));
  const from = new Date(`${range.from}T00:00:00Z`);
  const to = new Date(`${range.to}T00:00:00Z`);
  const points: AnalyticsSeriesPoint[] = [];

  if (range.granularity === "hour") {
    const now = nowInTehran();
    const lastHour = range.to === now.date ? now.hour : 23;
    for (let hour = 0; hour <= lastHour; hour += 1) {
      const bucket = `${range.from}T${String(hour).padStart(2, "0")}:00:00`;
      points.push(byBucket.get(bucket) ?? { bucket, ...ZERO_POINT });
    }
    return points;
  }

  if (range.granularity === "week") from.setUTCDate(from.getUTCDate() - ((from.getUTCDay() + 6) % 7));
  if (range.granularity === "month") from.setUTCDate(1);

  for (let day = from; day <= to && points.length < 400;) {
    const bucket = dateKey(day);
    points.push(byBucket.get(bucket) ?? { bucket, ...ZERO_POINT });
    if (range.granularity === "month") day = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth() + 1, 1));
    else day = new Date(day.getTime() + (range.granularity === "week" ? 7 : 1) * DAY_MS);
  }
  return points;
}

function bucketLabel(bucket: string, locale: Locale, hourly: boolean) {
  const date = new Date(`${bucket.slice(0, 10)}T${hourly ? bucket.slice(11, 19) : "12:00:00"}Z`);
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", ...(hourly ? { timeStyle: "short" as const } : {}), timeZone: "UTC" }).format(date);
}

export function FinancialTrendChart({ series, range, locale, title, inspectHint, empty, dateLabel, labels }: Props) {
  const [selected, setSelected] = useState<MetricKey[]>(["grossSales", "income"]);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const points = useMemo(() => completeSeries(series, range), [series, range]);
  const values = points.flatMap((point) => selected.map((key) => amount(point[key])));
  const minimum = values.reduce((current, value) => value < current ? value : current, 0n);
  const maximum = values.reduce((current, value) => value > current ? value : current, 0n);
  const yFor = (value: string) => maximum === minimum ? 218 : 218 - Number(((amount(value) - minimum) * 18000n) / (maximum - minimum)) / 100;
  const xFor = (index: number) => points.length <= 1 ? 360 : 28 + (index / (points.length - 1)) * 664;
  const active = activeIndex === null ? null : points[activeIndex];
  const money = (value: string) => `${formatCurrencyAmount(value, "TOMAN", locale)} ${currencyLabel("TOMAN")}`;

  function toggle(key: MetricKey) {
    setSelected((current) => current.includes(key) ? current.length === 1 ? current : current.filter((item) => item !== key) : METRICS.filter((item) => item === key || current.includes(item)));
    setActiveIndex(null);
  }

  function inspectPointer(event: PointerEvent<SVGSVGElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width * 720;
    setActiveIndex(Math.max(0, Math.min(points.length - 1, Math.round((x - 28) / 664 * (points.length - 1)))));
  }

  function inspectKeyboard(event: KeyboardEvent<SVGSVGElement>) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    setActiveIndex((current) => event.key === "Home" ? 0 : event.key === "End" ? points.length - 1 : Math.max(0, Math.min(points.length - 1, (current ?? 0) + (event.key === "ArrowRight" ? 1 : -1))));
  }

  return <>
    <div className={styles.selector} role="group" aria-label={title}>
      {METRICS.map((key) => <button key={key} type="button" data-series={key} aria-pressed={selected.includes(key)} onClick={() => toggle(key)}><i aria-hidden="true"/>{labels[key]}</button>)}
    </div>
    {points.length ? <div className={styles.plot} onPointerLeave={(event) => { if (event.pointerType === "mouse") setActiveIndex(null); }}>
      <svg className={styles.chart} viewBox="0 0 720 250" role="img" aria-label={`${title}. ${inspectHint}`} tabIndex={0} preserveAspectRatio="none" onPointerMove={inspectPointer} onPointerDown={inspectPointer} onFocus={() => setActiveIndex((current) => current ?? 0)} onBlur={() => setActiveIndex(null)} onKeyDown={inspectKeyboard}>
        <path className={styles.grid} d="M28 38H692M28 98H692M28 158H692M28 218H692"/>
        {minimum < 0n ? <path className={styles.baseline} d={`M28 ${yFor("0")}H692`}/> : null}
        {selected.map((key) => <polyline key={key} data-series={key} points={points.map((point, index) => `${xFor(index)},${yFor(point[key])}`).join(" ")}/>)}
        {selected.flatMap((key) => points.map((point, index) => <g key={`${key}:${point.bucket}`} className={styles.point} data-series={key} data-active={activeIndex === index || undefined}>
          <circle className={styles.hit} cx={xFor(index)} cy={yFor(point[key])} r="11"/>
          <circle className={styles.dot} cx={xFor(index)} cy={yFor(point[key])} r="4"/>
        </g>))}
      </svg>
      {active ? <div className={styles.tooltip} style={{ "--tooltip-left": `${Math.min(78, Math.max(22, xFor(activeIndex!) / 720 * 100))}%` } as CSSProperties} role="status">
        <strong>{bucketLabel(active.bucket, locale, range.granularity === "hour")}</strong>
        {selected.map((key) => <span key={key} data-series={key}><i aria-hidden="true"/>{labels[key]}<b>{money(active[key])}</b></span>)}
      </div> : null}
    </div> : <p className={styles.empty}>{empty}</p>}
    <div className={styles.srOnly}><table><caption>{title}</caption><thead><tr><th>{dateLabel}</th>{METRICS.map((key) => <th key={key}>{labels[key]}</th>)}</tr></thead><tbody>{points.map((point) => <tr key={point.bucket}><td>{bucketLabel(point.bucket, locale, range.granularity === "hour")}</td>{METRICS.map((key) => <td key={key}>{money(point[key])}</td>)}</tr>)}</tbody></table></div>
  </>;
}
