"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { api } from "@/lib/api/client";
import { currencyLabel, formatCurrencyAmount } from "@/lib/currency";
import type { Locale } from "@/lib/i18n";
import { CollapsibleFilters } from "@/components/dashboard/CollapsibleFilters";
import styles from "./SellerOrders.module.css";

type BridgeDetails = { id: string; status: string; errorCode: string | null; input: { fields?: Record<string, string> } | null };
type SellerOrder = {
  id: string; status: string; currency: string; totalAmount: string; createdAt: string; trafficSource?: string | null;
  buyer?: { fullName: string; email: string; phoneNumber: string | null };
  shippingAddress?: { recipientName: string; phoneNumber: string; province: string; city: string; postalCode: string; addressLine: string } | null;
  shipment?: { carrier: string | null; trackingCode: string | null } | null;
  shippingDispatch?: { externalOrderId: number; provider: string; status: string; providerTrackingCode: string | null; courierTrackingCode: string | null; courierTitle: string | null; errorCode: string | null } | null;
  items: Array<{ offerId: string; productTitle: string; productType: string; quantity: number; serviceNote?: string | null; serviceInputs?: Array<{ key: string; label: string; value: string | null; sensitive: boolean }>; bridge?: BridgeDetails }>;
};
type BridgeOrderAction = { id: string; mayRetry: boolean };
type Filters = { search: string; status: string; productType: string; dateFrom: string; dateTo: string; sort: string };

