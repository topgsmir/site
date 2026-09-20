"use client";

import Link from "next/link";
import type { Route } from "next";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api/client";
import { currencyLabel, formatCurrencyAmount } from "@/lib/currency";
import type { Locale } from "@/lib/i18n";
import { ACCOUNT_COPY } from "./AccountCopy";
import { WORKSPACE_COPY } from "./AccountWorkspaceCopy";
import { AccountIcon } from "./AccountIcon";
import styles from "./AccountOrders.module.css";

type OrderSummary = {
  id: string; status: string; currency: string; totalAmount: string; createdAt: string;
  seller: { shopName: string };
  items: Array<{ id: string; productTitle: string; productType: string; quantity: number }>;
};
type OrderPage = { items: OrderSummary[]; nextCursor: string | null };
type Filter = "all" | "active" | "complete" | "closed";
const ACTIVE_STATUSES = new Set(["pending", "paid", "processing", "awaiting_confirmation", "shipped"]);

export function AccountOrders({ locale, view }: { locale: Locale; view: "overview" | "orders" }) {
  const c = ACCOUNT_COPY[locale];
  const w = WORKSPACE_COPY[locale];
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const request = useRef<AbortController | null>(null);
  const failedCursor = useRef<string | undefined>(undefined);

  const load = useCallback(async (next?: string) => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    if (next) setLoadingMore(true); else setLoading(true);
    setError("");
    failedCursor.current = next;
    try {
      const response = await api.get<OrderPage>("/orders", { signal: controller.signal, params: { limit: view === "overview" ? 5 : 20, ...(next ? { cursor: next } : {}) } });
      if (controller.signal.aborted) return;
      setOrders((current) => next ? [...current, ...response.data.items.filter((item) => !current.some((existing) => existing.id === item.id))] : response.data.items);
      setCursor(response.data.nextCursor);
    } catch {
      if (!controller.signal.aborted) setError(c.error);
    } finally {
      if (!controller.signal.aborted) { setLoading(false); setLoadingMore(false); }
    }
  }, [c.error, view]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => void load());
    return () => { cancelAnimationFrame(frame); request.current?.abort(); };
  }, [load]);

  const normalizedQuery = query.trim().toLocaleLowerCase(locale);
  const visibleOrders = orders.filter((order) => {
    const matchesQuery = `${order.id} ${order.seller.shopName} ${order.items.map((item) => item.productTitle).join(" ")}`.toLocaleLowerCase(locale).includes(normalizedQuery);
    const matchesFilter = filter === "all" || (filter === "active" && ACTIVE_STATUSES.has(order.status)) || (filter === "complete" && order.status === "delivered") || (filter === "closed" && ["cancelled", "refunded"].includes(order.status));
    return matchesQuery && matchesFilter;
  });
  function clearFilters() { setQuery(""); setFilter("all"); }

  return <section className={styles.orders} aria-labelledby="account-orders" aria-busy={loading || loadingMore}>
    <header className={styles.sectionHeading}><div><span className={styles.sectionIcon}><AccountIcon name="orders" /></span><h2 id="account-orders">{view === "overview" ? c.recent : c.history}</h2></div>{view === "overview" ? <Link href={`/${locale}/account/orders` as Route}>{c.allOrders}<AccountIcon name="arrow" /></Link> : null}</header>
    {view === "orders" ? <div className={styles.controls}>
      <label className={styles.search}><AccountIcon name="search" /><span className="sr-only">{w.search}</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={w.searchHint} aria-describedby="order-filter-hint" /></label>
      <div className={styles.filters} role="group" aria-label={w.status}>{(["all", "active", "complete", "closed"] as const).map((value) => <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)}>{w[value]}</button>)}</div>
      <p id="order-filter-hint" className={styles.filterHint}>{w.loadedHint}</p>
    </div> : null}
    {loading && !orders.length ? <div className={styles.skeletons} role="status"><span className="sr-only">{c.loading}</span>{[0, 1, 2].map((item) => <div className={styles.skeleton} key={item} aria-hidden="true"><span /><div><span /><span /></div><span /></div>)}</div> : null}
    {error ? <div className={styles.notice} role="alert"><p>{error}</p><button type="button" disabled={loading || loadingMore} onClick={() => void load(failedCursor.current)}>{c.retry}</button></div> : null}
    {!loading && !error && !orders.length ? <div className={styles.empty}><span className={styles.emptyIcon}><AccountIcon name="orders" /></span><h3>{c.empty}</h3><p>{c.emptyHint}</p><Link href={`/${locale}/products` as Route}>{c.browse}<AccountIcon name="arrow" /></Link></div> : null}
    {!loading && orders.length > 0 && !visibleOrders.length ? <div className={styles.empty}><span className={styles.emptyIcon}><AccountIcon name="search" /></span><h3>{w.noMatch}</h3><p>{w.noMatchHint}</p><button type="button" onClick={clearFilters}>{w.clear}</button></div> : null}
    {visibleOrders.length > 0 ? <div className={styles.list}>
      <div className={styles.tableHeading} aria-hidden="true"><span>{w.products}</span><span>{w.status}</span><span>{w.amount}</span><span /></div>
      {visibleOrders.map((order) => <article className={styles.order} key={order.id}>
        <div className={styles.orderRow}>
          <div className={styles.orderProduct}><span className={styles.productIcon}><AccountIcon name={order.items.every((item) => item.productType === "digital") ? "file" : "orders"} /></span><div><h3><Link href={`/${locale}/orders/${order.id}` as Route}>{order.items[0]?.productTitle ?? w.order}{order.items.length > 1 ? <span className={styles.extraItems}> +{(order.items.length - 1).toLocaleString(locale)}</span> : null}</Link></h3><p><bdi>{order.seller.shopName}</bdi><span aria-hidden="true"> · </span><time dateTime={order.createdAt}>{new Date(order.createdAt).toLocaleDateString(locale, { month: "short", day: "numeric", year: "numeric" })}</time></p></div></div>
          <span className={styles.status} data-status={order.status}><span />{c.status[order.status as keyof typeof c.status] ?? order.status}</span>
          <strong className={styles.amount}>{formatCurrencyAmount(order.totalAmount, order.currency, locale)}<small>{currencyLabel(order.currency)}</small></strong>
          <Link className={styles.orderLink} href={`/${locale}/orders/${order.id}` as Route} aria-label={`${c.details}: ${order.items[0]?.productTitle ?? order.id}`}><AccountIcon name="arrow" /></Link>
        </div>
        <details className={styles.orderDetails}><summary><span>{w.expand}<AccountIcon name="chevron" /></span><bdi>#{order.id.slice(-8)}</bdi></summary><ul>{order.items.map((item) => <li key={item.id}><span>{item.productTitle}</span><span>{w.quantity}: {item.quantity.toLocaleString(locale)}</span></li>)}</ul><Link href={`/${locale}/orders/${order.id}` as Route}>{c.details}<AccountIcon name="arrow" /></Link></details>
      </article>)}
    </div> : null}
    {view === "orders" && cursor && !loading ? <div className={styles.loadMore}><button type="button" disabled={loadingMore} onClick={() => void load(cursor)}>{loadingMore ? c.loading : c.more}<AccountIcon name="chevron" /></button></div> : null}
  </section>;
}
