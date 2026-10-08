"use client";
import { scheduleEffectTask } from "@/lib/effect-task";
import { JalaliDatePicker } from "@/components/dashboard/JalaliDatePicker";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { api } from "@/lib/api/client";
import { currencyLabel, formatCurrencyAmount } from "@/lib/currency";
import type { Locale } from "@/lib/i18n";
import { CollapsibleFilters } from "@/components/dashboard/CollapsibleFilters";
import { paymentProviderLabel } from "./AdminOrderDetailsCopy";
import { RelativeOrderTime } from "@/components/orders/RelativeOrderTime";
import styles from "./AdminOrdersWorkspace.module.css";

type Order = {
  id: string; status: string; trashedAt: string | null; currency: string; totalAmount: string; createdAt: string;
  trafficSource: string | null; seller: { shopName: string };
  buyer: { fullName: string; email: string; phoneNumber: string | null };
  shippingAddress: { recipientName: string; province: string; city: string; addressLine: string; postalCode: string } | null;
  shipment: { carrier: string | null; trackingCode: string | null } | null;
  payment: { provider: string; reference: string | null } | null;
  items: { id: string; productTitle: string; productType: string; quantity: number }[];
};
const statusGroups = ["all", "pending", "processing", "completed", "cancelled", "returned", "other"] as const;
type StatusGroup = typeof statusGroups[number];
type StatusCounts = Record<StatusGroup, number>;
type Filters = { search: string; statusGroup: StatusGroup; trash: "active" | "trashed"; productType: string; dateFrom: string; dateTo: string; sort: string };
const initialFilters: Filters = { search: "", statusGroup: "all", trash: "active", productType: "", dateFrom: "", dateTo: "", sort: "newest" };
const typeKeys = ["digital", "physical", "service", "bridge"] as const;
const COPY = {
  en: { title: "Orders", intro: "Search and review orders across the platform.", search: "Search orders", searchHint: "At least 3 characters: ID, buyer, seller, product, or source", shortSearch: "Enter at least 3 characters to search.", status: "Status", type: "Product type", from: "From date", to: "To date", sort: "Sort", newest: "Newest first", oldest: "Oldest first", all: "All", filters: "filters", moreFilters: "More filters", clear: "Clear filters", refresh: "Refresh", order: "Order", customer: "Customer", seller: "Seller", items: "Items", amount: "Total", date: "Placed", details: "Details", close: "Close", source: "Source", delivery: "Delivery", tracking: "Tracking", noTracking: "No tracking yet", empty: "No orders match these filters.", loading: "Loading orders…", error: "Orders could not be loaded. Try again.", previous: "Previous", next: "Next", page: "Page", showing: "Showing", of: "orders", pending: "Pending", paid: "Paid", processing: "Processing", shipped: "Shipped", awaiting_confirmation: "Awaiting confirmation", delivered: "Delivered", cancelled: "Cancelled", digital: "Digital", physical: "Physical", service: "Service", bridge: "Bridge" },
  fa: { title: "سفارش‌ها", intro: "سفارش‌های سراسر پلتفرم را جستجو و بررسی کنید.", search: "جستجوی سفارش", searchHint: "حداقل ۳ نویسه: شناسه، خریدار، فروشنده، محصول یا منبع", shortSearch: "برای جستجو دست‌کم ۳ نویسه وارد کنید.", status: "وضعیت", type: "نوع محصول", from: "از تاریخ", to: "تا تاریخ", sort: "مرتب‌سازی", newest: "جدیدترین", oldest: "قدیمی‌ترین", all: "همه", filters: "فیلتر فعال", moreFilters: "فیلترهای بیشتر", clear: "پاک کردن فیلترها", refresh: "تازه‌سازی", order: "سفارش", customer: "خریدار", seller: "فروشنده", items: "اقلام", amount: "مبلغ کل", date: "تاریخ ثبت", details: "جزئیات", close: "بستن", source: "منبع ورود", delivery: "نشانی تحویل", tracking: "رهگیری", noTracking: "هنوز کد رهگیری ندارد", empty: "سفارشی با این فیلترها پیدا نشد.", loading: "در حال بارگذاری سفارش‌ها…", error: "بارگذاری سفارش‌ها انجام نشد. دوباره تلاش کنید.", previous: "قبلی", next: "بعدی", page: "صفحه", showing: "نمایش", of: "سفارش", pending: "در انتظار", paid: "پرداخت‌شده", processing: "در حال پردازش", shipped: "ارسال‌شده", awaiting_confirmation: "در انتظار تأیید", delivered: "تحویل‌شده", cancelled: "لغوشده", digital: "دیجیتال", physical: "فیزیکی", service: "خدمت", bridge: "بریج" },
  ar: { title: "الطلبات", intro: "ابحث في الطلبات عبر المنصة وراجعها.", search: "بحث الطلبات", searchHint: "٣ أحرف على الأقل: رقم الطلب أو المشتري أو البائع أو المنتج أو المصدر", shortSearch: "أدخل ٣ أحرف على الأقل للبحث.", status: "الحالة", type: "نوع المنتج", from: "من تاريخ", to: "إلى تاريخ", sort: "الترتيب", newest: "الأحدث أولاً", oldest: "الأقدم أولاً", all: "الكل", filters: "مرشحات", moreFilters: "مزيد من المرشحات", clear: "مسح المرشحات", refresh: "تحديث", order: "الطلب", customer: "المشتري", seller: "البائع", items: "العناصر", amount: "الإجمالي", date: "تاريخ الطلب", details: "التفاصيل", close: "إغلاق", source: "المصدر", delivery: "عنوان التسليم", tracking: "التتبع", noTracking: "لا يوجد رقم تتبع بعد", empty: "لا توجد طلبات تطابق هذه المرشحات.", loading: "جارٍ تحميل الطلبات…", error: "تعذر تحميل الطلبات. حاول مرة أخرى.", previous: "السابق", next: "التالي", page: "صفحة", showing: "عرض", of: "طلبات", pending: "معلق", paid: "مدفوع", processing: "قيد المعالجة", shipped: "تم الشحن", awaiting_confirmation: "بانتظار التأكيد", delivered: "تم التسليم", cancelled: "ملغى", digital: "رقمي", physical: "مادي", service: "خدمة", bridge: "بريدج" }
} as const;

