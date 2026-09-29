"use client";

import { useEffect, useState } from "react";
import type { Locale } from "@/lib/i18n";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function relativeLabel(elapsed: number, locale: Locale): string {
  if (elapsed < MINUTE) return { fa: "لحظاتی پیش", en: "just now", ar: "منذ لحظات" }[locale];

  const [count, unit] = elapsed < HOUR
    ? [Math.floor(elapsed / MINUTE), "minute"] as const
    : elapsed < DAY
      ? [Math.floor(elapsed / HOUR), "hour"] as const
      : elapsed < 30 * DAY
        ? [Math.floor(elapsed / DAY), "day"] as const
        : elapsed < 365 * DAY
          ? [Math.floor(elapsed / (30 * DAY)), "month"] as const
          : [Math.floor(elapsed / (365 * DAY)), "year"] as const;

  if (locale === "fa") {
    const name = { minute: "دقیقه", hour: "ساعت", day: "روز", month: "ماه", year: "سال" }[unit];
    return `${new Intl.NumberFormat("fa-IR").format(count)} ${name} ${unit === "minute" || unit === "hour" ? "قبل" : "پیش"}`;
  }
  return new Intl.RelativeTimeFormat(locale, { numeric: "always" }).format(-count, unit);
}

export function RelativeOrderTime({ value, locale, showExact = false }: { value: string; locale: Locale; showExact?: boolean }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), MINUTE);
    return () => window.clearInterval(timer);
  }, []);

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return <span>—</span>;

  const exact = new Intl.DateTimeFormat(locale, {
    year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    timeZone: "Asia/Tehran"
  }).format(date) + ` (${({ fa: "تهران", en: "Tehran", ar: "طهران" } as const)[locale]})`;
  const relative = relativeLabel(Math.max(0, now - date.getTime()), locale);

  return <><time dateTime={value} title={exact} aria-label={`${relative}${locale === "fa" || locale === "ar" ? "، " : ", "}${exact}`} suppressHydrationWarning>{relative}</time>{showExact ? <small aria-hidden="true"> · {exact}</small> : null}</>;
}