const initialFilters: Filters = { search: "", status: "", productType: "", dateFrom: "", dateTo: "", sort: "newest" };
const statusKeys = ["pending", "paid", "processing", "shipped", "awaiting_confirmation", "delivered", "cancelled"] as const;
const typeKeys = ["digital", "physical", "service", "bridge"] as const;
const COPY = {
  en: { title: "Orders", intro: "Search, review, and fulfill your customer orders.", search: "Search orders", searchHint: "At least 3 characters: ID, buyer, product, or source", shortSearch: "Enter at least 3 characters to search.", status: "Status", type: "Product type", from: "From date", to: "To date", sort: "Sort", newest: "Newest first", oldest: "Oldest first", all: "All", filters: "filters", clear: "Clear filters", refresh: "Refresh", order: "Order", customer: "Customer", items: "Items", amount: "Total", date: "Placed", details: "Details", close: "Close", source: "Source", delivery: "Delivery address", noDelivery: "No delivery address", fulfilment: "Fulfillment", empty: "No orders match these filters.", loading: "Loading orders…", error: "Orders could not be loaded. Try again.", actionError: "The order action failed.", previous: "Previous", next: "Next", page: "Page", showing: "Showing", of: "orders", pending: "Pending", paid: "Paid", processing: "Processing", shipped: "Shipped", awaiting_confirmation: "Awaiting confirmation", delivered: "Delivered", cancelled: "Cancelled", digital: "Digital", physical: "Physical", service: "Service", bridge: "Bridge", result: "Delivery result", complete: "Publish result", retry: "Retry once", process: "Start processing", ready: "Ready for confirmation", ship: "Mark shipped manually", amadast: "Send with Amadast", amadastSync: "Refresh Amadast tracking", carrier: "Carrier", tracking: "Tracking code", noTracking: "No tracking yet" },
  fa: { title: "سفارش‌ها", intro: "سفارش‌های مشتریان خود را جستجو، بررسی و پردازش کنید.", search: "جستجوی سفارش", searchHint: "حداقل ۳ نویسه: شناسه، خریدار، محصول یا منبع", shortSearch: "برای جستجو دست‌کم ۳ نویسه وارد کنید.", status: "وضعیت", type: "نوع محصول", from: "از تاریخ", to: "تا تاریخ", sort: "مرتب‌سازی", newest: "جدیدترین", oldest: "قدیمی‌ترین", all: "همه", filters: "فیلتر فعال", clear: "پاک کردن فیلترها", refresh: "تازه‌سازی", order: "سفارش", customer: "خریدار", items: "اقلام", amount: "مبلغ کل", date: "تاریخ ثبت", details: "جزئیات", close: "بستن", source: "منبع ورود", delivery: "نشانی تحویل", noDelivery: "نشانی تحویل ثبت نشده", fulfilment: "پردازش سفارش", empty: "سفارشی با این فیلترها پیدا نشد.", loading: "در حال بارگذاری سفارش‌ها…", error: "بارگذاری سفارش‌ها انجام نشد. دوباره تلاش کنید.", actionError: "عملیات سفارش انجام نشد.", previous: "قبلی", next: "بعدی", page: "صفحه", showing: "نمایش", of: "سفارش", pending: "در انتظار", paid: "پرداخت‌شده", processing: "در حال پردازش", shipped: "ارسال‌شده", awaiting_confirmation: "در انتظار تأیید", delivered: "تحویل‌شده", cancelled: "لغوشده", digital: "دیجیتال", physical: "فیزیکی", service: "خدمت", bridge: "بریج", result: "نتیجه تحویل", complete: "ثبت نتیجه", retry: "یک تلاش دوباره", process: "شروع پردازش", ready: "آماده تأیید مشتری", ship: "ثبت ارسال دستی", amadast: "ارسال با آمادست", amadastSync: "دریافت کد رهگیری آمادست", carrier: "شرکت حمل", tracking: "کد رهگیری", noTracking: "هنوز کد رهگیری ندارد" },
  ar: { title: "الطلبات", intro: "ابحث في طلبات عملائك وراجعها ونفّذها.", search: "بحث الطلبات", searchHint: "٣ أحرف على الأقل: رقم الطلب أو المشتري أو المنتج أو المصدر", shortSearch: "أدخل ٣ أحرف على الأقل للبحث.", status: "الحالة", type: "نوع المنتج", from: "من تاريخ", to: "إلى تاريخ", sort: "الترتيب", newest: "الأحدث أولاً", oldest: "الأقدم أولاً", all: "الكل", filters: "مرشحات", clear: "مسح المرشحات", refresh: "تحديث", order: "الطلب", customer: "المشتري", items: "العناصر", amount: "الإجمالي", date: "تاريخ الطلب", details: "التفاصيل", close: "إغلاق", source: "المصدر", delivery: "عنوان التسليم", noDelivery: "لا يوجد عنوان للتسليم", fulfilment: "تنفيذ الطلب", empty: "لا توجد طلبات تطابق هذه المرشحات.", loading: "جارٍ تحميل الطلبات…", error: "تعذر تحميل الطلبات. حاول مرة أخرى.", actionError: "تعذر تنفيذ إجراء الطلب.", previous: "السابق", next: "التالي", page: "صفحة", showing: "عرض", of: "طلبات", pending: "معلق", paid: "مدفوع", processing: "قيد المعالجة", shipped: "تم الشحن", awaiting_confirmation: "بانتظار التأكيد", delivered: "تم التسليم", cancelled: "ملغى", digital: "رقمي", physical: "مادي", service: "خدمة", bridge: "بريدج", result: "نتيجة التسليم", complete: "نشر النتيجة", retry: "إعادة المحاولة", process: "بدء المعالجة", ready: "جاهز لتأكيد العميل", ship: "تسجيل الشحن يدوياً", amadast: "الشحن عبر Amadast", amadastSync: "تحديث تتبع Amadast", carrier: "شركة الشحن", tracking: "رقم التتبع", noTracking: "لا يوجد رقم تتبع بعد" }
} as const;
const SOURCE_COPY = { en: { direct: "Direct", unknown: "Unknown" }, fa: { direct: "مستقیم", unknown: "نامشخص" }, ar: { direct: "مباشر", unknown: "غير معروف" } } as const;

function displaySource(source: string | null | undefined, locale: Locale) {
  if (!source) return SOURCE_COPY[locale].unknown;
  if (source === "direct") return SOURCE_COPY[locale].direct;
  if (source === "google") return "Google";
  if (source === "bing") return "Bing";
  return source;
}

function providerActionLabel(locale: Locale, action: "register" | "sync", providerName: string) {
  if (locale === "fa") return action === "sync" ? `دریافت رهگیری ${providerName}` : `ارسال با ${providerName}`;
  if (locale === "ar") return action === "sync" ? `تحديث تتبع ${providerName}` : `الشحن عبر ${providerName}`;
  return action === "sync" ? `Refresh ${providerName} tracking` : `Send with ${providerName}`;
}

