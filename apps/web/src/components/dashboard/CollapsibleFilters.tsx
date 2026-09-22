"use client";

import { useId, useState, type ReactNode } from "react";
import type { Locale } from "@/lib/i18n";
import styles from "./CollapsibleFilters.module.css";

const copy = {
  en: { title: "Search and filters", show: "Show", hide: "Hide", active: "active" },
  fa: { title: "جست‌وجو و فیلترها", show: "نمایش", hide: "بستن", active: "فعال" },
  ar: { title: "البحث والمرشحات", show: "عرض", hide: "إخفاء", active: "نشط" }
} as const;

type CollapsibleFiltersProps = {
  locale: Locale;
  children: ReactNode;
  title?: string;
  description?: string;
  activeCount?: number;
  defaultOpen?: boolean;
  className?: string;
  surface?: boolean;
};

export function CollapsibleFilters({
  locale,
  children,
  title,
  description,
  activeCount = 0,
  defaultOpen = true,
  className,
  surface = true
}: CollapsibleFiltersProps) {
  const [open, setOpen] = useState(defaultOpen);
  const contentId = useId();
  const c = copy[locale];

  return <div className={`${styles.disclosure}${className ? ` ${className}` : ""}`} data-open={open} data-surface={surface || undefined}>
    <button className={styles.trigger} type="button" aria-expanded={open} aria-controls={contentId} onClick={() => setOpen((current) => !current)}>
      <span className={styles.icon} aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4M4 5h4M16 5h4M7 5v4M17 15v4M4 17h10M10 3v4M14 15v4"/></svg></span>
      <span className={styles.copy}><strong>{title ?? c.title}</strong>{description ? <small>{description}</small> : null}</span>
      {activeCount > 0 ? <span className={styles.count}>{activeCount.toLocaleString(locale)} {c.active}</span> : null}
      <span className={styles.action}>{open ? c.hide : c.show}<svg aria-hidden="true" viewBox="0 0 16 16"><path d="m3 6 5 5 5-5"/></svg></span>
    </button>
    <div className={styles.body} id={contentId} hidden={!open}>{children}</div>
  </div>;
}