const GROUP_COPY = {
  en: { all: "All", pending: "Pending", processing: "In progress", completed: "Completed", cancelled: "Cancelled", returned: "Returned", other: "Other statuses" },
  fa: { all: "همه", pending: "در انتظار", processing: "در حال انجام", completed: "تکمیل‌شده", cancelled: "لغوشده", returned: "مرجوعی", other: "سایر وضعیت‌ها" },
  ar: { all: "الكل", pending: "معلق", processing: "قيد التنفيذ", completed: "مكتمل", cancelled: "ملغى", returned: "مسترجع", other: "حالات أخرى" }
} as const;

const PAYMENT_COPY = {
  en: { by: "Paid via", reference: "Bank ref" },
  fa: { by: "پرداخت توسط", reference: "کد پیگیری بانک" },
  ar: { by: "دُفع عبر", reference: "مرجع البنك" }
} as const;

const EXPORT_COLUMNS = ["id", "createdAt", "status", "buyer", "buyerEmail", "buyerPhone", "seller", "items", "totalAmount", "currency", "paymentProvider", "paymentReference", "trafficSource"] as const;
type ExportColumn = typeof EXPORT_COLUMNS[number];
const DEFAULT_EXPORT_COLUMNS: ExportColumn[] = ["id", "createdAt", "status", "buyer", "seller", "items", "totalAmount", "currency"];
const EXPORT_COPY = {
  en: { action: "Export CSV", title: "Export orders", scope: "Orders to export", filtered: "All matching active filters", selected: "Selected orders", choosePage: "Select visible orders", selectedCount: "selected (up to 100)", columns: "Columns", dateNote: "Date ranges use Tehran calendar days and override the active date filters. Timestamps are UTC ISO 8601; amounts remain exact decimal values.", limit: "Maximum 5,000 orders per export. Narrow the filters or date range for larger results.", run: "Download CSV", working: "Preparing CSV…", cancel: "Close", error: "Could not export orders. Try narrower filters or a shorter date range.", noColumns: "Choose at least one column." },
  fa: { action: "خروجی CSV", title: "دریافت خروجی سفارش‌ها", scope: "سفارش‌های خروجی", filtered: "همهٔ سفارش‌های مطابق فیلترهای فعال", selected: "سفارش‌های انتخاب‌شده", choosePage: "انتخاب سفارش‌های این صفحه", selectedCount: "انتخاب‌شده (تا ۱۰۰ سفارش)", columns: "ستون‌ها", dateNote: "بازهٔ زمانی بر پایهٔ روزهای تهران است و جایگزین فیلتر تاریخ فعال می‌شود. زمان‌ها با قالب ISO 8601 و منطقهٔ UTC و مبالغ با مقدار دقیق صادر می‌شوند.", limit: "حداکثر ۵۰۰۰ سفارش در هر خروجی؛ برای موارد بیشتر، فیلتر یا بازهٔ زمانی را محدود کنید.", run: "دریافت CSV", working: "در حال آماده‌سازی…", cancel: "بستن", error: "دریافت خروجی انجام نشد. فیلتر یا بازهٔ زمانی کوتاه‌تری انتخاب کنید.", noColumns: "دست‌کم یک ستون انتخاب کنید." },
  ar: { action: "تصدير CSV", title: "تصدير الطلبات", scope: "الطلبات المراد تصديرها", filtered: "كل الطلبات المطابقة للمرشحات", selected: "الطلبات المحددة", choosePage: "تحديد طلبات هذه الصفحة", selectedCount: "محدد (حتى ١٠٠)", columns: "الأعمدة", dateNote: "يعتمد نطاق التاريخ على أيام طهران ويحل محل مرشح التاريخ الحالي. تُصدَّر الأوقات بصيغة ISO 8601 وUTC والمبالغ بقيمها العشرية الدقيقة.", limit: "الحد الأقصى ٥٠٠٠ طلب لكل تصدير. قلّص المرشحات أو نطاق التاريخ للنتائج الأكبر.", run: "تنزيل CSV", working: "جارٍ تجهيز CSV…", cancel: "إغلاق", error: "تعذّر تصدير الطلبات. جرّب نطاق تاريخ أقصر أو مرشحات أضيق.", noColumns: "اختر عمودًا واحدًا على الأقل." }
} as const;
const EXPORT_COLUMN_LABELS: Record<Locale, Record<ExportColumn, string>> = {
  en: { id: "Order ID", createdAt: "Placed (UTC)", status: "Status", buyer: "Buyer", buyerEmail: "Buyer email", buyerPhone: "Buyer phone", seller: "Seller", items: "Items", totalAmount: "Total amount", currency: "Currency", paymentProvider: "Payment provider", paymentReference: "Payment reference", trafficSource: "Source" },
  fa: { id: "شناسه سفارش", createdAt: "تاریخ ثبت (UTC)", status: "وضعیت", buyer: "خریدار", buyerEmail: "ایمیل خریدار", buyerPhone: "تلفن خریدار", seller: "فروشنده", items: "اقلام", totalAmount: "مبلغ کل", currency: "ارز", paymentProvider: "درگاه پرداخت", paymentReference: "کد پیگیری", trafficSource: "منبع ورود" },
  ar: { id: "معرّف الطلب", createdAt: "تاريخ الطلب (UTC)", status: "الحالة", buyer: "المشتري", buyerEmail: "بريد المشتري", buyerPhone: "هاتف المشتري", seller: "البائع", items: "العناصر", totalAmount: "المبلغ الإجمالي", currency: "العملة", paymentProvider: "مزود الدفع", paymentReference: "مرجع الدفع", trafficSource: "المصدر" }
};