export function SellerOrders({ locale, onOrderUpdated }: { locale: Locale; onOrderUpdated?: () => void | Promise<void> }) {
  const c = COPY[locale];
  const [draft, setDraft] = useState(initialFilters);
  const [filters, setFilters] = useState(initialFilters);
  const [page, setPage] = useState(0);
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const [orders, setOrders] = useState<SellerOrder[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [bridgeActions, setBridgeActions] = useState<BridgeOrderAction[]>([]);
  const [results, setResults] = useState<Record<string, string>>({});
  const [shipping, setShipping] = useState<Record<string, { carrier: string; trackingCode: string }>>({});
  const [shippingProvider, setShippingProvider] = useState<{ code: string; name: string; enabled: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const requestId = useRef(0);
  const retryable = useMemo(() => new Set(bridgeActions.filter((item) => item.mayRetry).map((item) => item.id)), [bridgeActions]);

  const load = useCallback(async (cursor: string | null, active: Filters) => {
    const id = ++requestId.current;
    setLoading(true); setError("");
    try {
      const response = await api.get<{ items: SellerOrder[]; nextCursor: string | null; shippingProvider: { code: string; name: string; enabled: boolean } | null }>("/orders", { params: {
        limit: 20, ...(cursor ? { cursor } : {}), ...(active.search ? { search: active.search } : {}),
        ...(active.status ? { status: active.status } : {}), ...(active.productType ? { productType: active.productType } : {}),
        ...(active.dateFrom ? { dateFrom: active.dateFrom } : {}), ...(active.dateTo ? { dateTo: active.dateTo } : {}), sort: active.sort
      } });
      if (id !== requestId.current) return;
      setOrders(response.data.items); setNextCursor(response.data.nextCursor);
      setShippingProvider(response.data.shippingProvider);
      setExpanded((current) => current && response.data.items.some((order) => order.id === current) ? current : null);
      if (process.env.NEXT_PUBLIC_BRIDGE_FEATURE_ENABLED === "true") {
        const bridgeResponse = await api.get<BridgeOrderAction[]>("/bridge/orders");
        if (id === requestId.current) setBridgeActions(bridgeResponse.data);
      } else setBridgeActions([]);
    } catch { if (id === requestId.current) setError(c.error); }
    finally { if (id === requestId.current) setLoading(false); }
  }, [c.error]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if ((draft.dateFrom && draft.dateTo && draft.dateFrom > draft.dateTo) || (draft.search.trim().length > 0 && draft.search.trim().length < 3)) return;
      setFilters({ ...draft, search: draft.search.trim() }); setPage(0); setCursors([null]);
    }, 300);
    return () => clearTimeout(timer);
  }, [draft]);
  useEffect(() => { void load(cursors[page] ?? null, filters); }, [cursors, filters, load, page]);

  function setFilter<K extends keyof Filters>(key: K, value: Filters[K]) { setDraft((current) => ({ ...current, [key]: value })); }
  function goNext() { if (!nextCursor) return; setCursors((current) => [...current.slice(0, page + 1), nextCursor]); setPage((current) => current + 1); }
  async function reloadPage() { await load(cursors[page] ?? null, filters); }
  async function bridgeAction(id: string, action: "complete" | "retry") {
    setBusy(`${id}:${action}`); setError("");
    try { if (action === "complete") await api.post(`/bridge/orders/${id}/complete`, { result: results[id] ?? "" }); else await api.post(`/bridge/orders/${id}/retry`); await reloadPage(); }
    catch { setError(c.actionError); } finally { setBusy(""); }
  }
  async function transition(orderId: string, status: "processing" | "awaiting_confirmation") {
    setBusy(orderId); setError("");
    try { await api.patch(`/orders/${orderId}/status`, { status }, { headers: { "Idempotency-Key": crypto.randomUUID() } }); await Promise.all([reloadPage(), onOrderUpdated?.()]); }
    catch { setError(c.actionError); } finally { setBusy(""); }
  }
  async function ship(orderId: string) {
    setBusy(orderId); setError("");
    try { await api.patch(`/orders/${orderId}/shipping`, shipping[orderId] ?? {}, { headers: { "Idempotency-Key": crypto.randomUUID() } }); await reloadPage(); }
    catch { setError(c.actionError); } finally { setBusy(""); }
  }
  async function providerShipping(orderId: string, action: "register" | "sync") {
    setBusy(orderId); setError("");
    try { await api.post(`/orders/${orderId}/shipping/${action}`, {}, { headers: { "Idempotency-Key": crypto.randomUUID() } }); await reloadPage(); }
    catch { setError(c.actionError); } finally { setBusy(""); }
  }

  const invalidRange = Boolean(draft.dateFrom && draft.dateTo && draft.dateFrom > draft.dateTo);
  const shortSearch = draft.search.trim().length > 0 && draft.search.trim().length < 3;
  const activeCount = [filters.search, filters.status, filters.productType, filters.dateFrom, filters.dateTo].filter(Boolean).length;

  return <section className={styles.workspace} aria-labelledby="seller-orders-title">
    <header className={styles.header}><div><p className={styles.eyebrow}>TopGSM / {c.title}</p><h1 id="seller-orders-title">{c.title}</h1><p>{c.intro}</p></div><button type="button" className={styles.secondary} onClick={() => void reloadPage()} disabled={loading}>{c.refresh}</button></header>
    <CollapsibleFilters className={styles.controls} surface={false} locale={locale} title={c.search} description={c.searchHint} activeCount={activeCount}>
      <label className={styles.searchField}><span>{c.search}</span><input type="search" value={draft.search} onChange={(event) => setFilter("search", event.target.value)} placeholder={c.searchHint} maxLength={100} /></label>
      <div className={styles.filterGrid}>
        <label><span>{c.status}</span><select value={draft.status} onChange={(event) => setFilter("status", event.target.value)}><option value="">{c.all}</option>{statusKeys.map((key) => <option value={key} key={key}>{c[key]}</option>)}</select></label>
        <label><span>{c.type}</span><select value={draft.productType} onChange={(event) => setFilter("productType", event.target.value)}><option value="">{c.all}</option>{typeKeys.map((key) => <option value={key} key={key}>{c[key]}</option>)}</select></label>
        <label><span>{c.from}</span><input type="date" value={draft.dateFrom} onChange={(event) => setFilter("dateFrom", event.target.value)} /></label>
        <label><span>{c.to}</span><input type="date" min={draft.dateFrom || undefined} value={draft.dateTo} onChange={(event) => setFilter("dateTo", event.target.value)} /></label>
        <label><span>{c.sort}</span><select value={draft.sort} onChange={(event) => setFilter("sort", event.target.value)}><option value="newest">{c.newest}</option><option value="oldest">{c.oldest}</option></select></label>
      </div>
      <div className={styles.filterFooter}><span>{activeCount ? `${activeCount.toLocaleString(locale)} ${c.filters}` : c.all} · {c.showing} {orders.length.toLocaleString(locale)} {c.of}</span><button type="button" className={styles.clear} disabled={!activeCount && draft.sort === "newest"} onClick={() => setDraft(initialFilters)}>{c.clear}</button></div>
    </CollapsibleFilters>
    {invalidRange ? <p className={styles.notice} role="alert">{c.from} ≤ {c.to}</p> : null}
    {shortSearch ? <p className={styles.notice} role="status">{c.shortSearch}</p> : null}
    {error ? <p className={styles.notice} role="alert">{error} <button type="button" onClick={() => void reloadPage()}>{c.refresh}</button></p> : null}
    <div className={styles.tableWrap} aria-busy={loading}>
      <table><thead><tr><th scope="col">{c.order}</th><th scope="col">{c.customer}</th><th scope="col">{c.source}</th><th scope="col">{c.items}</th><th scope="col">{c.amount}</th><th scope="col">{c.status}</th><th scope="col">{c.date}</th><th scope="col"><span className={styles.srOnly}>{c.details}</span></th></tr></thead>
      <tbody>{orders.map((order) => {
        const count = order.items.reduce((total, item) => total + item.quantity, 0);
        const isExpanded = expanded === order.id;
        return <Fragment key={order.id}><tr className={styles.orderRow}>
          <td data-label={c.order}><strong dir="ltr">#{order.id.slice(0, 8)}</strong></td>
          <td data-label={c.customer}><strong>{order.buyer?.fullName ?? "—"}</strong><small dir="ltr">{order.buyer?.phoneNumber ?? order.buyer?.email ?? "—"}</small></td>
          <td data-label={c.source}>{displaySource(order.trafficSource, locale)}</td>
          <td data-label={c.items}>{count.toLocaleString(locale)} · {order.items[0]?.productTitle ?? "—"}{order.items.length > 1 ? ` +${order.items.length - 1}` : ""}</td>
          <td data-label={c.amount}><strong dir="ltr">{formatCurrencyAmount(order.totalAmount, order.currency, locale)} {currencyLabel(order.currency)}</strong></td>
          <td data-label={c.status}><span className={styles.badge} data-status={order.status}>{c[order.status as keyof typeof c] ?? order.status}</span></td>
          <td data-label={c.date}><time dateTime={order.createdAt}>{new Date(order.createdAt).toLocaleDateString(locale, { year: "numeric", month: "short", day: "numeric" })}</time></td>
          <td><button className={styles.detailsButton} type="button" aria-expanded={isExpanded} aria-controls={`seller-order-${order.id}`} onClick={() => setExpanded(isExpanded ? null : order.id)}>{isExpanded ? c.close : c.details}</button></td>
        </tr>{isExpanded ? <tr className={styles.detailRow}><td colSpan={8}><OrderDetails order={order} locale={locale} c={c} retryable={retryable} results={results} shipping={shipping} shippingProvider={shippingProvider} busy={busy} setResults={setResults} setShipping={setShipping} bridgeAction={bridgeAction} transition={transition} ship={ship} providerShipping={providerShipping} /></td></tr> : null}</Fragment>;
      })}</tbody></table>
      {loading ? <p className={styles.state} role="status">{c.loading}</p> : !error && orders.length === 0 ? <p className={styles.state}>{c.empty}</p> : null}
    </div>
    <nav className={styles.pagination} aria-label={c.page}><span>{c.page} {(page + 1).toLocaleString(locale)}</span><div><button type="button" className={styles.secondary} disabled={page === 0 || loading} onClick={() => setPage((current) => current - 1)}>{c.previous}</button><button type="button" className={styles.secondary} disabled={!nextCursor || loading} onClick={goNext}>{c.next}</button></div></nav>
  </section>;
}

