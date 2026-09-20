"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { api } from "@/lib/api/client";
import { currencyLabel, formatCurrencyAmount } from "@/lib/currency";
import type { Locale } from "@/lib/i18n";
import styles from "./AdminOrdersWorkspace.module.css";

type Order = {
  id: string; status: string; currency: string; totalAmount: string; createdAt: string;
  trafficSource: string | null; seller: { shopName: string };
  buyer: { fullName: string; email: string; phoneNumber: string | null };
  shippingAddress: { recipientName: string; province: string; city: string; addressLine: string; postalCode: string } | null;
  shipment: { carrier: string | null; trackingCode: string | null } | null;
  items: { id: string; productTitle: string; productType: string; quantity: number }[];
};
type Filters = { search: string; status: string; productType: string; dateFrom: string; dateTo: string; sort: string };
const initialFilters: Filters = { search: "", status: "", productType: "", dateFrom: "", dateTo: "", sort: "newest" };
const statusKeys = ["pending", "paid", "processing", "shipped", "awaiting_confirmation", "delivered", "cancelled"] as const;
const typeKeys = ["digital", "physical", "service", "bridge"] as const;
const COPY = {
  en: { title: "Orders", intro: "Search and review orders across the platform.", search: "Search orders", searchHint: "At least 3 characters: ID, buyer, seller, product, or source", shortSearch: "Enter at least 3 characters to search.", status: "Status", type: "Product type", from: "From date", to: "To date", sort: "Sort", newest: "Newest first", oldest: "Oldest first", all: "All", filters: "filters", clear: "Clear filters", refresh: "Refresh", order: "Order", customer: "Customer", seller: "Seller", items: "Items", amount: "Total", date: "Placed", details: "Details", close: "Close", source: "Source", delivery: "Delivery", tracking: "Tracking", noTracking: "No tracking yet", empty: "No orders match these filters.", loading: "Loading orders…", error: "Orders could not be loaded. Try again.", previous: "Previous", next: "Next", page: "Page", showing: "Showing", of: "orders", pending: "Pending", paid: "Paid", processing: "Processing", shipped: "Shipped", awaiting_confirmation: "Awaiting confirmation", delivered: "Delivered", cancelled: "Cancelled", digital: "Digital", physical: "Physical", service: "Service", bridge: "Bridge" },
  fa: { title: "سفارش‌ها", intro: "سفارش‌های سراسر پلتفرم را جستجو و بررسی کنید.", search: "جستجوی سفارش", searchHint: "حداقل ۳ نویسه: شناسه، خریدار، فروشنده، محصول یا منبع", shortSearch: "برای جستجو دست‌کم ۳ نویسه وارد کنید.", status: "وضعیت", type: "نوع محصول", from: "از تاریخ", to: "تا تاریخ", sort: "مرتب‌سازی", newest: "جدیدترین", oldest: "قدیمی‌ترین", all: "همه", filters: "فیلتر فعال", clear: "پاک کردن فیلترها", refresh: "تازه‌سازی", order: "سفارش", customer: "خریدار", seller: "فروشنده", items: "اقلام", amount: "مبلغ کل", date: "تاریخ ثبت", details: "جزئیات", close: "بستن", source: "منبع ورود", delivery: "نشانی تحویل", tracking: "رهگیری", noTracking: "هنوز کد رهگیری ندارد", empty: "سفارشی با این فیلترها پیدا نشد.", loading: "در حال بارگذاری سفارش‌ها…", error: "بارگذاری سفارش‌ها انجام نشد. دوباره تلاش کنید.", previous: "قبلی", next: "بعدی", page: "صفحه", showing: "نمایش", of: "سفارش", pending: "در انتظار", paid: "پرداخت‌شده", processing: "در حال پردازش", shipped: "ارسال‌شده", awaiting_confirmation: "در انتظار تأیید", delivered: "تحویل‌شده", cancelled: "لغوشده", digital: "دیجیتال", physical: "فیزیکی", service: "خدمت", bridge: "بریج" },
  ar: { title: "الطلبات", intro: "ابحث في الطلبات عبر المنصة وراجعها.", search: "بحث الطلبات", searchHint: "٣ أحرف على الأقل: رقم الطلب أو المشتري أو البائع أو المنتج أو المصدر", shortSearch: "أدخل ٣ أحرف على الأقل للبحث.", status: "الحالة", type: "نوع المنتج", from: "من تاريخ", to: "إلى تاريخ", sort: "الترتيب", newest: "الأحدث أولاً", oldest: "الأقدم أولاً", all: "الكل", filters: "مرشحات", clear: "مسح المرشحات", refresh: "تحديث", order: "الطلب", customer: "المشتري", seller: "البائع", items: "العناصر", amount: "الإجمالي", date: "تاريخ الطلب", details: "التفاصيل", close: "إغلاق", source: "المصدر", delivery: "عنوان التسليم", tracking: "التتبع", noTracking: "لا يوجد رقم تتبع بعد", empty: "لا توجد طلبات تطابق هذه المرشحات.", loading: "جارٍ تحميل الطلبات…", error: "تعذر تحميل الطلبات. حاول مرة أخرى.", previous: "السابق", next: "التالي", page: "صفحة", showing: "عرض", of: "طلبات", pending: "معلق", paid: "مدفوع", processing: "قيد المعالجة", shipped: "تم الشحن", awaiting_confirmation: "بانتظار التأكيد", delivered: "تم التسليم", cancelled: "ملغى", digital: "رقمي", physical: "مادي", service: "خدمة", bridge: "بريدج" }
} as const;