export function AdminOrdersWorkspace({ locale }: { locale: Locale }) {
  const c = COPY[locale];
  const [draft, setDraft] = useState(initialFilters);
  const [filters, setFilters] = useState(initialFilters);
  const [page, setPage] = useState(0);
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [statusCounts, setStatusCounts] = useState<StatusCounts | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportScope, setExportScope] = useState<"filtered" | "selected">("filtered");
  const [exportColumns, setExportColumns] = useState<ExportColumn[]>(DEFAULT_EXPORT_COLUMNS);
  const [exportFrom, setExportFrom] = useState("");
  const [exportTo, setExportTo] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const requestId = useRef(0);

  const load = useCallback(async (cursor: string | null, active: Filters) => {
    const id = ++requestId.current;
    setLoading(true); setError(""); setOrders([]);
    try {
      const response = await api.get<{ items: Order[]; nextCursor: string | null; statusCounts: StatusCounts }>("/orders", { params: {
        limit: 20, view: "directory", trash: active.trash, ...(cursor ? { cursor } : {}),
        ...(active.search ? { search: active.search } : {}),
        ...(active.statusGroup !== "all" ? { statusGroup: active.statusGroup } : {}),
        ...(active.productType ? { productType: active.productType } : {}),
        ...(active.dateFrom ? { dateFrom: active.dateFrom } : {}),
        ...(active.dateTo ? { dateTo: active.dateTo } : {}), sort: active.sort
      } });
      if (id !== requestId.current) return;
      setOrders(response.data.items); setNextCursor(response.data.nextCursor); setStatusCounts(response.data.statusCounts);
    } catch {
      if (id === requestId.current) { setError(c.error); setStatusCounts(null); setNextCursor(null); }
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [c.error]);

  const { search, productType, dateFrom, dateTo, sort } = draft;
  useEffect(() => {
    const timer = setTimeout(() => {
      if ((dateFrom && dateTo && dateFrom > dateTo) || (search.trim().length > 0 && search.trim().length < 3)) return;
      setFilters((current) => ({ ...current, search: search.trim(), productType, dateFrom, dateTo, sort }));
      setPage(0); setCursors([null]);
    }, 300);
    return () => clearTimeout(timer);
  }, [search, productType, dateFrom, dateTo, sort]);
  useEffect(() => scheduleEffectTask(() => { void load(cursors[page] ?? null, filters); }), [cursors, filters, load, page]);

  function setFilter<K extends keyof Filters>(key: K, value: Filters[K]) { setDraft((current) => ({ ...current, [key]: value })); setSelectedIds([]); }
  function selectStatusGroup(statusGroup: StatusGroup) {
    if (statusGroup === filters.statusGroup) return;
    setDraft((current) => ({ ...current, statusGroup }));
    setSelectedIds([]);
    setFilters((current) => ({ ...current, statusGroup }));
    setPage(0); setCursors([null]);
  }
  function goNext() { if (!nextCursor) return; setCursors((current) => [...current.slice(0, page + 1), nextCursor]); setPage((current) => current + 1); }
  const invalidRange = Boolean(draft.dateFrom && draft.dateTo && draft.dateFrom > draft.dateTo);
  const shortSearch = draft.search.trim().length > 0 && draft.search.trim().length < 3;
  const activeCount = [filters.search, filters.productType, filters.dateFrom, filters.dateTo].filter(Boolean).length + Number(filters.statusGroup !== "all") + Number(filters.sort !== "newest");
  const advancedCount = [filters.productType, filters.dateFrom, filters.dateTo].filter(Boolean).length + Number(filters.sort !== "newest");
  const ec = EXPORT_COPY[locale];
  const visibleIds = orders.map((order) => order.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));
  const canSelectVisible = selectedIds.length + visibleIds.filter((id) => !selectedIds.includes(id)).length <= 100;
  const invalidExportRange = Boolean(exportFrom && exportTo && exportFrom > exportTo);

  function openExport() {
    setExportFrom(filters.dateFrom); setExportTo(filters.dateTo);
    setExportScope(selectedIds.length ? "selected" : "filtered");
    setExportError(""); setExportOpen(true);
  }
  function toggleSelection(id: string) {
    setSelectedIds((current) => current.includes(id) ? current.filter((value) => value !== id) : current.length < 100 ? [...current, id] : current);
  }
  function toggleVisible() {
    setSelectedIds((current) => allVisibleSelected ? current.filter((id) => !visibleIds.includes(id)) : [...new Set([...current, ...visibleIds])]);
  }
  function toggleColumn(column: ExportColumn) {
    setExportColumns((current) => current.includes(column) ? current.filter((value) => value !== column) : EXPORT_COLUMNS.filter((value) => current.includes(value) || value === column));
  }
  async function downloadExport() {
    if (!exportColumns.length || invalidExportRange || (exportScope === "selected" && !selectedIds.length)) return;
    setExporting(true); setExportError("");
    try {
      const response = await api.post<Blob>("/orders/export", {
        locale, columns: exportColumns, trash: filters.trash,
        ...(filters.search ? { search: filters.search } : {}),
        ...(filters.statusGroup !== "all" ? { statusGroup: filters.statusGroup } : {}),
        ...(filters.productType ? { productType: filters.productType } : {}),
        ...(exportFrom ? { dateFrom: exportFrom } : {}),
        ...(exportTo ? { dateTo: exportTo } : {}), sort: filters.sort,
        ...(exportScope === "selected" ? { selectedIds } : {})
      }, { responseType: "blob" });
      const url = URL.createObjectURL(response.data);
      const anchor = document.createElement("a");
      anchor.href = url; anchor.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.append(anchor); anchor.click(); anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setExportOpen(false);
    } catch {
      setExportError(ec.error);
    } finally {
      setExporting(false);
    }
  }

  return <section className={styles.workspace} aria-labelledby="admin-orders-title">
    <header className={styles.header}><div><h1 id="admin-orders-title">{c.title}</h1><p>{c.intro}</p></div><div className={styles.headerActions}><button type="button" className={styles.secondary} onClick={openExport} aria-expanded={exportOpen} aria-controls="order-export-options">{ec.action}</button><button type="button" className={styles.secondary} onClick={() => void load(cursors[page] ?? null, filters)} disabled={loading}>{c.refresh}</button></div></header>
    {exportOpen ? <section id="order-export-options" className={styles.exportPanel} aria-labelledby="order-export-title">
      <div className={styles.exportHeading}><h2 id="order-export-title">{ec.title}</h2><button type="button" className={styles.clear} onClick={() => setExportOpen(false)}>{ec.cancel}</button></div>
      <fieldset className={styles.exportScopes}><legend>{ec.scope}</legend><label><input type="radio" name="order-export-scope" checked={exportScope === "filtered"} onChange={() => setExportScope("filtered")} />{ec.filtered}</label><label><input type="radio" name="order-export-scope" checked={exportScope === "selected"} disabled={!selectedIds.length} onChange={() => setExportScope("selected")} />{ec.selected} ({selectedIds.length.toLocaleString(locale)})</label></fieldset>
      <div className={styles.exportDates}><label><span>{c.from}</span><JalaliDatePicker locale={locale} value={exportFrom} onChange={setExportFrom} /></label><label><span>{c.to}</span><JalaliDatePicker locale={locale} min={exportFrom || undefined} value={exportTo} onChange={setExportTo} /></label></div>
      <fieldset className={styles.exportColumns}><legend>{ec.columns}</legend><div>{EXPORT_COLUMNS.map((column) => <label key={column}><input type="checkbox" checked={exportColumns.includes(column)} onChange={() => toggleColumn(column)} />{EXPORT_COLUMN_LABELS[locale][column]}</label>)}</div></fieldset>
      <p className={styles.exportNote}>{ec.dateNote} {ec.limit}</p>
      {invalidExportRange ? <p className={styles.exportError} role="alert">{c.from} ≤ {c.to}</p> : null}
      {!exportColumns.length ? <p className={styles.exportError} role="alert">{ec.noColumns}</p> : null}
      {exportError ? <p className={styles.exportError} role="alert">{exportError}</p> : null}
      <div className={styles.exportFooter}><button type="button" className={styles.secondary} disabled={exporting || invalidExportRange || !exportColumns.length || (exportScope === "selected" && !selectedIds.length)} onClick={() => void downloadExport()}>{exporting ? ec.working : ec.run}</button></div>
    </section> : null}
    <nav className={styles.statusBar} aria-label={c.status} aria-busy={loading}>
      {statusGroups.map((group) => <button key={group} type="button" className={styles.statusTab} aria-pressed={filters.statusGroup === group} onClick={() => selectStatusGroup(group)}><span>{GROUP_COPY[locale][group]}</span><span className={styles.statusCount}>{statusCounts?.[group]?.toLocaleString(locale) ?? "—"}</span></button>)}
    </nav>
    <div className={styles.controls}>
      <label className={styles.searchField}><span>{c.search}</span><input type="search" value={draft.search} onChange={(event) => setFilter("search", event.target.value)} placeholder={c.searchHint} maxLength={100} /></label>
      <label className={styles.trashFilter}><span>{locale === "fa" ? "نمایش" : locale === "ar" ? "العرض" : "View"}</span><select value={filters.trash} onChange={(event) => { const trash = event.target.value as Filters["trash"]; setDraft((current) => ({ ...current, trash })); setFilters((current) => ({ ...current, trash })); setSelectedIds([]); setPage(0); setCursors([null]); }}><option value="active">{locale === "fa" ? "سفارش‌های فعال" : locale === "ar" ? "الطلبات النشطة" : "Active orders"}</option><option value="trashed">{locale === "fa" ? "زباله‌دان" : locale === "ar" ? "المهملات" : "Trash"}</option></select></label>
      <CollapsibleFilters className={styles.advancedFilters} surface={false} locale={locale} title={c.moreFilters} activeCount={advancedCount} defaultOpen={false}>
      <div className={styles.filterGrid}>
        <label><span>{c.type}</span><select value={draft.productType} onChange={(event) => setFilter("productType", event.target.value)}><option value="">{c.all}</option>{typeKeys.map((key) => <option value={key} key={key}>{c[key]}</option>)}</select></label>
        <label><span>{c.from}</span><JalaliDatePicker locale={locale} value={draft.dateFrom} onChange={(value) => setFilter("dateFrom", value)} /></label>
        <label><span>{c.to}</span><JalaliDatePicker locale={locale} min={draft.dateFrom || undefined} value={draft.dateTo} onChange={(value) => setFilter("dateTo", value)} /></label>
        <label><span>{c.sort}</span><select value={draft.sort} onChange={(event) => setFilter("sort", event.target.value)}><option value="newest">{c.newest}</option><option value="oldest">{c.oldest}</option></select></label>
      </div>
      <div className={styles.filterFooter}><span>{activeCount ? `${activeCount.toLocaleString(locale)} ${c.filters}` : c.all} · {c.showing} {orders.length.toLocaleString(locale)} {c.of}</span><button type="button" className={styles.clear} disabled={!activeCount && draft.sort === "newest"} onClick={() => { setDraft(initialFilters); setFilters(initialFilters); setSelectedIds([]); setPage(0); setCursors([null]); }}>{c.clear}</button></div>
      </CollapsibleFilters>
    </div>
    {invalidRange ? <p className={styles.notice} role="alert">{c.from} ≤ {c.to}</p> : null}
    {shortSearch ? <p className={styles.notice} role="status">{c.shortSearch}</p> : null}
    {error ? <p className={styles.notice} role="alert">{error} <button type="button" onClick={() => void load(cursors[page] ?? null, filters)}>{c.refresh}</button></p> : null}
    <div className={styles.tableWrap} aria-busy={loading}>
      <table><thead><tr><th scope="col"><input type="checkbox" aria-label={ec.choosePage} checked={allVisibleSelected} disabled={!orders.length || loading || (!allVisibleSelected && !canSelectVisible)} onChange={toggleVisible} /></th><th scope="col">{c.order}</th><th scope="col">{c.customer}</th><th scope="col">{c.source}</th><th scope="col">{c.seller}</th><th scope="col">{c.items}</th><th scope="col">{c.amount}</th><th scope="col">{c.status}</th><th scope="col">{c.date}</th><th scope="col"><span className={styles.srOnly}>{c.details}</span></th></tr></thead>
      <tbody>{orders.map((order) => <OrderRow key={order.id} order={order} locale={locale} c={c} selected={selectedIds.includes(order.id)} selectionDisabled={selectedIds.length >= 100 && !selectedIds.includes(order.id)} onSelect={() => toggleSelection(order.id)} />)}</tbody></table>
      {loading ? <p className={styles.state} role="status">{c.loading}</p> : !error && orders.length === 0 ? <p className={styles.state}>{c.empty}</p> : null}
    </div>
    <nav className={styles.pagination} aria-label={c.page}><span>{c.page} {(page + 1).toLocaleString(locale)} · {selectedIds.length.toLocaleString(locale)} {ec.selectedCount}</span><div><button type="button" className={styles.secondary} disabled={page === 0 || loading} onClick={() => setPage((current) => current - 1)}>{c.previous}</button><button type="button" className={styles.secondary} disabled={!nextCursor || loading} onClick={goNext}>{c.next}</button></div></nav>
  </section>;
}

