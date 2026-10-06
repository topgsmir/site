"use client";

import Link from "next/link";
import type { Route } from "next";
import { useEffect, useState } from "react";
import type { SellerStatisticsPage, SellerStatisticsPeriod } from "@topgsm/shared-types";
import type { Locale } from "@/lib/i18n";
import { api } from "@/lib/api/client";
import { formatCurrencyAmount } from "@/lib/currency";
import styles from "./SellerStatisticsWorkspace.module.css";

const periods: SellerStatisticsPeriod[] = ["7d", "month", "3months", "all"];
const copy = {
  fa: { title: "آمار فروشندگان", description: "عملکرد فروشندگان در بازهٔ انتخابی؛ موجودی، ماندهٔ تسویه‌نشدهٔ فعلی است.", period: "بازه زمانی", "7d": "۷ روز گذشته", month: "این ماه", "3months": "۳ ماه گذشته", all: "کل زمان", seller: "فروشنده", id: "شناسه", products: "محصولات", posts: "نوشته‌ها", comments: "دیدگاه‌ها", income: "درآمد", balance: "موجودی", currency: "تومان", empty: "فروشنده‌ای پیدا نشد.", loading: "در حال بارگذاری آمار…", error: "آمار فروشندگان بارگذاری نشد.", retry: "تلاش دوباره", previous: "قبلی", next: "بعدی", page: "صفحه", of: "از", count: "فروشنده" },
  en: { title: "Seller statistics", description: "Seller activity in the selected period; balance is the current unsettled amount.", period: "Time range", "7d": "Last 7 days", month: "This month", "3months": "Last 3 months", all: "All time", seller: "Seller", id: "ID", products: "Products", posts: "Posts", comments: "Comments", income: "Income", balance: "Balance", currency: "Toman", empty: "No sellers found.", loading: "Loading statistics…", error: "Seller statistics could not be loaded.", retry: "Try again", previous: "Previous", next: "Next", page: "Page", of: "of", count: "sellers" },
  ar: { title: "إحصاءات البائعين", description: "نشاط البائعين خلال الفترة المحددة؛ الرصيد هو المبلغ الحالي غير المسوّى.", period: "الفترة الزمنية", "7d": "آخر ٧ أيام", month: "هذا الشهر", "3months": "آخر ٣ أشهر", all: "كل الوقت", seller: "البائع", id: "المعرّف", products: "المنتجات", posts: "المقالات", comments: "التعليقات", income: "الدخل", balance: "الرصيد", currency: "تومان", empty: "لا يوجد بائعون.", loading: "جارٍ تحميل الإحصاءات…", error: "تعذر تحميل إحصاءات البائعين.", retry: "أعد المحاولة", previous: "السابق", next: "التالي", page: "صفحة", of: "من", count: "بائع" }
} as const;

export function SellerStatisticsWorkspace({ locale }: { locale: Locale }) {
  const c = copy[locale];
  const [period, setPeriod] = useState<SellerStatisticsPeriod>("7d");
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [response, setResponse] = useState<{ key: string; result: SellerStatisticsPage | null; error: boolean } | null>(null);
  const requestKey = `${period}:${page}:${revision}`;
  const loading = response?.key !== requestKey;
  const error = !loading && (response?.error ?? false);
  const result = !loading ? response?.result ?? null : null;

  useEffect(() => {
    const controller = new AbortController();
    void api.get<SellerStatisticsPage>("/admin/users/seller-statistics", {
      params: { period, page, limit: 20 }, signal: controller.signal
    }).then((response) => {
      if (!controller.signal.aborted) setResponse({ key: requestKey, result: response.data, error: false });
    }).catch(() => {
      if (!controller.signal.aborted) setResponse({ key: requestKey, result: null, error: true });
    });
    return () => controller.abort();
  }, [period, page, revision, requestKey]);

  const pageCount = Math.max(1, Math.ceil((result?.total ?? 0) / 20));
  return <section className={styles.workspace} aria-labelledby="seller-statistics-title">
    <header className={styles.header}>
      <div>
        <h1 id="seller-statistics-title">{c.title}</h1>
        <p>{c.description}</p>
      </div>
      <label className={styles.period}>{c.period}
        <select value={period} onChange={(event) => { setPeriod(event.target.value as SellerStatisticsPeriod); setPage(1); }}>
          {periods.map((value) => <option key={value} value={value}>{c[value]}</option>)}
        </select>
      </label>
    </header>
    <div className={styles.toolbar}><strong>{(result?.total ?? 0).toLocaleString(locale)} {c.count}</strong><span>{c.page} {page.toLocaleString(locale)} {c.of} {pageCount.toLocaleString(locale)}</span></div>
    {loading ? <p className={styles.state} role="status">{c.loading}</p> : null}
    {error ? <div className={styles.state} role="alert">{c.error} <button type="button" onClick={() => setRevision((value) => value + 1)}>{c.retry}</button></div> : null}
    {!loading && !error && result?.items.length === 0 ? <p className={styles.state}>{c.empty}</p> : null}
    {!loading && !error && result?.items.length ? <div className={styles.tableScroll} tabIndex={0} role="region" aria-label={c.title}>
      <table className={styles.table}>
        <thead><tr><th scope="col">{c.seller}</th><th scope="col">{c.id}</th><th scope="col">{c.products}</th><th scope="col">{c.posts}</th><th scope="col">{c.comments}</th><th scope="col">{c.income}</th><th scope="col">{c.balance}</th></tr></thead>
        <tbody>{result.items.map((seller) => <tr key={seller.id}>
          <th scope="row"><Link href={`/${locale}/admin/users/${seller.userId}` as Route}>{seller.name}</Link></th>
          <td><code className={styles.id} dir="ltr" title={seller.id}>{seller.id}</code></td>
          <td>{seller.productCount.toLocaleString(locale)}</td>
          <td>{seller.postCount.toLocaleString(locale)}</td>
          <td>{seller.commentCount.toLocaleString(locale)}</td>
          <td className={styles.money}>{formatCurrencyAmount(seller.income, "TOMAN", locale)} {c.currency}</td>
          <td className={styles.money}>{formatCurrencyAmount(seller.balance, "TOMAN", locale)} {c.currency}</td>
        </tr>)}</tbody>
      </table>
    </div> : null}
    {!loading && !error && pageCount > 1 ? <nav className={styles.pagination} aria-label={c.title}>
      <button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>{c.previous}</button>
      <span>{c.page} {page.toLocaleString(locale)} {c.of} {pageCount.toLocaleString(locale)}</span>
      <button type="button" disabled={page >= pageCount} onClick={() => setPage((value) => value + 1)}>{c.next}</button>
    </nav> : null}
  </section>;
}