export function AdminOrdersWorkspace({ locale }: { locale: Locale }) {
  const c = COPY[locale];
  const [draft, setDraft] = useState(initialFilters);
  const [filters, setFilters] = useState(initialFilters);
  const [page, setPage] = useState(0);
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const requestId = useRef(0);

  const load = useCallback(async (cursor: string | null, active: Filters) => {
    const id = ++requestId.current;
    setLoading(true); setError("");
    try {
      const response = await api.get<{ items: Order[]; nextCursor: string | null }>("/orders", { params: {
        limit: 20, view: "directory", ...(cursor ? { cursor } : {}),
        ...(active.search ? { search: active.search } : {}),
        ...(active.status ? { status: active.status } : {}),
        ...(active.productType ? { productType: active.productType } : {}),
        ...(active.dateFrom ? { dateFrom: active.dateFrom } : {}),
        ...(active.dateTo ? { dateTo: active.dateTo } : {}), sort: active.sort
      } });
      if (id !== requestId.current) return;
      setOrders(response.data.items); setNextCursor(response.data.nextCursor);
    } catch {
      if (id === requestId.current) setError(c.error);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [c.error]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if ((draft.dateFrom && draft.dateTo && draft.dateFrom > draft.dateTo) || (draft.search.trim().length > 0 && draft.search.trim().length < 3)) return;
      const next = { ...draft, search: draft.search.trim() };
      setFilters(next); setPage(0); setCursors([null]);
    }, 300);
    return () => clearTimeout(timer);
  }, [draft]);
  useEffect(() => { void load(cursors[page] ?? null, filters); }, [cursors, filters, load, page]);

  function setFilter<K extends keyof Filters>(key: K, value: Filters[K]) { setDraft((current) => ({ ...current, [key]: value })); }
  function goNext() { if (!nextCursor) return; setCursors((current) => [...current.slice(0, page + 1), nextCursor]); setPage((current) => current + 1); }
  const invalidRange = Boolean(draft.dateFrom && draft.dateTo && draft.dateFrom > draft.dateTo);
  const shortSearch = draft.search.trim().length > 0 && draft.search.trim().length < 3;
  const activeCount = [filters.search, filters.status, filters.productType, filters.dateFrom, filters.dateTo].filter(Boolean).length;

  return <section className={styles.workspace} aria-labelledby="admin-orders-title">
    <header className={styles.header}><div><p className={styles.eyebrow}>TopGSM / {c.title}</p><h1 id="admin-orders-title">{c.title}</h1><p>{c.intro}</p></div><button type="button" className={styles.secondary} onClick={() => void load(cursors[page] ?? null, filters)} disabled={loading}>{c.refresh}</button></header>
    <div className={styles.controls}>
      <label className={styles.searchField}><span>{c.search}</span><input type="search" value={draft.search} onChange={(event) => setFilter("search", event.target.value)} placeholder={c.searchHint} maxLength={100} /></label>
      <div className={styles.filterGrid}>
        <label><span>{c.status}</span><select value={draft.status} onChange={(event) => setFilter("status", event.target.value)}><option value="">{c.all}</option>{statusKeys.map((key) => <option value={key} key={key}>{c[key]}</option>)}</select></label>
        <label><span>{c.type}</span><select value={draft.productType} onChange={(event) => setFilter("productType", event.target.value)}><option value="">{c.all}</option>{typeKeys.map((key) => <option value={key} key={key}>{c[key]}</option>)}</select></label>
        <label><span>{c.from}</span><input type="date" value={draft.dateFrom} onChange={(event) => setFilter("dateFrom", event.target.value)} /></label>
        <label><span>{c.to}</span><input type="date" min={draft.dateFrom || undefined} value={draft.dateTo} onChange={(event) => setFilter("dateTo", event.target.value)} /></label>
        <label><span>{c.sort}</span><select value={draft.sort} onChange={(event) => setFilter("sort", event.target.value)}><option value="newest">{c.newest}</option><option value="oldest">{c.oldest}</option></select></label>
      </div>
      <div className={styles.filterFooter}><span>{activeCount ? `${activeCount.toLocaleString(locale)} ${c.filters}` : c.all} · {c.showing} {orders.length.toLocaleString(locale)} {c.of}</span><button type="button" className={styles.clear} disabled={!activeCount && draft.sort === "newest"} onClick={() => setDraft(initialFilters)}>{c.clear}</button></div>
    </div>
    {invalidRange ? <p className={styles.notice} role="alert">{c.from} ≤ {c.to}</p> : null}
    {shortSearch ? <p className={styles.notice} role="status">{c.shortSearch}</p> : null}
    {error ? <p className={styles.notice} role="alert">{error} <button type="button" onClick={() => void load(cursors[page] ?? null, filters)}>{c.refresh}</button></p> : null}
    <div className={styles.tableWrap} aria-busy={loading}>
      <table><thead><tr><th scope="col">{c.order}</th><th scope="col">{c.customer}</th><th scope="col">{c.source}</th><th scope="col">{c.seller}</th><th scope="col">{c.items}</th><th scope="col">{c.amount}</th><th scope="col">{c.status}</th><th scope="col">{c.date}</th><th scope="col"><span className={styles.srOnly}>{c.details}</span></th></tr></thead>
      <tbody>{orders.map((order) => <OrderRow key={order.id} order={order} locale={locale} c={c} />)}</tbody></table>
      {loading ? <p className={styles.state} role="status">{c.loading}</p> : !error && orders.length === 0 ? <p className={styles.state}>{c.empty}</p> : null}
    </div>
    <nav className={styles.pagination} aria-label={c.page}><span>{c.page} {(page + 1).toLocaleString(locale)}</span><div><button type="button" className={styles.secondary} disabled={page === 0 || loading} onClick={() => setPage((current) => current - 1)}>{c.previous}</button><button type="button" className={styles.secondary} disabled={!nextCursor || loading} onClick={goNext}>{c.next}</button></div></nav>
  </section>;
}

