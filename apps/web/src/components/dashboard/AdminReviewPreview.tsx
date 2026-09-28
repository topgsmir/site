"use client";

import type { Route } from "next";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api/client";
import type { Locale } from "@/lib/i18n";
import { OVERVIEW_COPY } from "./overview-copy";
import styles from "./AdminReviewPreview.module.css";

type Page = { items: unknown[]; nextCursor: string | null };
type Queue = { key: "comments" | "photos" | "products" | "articles" | "refunds" | "payouts"; count: number; more: boolean; available: boolean };
const sources = [
  { key: "comments", path: "/admin/settings/comments?status=pending&limit=3", anchor: "notification-comments" },
  { key: "photos", path: "/admin/uploads/deletion-requests", anchor: "notification-photos" },
  { key: "products", path: "/products/admin?status=pending_review&limit=3", anchor: "notification-products" },
  { key: "articles", path: "/blog/manage/posts?status=pending_review&limit=3", anchor: "notification-articles" },
  { key: "refunds", path: "/bridge/admin/refund-requests?limit=3", anchor: "notification-refunds" },
  { key: "payouts", path: "/payouts?status=requested&limit=3", anchor: "notification-payouts" }
] as const;

export function AdminReviewPreview({ locale }: { locale: Locale }) {
  const c = OVERVIEW_COPY[locale];
  const [queues, setQueues] = useState<Queue[]>([]);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const number = (value: number) => new Intl.NumberFormat(locale).format(value);

  useEffect(() => {
    const controller = new AbortController();
    const frame = requestAnimationFrame(() => {
      setLoading(true);
      void Promise.allSettled(sources.map((source) => api.get<Page | unknown[]>(source.path, { signal: controller.signal }))).then((results) => {
        if (controller.signal.aborted) return;
        setQueues(results.map((result, index) => ({
          key: sources[index].key,
          count: result.status === "fulfilled" ? Array.isArray(result.value.data) ? result.value.data.length : result.value.data.items.length : 0,
          more: result.status === "fulfilled" && !Array.isArray(result.value.data) && Boolean(result.value.data.nextCursor),
          available: result.status === "fulfilled"
        })));
        setLoading(false);
      });
    });
    return () => { cancelAnimationFrame(frame); controller.abort(); };
  }, [refresh]);

  const labels = { comments: c.reviewComments, photos: c.reviewPhotos, products: c.reviewProducts, articles: c.reviewArticles, refunds: c.reviewRefunds, payouts: locale === "fa" ? "تسویه‌ها" : locale === "ar" ? "المدفوعات" : "Payouts" };
  const pending = queues.filter((queue) => queue.available && queue.count > 0);
  const failed = queues.some((queue) => !queue.available);

  return <section className={styles.preview} aria-labelledby="admin-review-title" aria-busy={loading}>
    <div className={styles.heading}><div><h2 id="admin-review-title">{c.reviewTitle}</h2><p>{c.reviewHint}</p></div><Link href={`/${locale}/admin/notifications` as Route}>{c.reviewOpen}</Link></div>
    {loading && !queues.length ? <p className={styles.muted} role="status">{c.loading}</p> : null}
    {!loading && !pending.length && !failed ? <p className={styles.muted}>{c.reviewEmpty}</p> : null}
    {pending.length ? <div className={styles.queues}>{pending.map((queue) => <Link key={queue.key} href={`/${locale}/admin/notifications#${sources.find((source) => source.key === queue.key)!.anchor}` as Route}><strong>{number(queue.count)}{queue.more ? "+" : ""}</strong><span>{labels[queue.key]}</span></Link>)}</div> : null}
    {failed ? <p className={styles.error} role="alert">{c.reviewError} <button type="button" disabled={loading} onClick={() => setRefresh((value) => value + 1)}>{c.retry}</button></p> : null}
  </section>;
}