type OrderDetailsProps = {
  order: SellerOrder; locale: Locale; c: typeof COPY[Locale]; retryable: Set<string>; results: Record<string, string>; shipping: Record<string, { carrier: string; trackingCode: string }>; shippingProvider: { code: string; name: string; enabled: boolean } | null; busy: string;
  setResults: Dispatch<SetStateAction<Record<string, string>>>; setShipping: Dispatch<SetStateAction<Record<string, { carrier: string; trackingCode: string }>>>;
  bridgeAction: (id: string, action: "complete" | "retry") => Promise<void>; transition: (id: string, status: "processing" | "awaiting_confirmation") => Promise<void>; ship: (id: string) => Promise<void>; providerShipping: (id: string, action: "register" | "sync") => Promise<void>;
};

function OrderDetails({ order, locale, c, retryable, results, shipping, shippingProvider, busy, setResults, setShipping, bridgeAction, transition, ship, providerShipping }: OrderDetailsProps) {
  const hasBridge = order.items.some((item) => item.productType === "bridge");
  const allPhysical = order.items.every((item) => item.productType === "physical");
  const providerAction = order.shippingDispatch?.status === "registered" || order.shippingDispatch?.status === "tracking_available" ? "sync" : "register";
  return <section className={styles.detailPanel} id={`seller-order-${order.id}`} aria-label={`${c.details} #${order.id}`}>
    <div className={styles.detailGrid}>
      <section><h3>{c.delivery}</h3>{order.shippingAddress ? <address>{order.shippingAddress.recipientName}<br />{order.shippingAddress.province}، {order.shippingAddress.city}، {order.shippingAddress.addressLine}<br /><span dir="ltr">{order.shippingAddress.phoneNumber} · {order.shippingAddress.postalCode}</span></address> : <p>{c.noDelivery}</p>}</section>
      <section><h3>{c.items}</h3><ul className={styles.itemList}>{order.items.map((item) => <li key={item.offerId}><strong>{item.productTitle}</strong><span>{item.quantity.toLocaleString(locale)} × {c[item.productType as keyof typeof c] ?? item.productType}</span>{item.serviceNote ? <small>{item.serviceNote}</small> : null}{item.serviceInputs?.length ? <dl className={styles.serviceAnswers}>{item.serviceInputs.map((field) => <div key={field.key}><dt>{field.label}</dt><dd>{field.value ?? "—"}</dd></div>)}</dl> : null}</li>)}</ul></section>
      <section><h3>{c.tracking}</h3><p>{order.shippingDispatch?.courierTrackingCode ?? order.shippingDispatch?.providerTrackingCode ?? order.shipment?.trackingCode ?? c.noTracking}</p>{order.shippingDispatch?.courierTitle || order.shipment?.carrier ? <small>{order.shippingDispatch?.courierTitle ?? order.shipment?.carrier}</small> : null}</section>
    </div>
    {order.items.map((item) => item.bridge ? <section className={styles.fulfilment} key={item.bridge.id}><header><div><h3>{item.productTitle}</h3><p>{c.fulfilment}</p></div><span className={styles.badge} data-status={item.bridge.status}>{item.bridge.status}</span></header>{Object.keys(item.bridge.input?.fields ?? {}).length ? <dl className={styles.bridgeFields}>{Object.entries(item.bridge.input?.fields ?? {}).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl> : null}{["manual_required", "failed"].includes(item.bridge.status) ? <div className={styles.actionForm}><label><span>{c.result}</span><textarea value={results[item.bridge.id] ?? ""} onChange={(event) => setResults((current) => ({ ...current, [item.bridge!.id]: event.target.value }))} maxLength={10000} /><small>{item.bridge.errorCode ?? " "}</small></label><div className={styles.actions}><button className={styles.primary} type="button" disabled={!results[item.bridge.id]?.trim() || Boolean(busy)} onClick={() => void bridgeAction(item.bridge!.id, "complete")}>{c.complete}</button>{retryable.has(item.bridge.id) ? <button className={styles.secondary} type="button" disabled={Boolean(busy)} onClick={() => void bridgeAction(item.bridge!.id, "retry")}>{c.retry}</button> : null}</div></div> : null}</section> : null)}
    {!hasBridge ? <section className={styles.fulfilment}>
      <header><div><h3>{c.fulfilment}</h3><p>{c[order.status as keyof typeof c] ?? order.status}</p></div></header>
      <div className={styles.actions}>
        {order.status === "paid" ? <button className={styles.primary} type="button" disabled={Boolean(busy)} onClick={() => void transition(order.id, "processing")}>{c.process}</button> : null}
        {order.status === "processing" && allPhysical ? <>
          <input aria-label={c.carrier} placeholder={c.carrier} value={shipping[order.id]?.carrier ?? ""} onChange={(event) => setShipping((current) => ({ ...current, [order.id]: { carrier: event.target.value, trackingCode: current[order.id]?.trackingCode ?? "" } }))} />
          <input aria-label={c.tracking} placeholder={c.tracking} value={shipping[order.id]?.trackingCode ?? ""} onChange={(event) => setShipping((current) => ({ ...current, [order.id]: { carrier: current[order.id]?.carrier ?? "", trackingCode: event.target.value } }))} />
          <button className={styles.primary} type="button" disabled={Boolean(busy) || (!shipping[order.id]?.carrier.trim() && !shipping[order.id]?.trackingCode.trim())} onClick={() => void ship(order.id)}>{c.ship}</button>
          {shippingProvider?.enabled ? <button className={styles.secondary} type="button" disabled={Boolean(busy)} onClick={() => void providerShipping(order.id, providerAction)}>{providerActionLabel(locale, providerAction, shippingProvider.name)}</button> : null}
          {order.shippingDispatch?.errorCode ? <small className={styles.actionError}>{order.shippingDispatch.errorCode}</small> : null}
        </> : null}
        {order.status === "processing" && !allPhysical ? <button className={styles.primary} type="button" disabled={Boolean(busy)} onClick={() => void transition(order.id, "awaiting_confirmation")}>{c.ready}</button> : null}
      </div>
    </section> : null}
  </section>;
}