function OrderRow({ order, locale, c }: { order: Order; locale: Locale; c: typeof COPY[Locale] }) {
  const count = order.items.reduce((total, item) => total + item.quantity, 0);
  return <tr className={styles.orderRow}>
    <td data-label={c.order}><strong dir="ltr">#{order.id.slice(0, 8)}</strong></td>
    <td data-label={c.customer}><strong>{order.buyer.fullName}</strong><small dir="ltr">{order.buyer.email}</small></td>
    <td data-label={c.source}>{order.trafficSource || "—"}</td>
    <td data-label={c.seller}>{order.seller.shopName}</td>
    <td data-label={c.items}>{count.toLocaleString(locale)} · {order.items[0]?.productTitle ?? "—"}{order.items.length > 1 ? ` +${order.items.length - 1}` : ""}</td>
    <td data-label={c.amount}><strong dir="ltr">{formatCurrencyAmount(order.totalAmount, order.currency, locale)} {currencyLabel(order.currency)}</strong></td>
    <td data-label={c.status}><span className={styles.badge} data-status={order.status}>{c[order.status as keyof typeof c] ?? order.status}</span></td>
    <td data-label={c.date}><time dateTime={order.createdAt}>{new Date(order.createdAt).toLocaleDateString(locale, { year: "numeric", month: "short", day: "numeric" })}</time></td>
    <td><Link className={styles.detailsButton} aria-label={`${c.details} #${order.id}`} href={`/${locale}/admin/orders/${order.id}` as Route}>{c.details}</Link></td>
  </tr>;
}