function OrderRow({ order, locale, c, selected, selectionDisabled, onSelect }: { order: Order; locale: Locale; c: typeof COPY[Locale]; selected: boolean; selectionDisabled: boolean; onSelect: () => void }) {
  const count = order.items.reduce((total, item) => total + item.quantity, 0);
  return <tr className={styles.orderRow}>
    <td><input type="checkbox" aria-label={`${EXPORT_COPY[locale].selected} #${order.id}`} checked={selected} disabled={selectionDisabled} onChange={onSelect} /></td>
    <td data-label={c.order}><strong dir="ltr">#{order.id.slice(0, 8)}</strong></td>
    <td data-label={c.customer}><strong>{order.buyer.fullName}</strong><small dir="ltr">{order.buyer.email}</small></td>
    <td data-label={c.source}>{order.trafficSource || "—"}</td>
    <td data-label={c.seller}>{order.seller.shopName}</td>
    <td data-label={c.items}>{count.toLocaleString(locale)} · {order.items[0]?.productTitle ?? "—"}{order.items.length > 1 ? ` +${order.items.length - 1}` : ""}</td>
    <td data-label={c.amount}><strong dir="ltr">{formatCurrencyAmount(order.totalAmount, order.currency, locale)} {currencyLabel(order.currency)}</strong>{order.payment ? <small className={styles.paymentMeta}>{PAYMENT_COPY[locale].by} {paymentProviderLabel(order.payment.provider, locale)}{order.payment.reference ? <> · {PAYMENT_COPY[locale].reference}: <bdi dir="ltr">{order.payment.reference}</bdi></> : null}</small> : null}</td>
    <td data-label={c.status}><span className={styles.badge} data-status={order.status}>{c[order.status as keyof typeof c] ?? order.status}</span>{order.trashedAt ? <small>{locale === "fa" ? "در زباله‌دان" : locale === "ar" ? "في المهملات" : "In trash"}</small> : null}</td>
    <td data-label={c.date}><RelativeOrderTime value={order.createdAt} locale={locale} /></td>
    <td><Link className={styles.detailsButton} aria-label={`${c.details} #${order.id}`} href={`/${locale}/admin/orders/${order.id}` as Route}>{c.details}</Link></td>
  </tr>;
}
