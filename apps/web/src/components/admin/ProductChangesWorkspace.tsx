"use client";

import type {
  AdminProductSummary,
  ProductBulkUndoPreview,
  ProductBulkUndoResult,
  ProductChangeEvent,
  ProductChangesPage,
  ProductType,
  Vendor
} from "@topgsm/shared-types";
import Link from "next/link";
import type { Route } from "next";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api/client";
import type { Locale } from "@/lib/i18n";
import { CollapsibleFilters } from "@/components/dashboard/CollapsibleFilters";
import styles from "./ProductChangesWorkspace.module.css";

const COPY = {
  en: { title: "Product change history", intro: "A permanent record of catalog edits, reviews, and restores.", empty: "No product changes have been recorded yet.", loading: "Loading change history…", error: "Change history could not be loaded.", restore: "Restore this version", undo: "Undo this change", confirm: "Confirm restore", restoring: "Restoring…", restored: "Version restored.", page: "Page", previous: "Previous", next: "Next", retry: "Try again", fields: "Changed", by: "by", product: "Product", create: "Created", update: "Edited", review: "Reviewed", restoreAction: "Restored" },
  fa: { title: "تاریخچه تغییرات محصول", intro: "گزارش دائمی ویرایش‌ها، بررسی‌ها و بازگردانی‌های کاتالوگ.", empty: "هنوز تغییری برای محصولات ثبت نشده است.", loading: "در حال دریافت تاریخچه…", error: "دریافت تاریخچه تغییرات ممکن نبود.", restore: "بازگردانی این نسخه", undo: "لغو این تغییر", confirm: "تأیید بازگردانی", restoring: "در حال بازگردانی…", restored: "نسخه بازگردانی شد.", page: "صفحه", previous: "قبلی", next: "بعدی", retry: "تلاش دوباره", fields: "تغییرها", by: "توسط", product: "محصول", create: "ایجاد شد", update: "ویرایش شد", review: "بررسی شد", restoreAction: "بازگردانی شد" },
  ar: { title: "سجل تغييرات المنتج", intro: "سجل دائم لتعديلات الكتالوج والمراجعات وعمليات الاستعادة.", empty: "لم تُسجّل تغييرات على المنتجات بعد.", loading: "جارٍ تحميل السجل…", error: "تعذر تحميل سجل التغييرات.", restore: "استعادة هذا الإصدار", undo: "التراجع عن هذا التغيير", confirm: "تأكيد الاستعادة", restoring: "جارٍ الاستعادة…", restored: "تمت استعادة الإصدار.", page: "صفحة", previous: "السابق", next: "التالي", retry: "حاول مجدداً", fields: "التغييرات", by: "بواسطة", product: "المنتج", create: "تم الإنشاء", update: "تم التعديل", review: "تمت المراجعة", restoreAction: "تمت الاستعادة" }
} as const;

const BULK_COPY = {
  en: { title: "Bulk undo", intro: "Preview a bounded set, then reverse only the fields changed by those events.", last: "Last changes", afterTime: "Changes after a time", count: "Number of changes", time: "Undo back to", action: "Change type", productType: "Product type", seller: "Seller", any: "Any", combine: "Combine filters", and: "Match all (AND)", or: "Match any (OR)", preview: "Preview undo", previewing: "Building preview…", selected: "changes across", products: "products", more: "More matches remain; run another batch after this one.", execute: "Undo selected changes", executing: "Undoing changes…", done: "changes undone", update: "Edits", review: "Reviews", restore: "Restores" },
  fa: { title: "لغو گروهی", intro: "ابتدا مجموعه‌ای محدود را بررسی کنید؛ سپس فقط فیلدهای همان رویدادها به عقب برمی‌گردند.", last: "آخرین تغییرها", afterTime: "تغییرهای بعد از یک زمان", count: "تعداد تغییر", time: "بازگشت تا زمان", action: "نوع تغییر", productType: "نوع محصول", seller: "فروشنده", any: "همه", combine: "ترکیب فیلترها", and: "همه برقرار باشند (AND)", or: "حداقل یکی برقرار باشد (OR)", preview: "پیش‌نمایش لغو", previewing: "در حال آماده‌سازی…", selected: "تغییر روی", products: "محصول", more: "تغییرهای بیشتری باقی مانده؛ پس از این مرحله یک دسته دیگر اجرا کنید.", execute: "لغو تغییرهای انتخاب‌شده", executing: "در حال لغو تغییرها…", done: "تغییر لغو شد", update: "ویرایش‌ها", review: "بررسی‌ها", restore: "بازگردانی‌ها" },
  ar: { title: "تراجع جماعي", intro: "عاين مجموعة محدودة أولاً، ثم اعكس فقط الحقول التي غيّرتها تلك الأحداث.", last: "آخر التغييرات", afterTime: "التغييرات بعد وقت", count: "عدد التغييرات", time: "الرجوع حتى", action: "نوع التغيير", productType: "نوع المنتج", seller: "البائع", any: "الكل", combine: "دمج المرشحات", and: "مطابقة الكل (AND)", or: "مطابقة أي منها (OR)", preview: "معاينة التراجع", previewing: "جارٍ إعداد المعاينة…", selected: "تغييرات على", products: "منتجات", more: "توجد نتائج أخرى؛ شغّل دفعة أخرى بعد هذه.", execute: "التراجع عن المحدد", executing: "جارٍ التراجع…", done: "تغييرات تم التراجع عنها", update: "التعديلات", review: "المراجعات", restore: "الاستعادات" }
} as const;

export function ProductChangesWorkspace({
  locale,
  productId,
  compact = false,
  onRestored
}: {
  locale: Locale;
  productId?: string;
  compact?: boolean;
  onRestored?: (product: AdminProductSummary) => void;
}) {
  const c = COPY[locale];
  const bulkCopy = BULK_COPY[locale];
  const [items, setItems] = useState<ProductChangeEvent[]>([]);
  const [page, setPage] = useState(0);
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [historyError, setHistoryError] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [confirmKey, setConfirmKey] = useState<string | null>(null);
  const [restoringKey, setRestoringKey] = useState<string | null>(null);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [bulkMode, setBulkMode] = useState<"last" | "after_time">("last");
  const [bulkCount, setBulkCount] = useState(100);
  const [bulkAfter, setBulkAfter] = useState("");
  const [bulkOperator, setBulkOperator] = useState<"and" | "or">("and");
  const [bulkAction, setBulkAction] = useState<"" | "update" | "review" | "restore">("");
  const [bulkProductType, setBulkProductType] = useState<"" | ProductType>("");
  const [bulkSellerId, setBulkSellerId] = useState("");
  const [bulkPreview, setBulkPreview] = useState<ProductBulkUndoPreview | null>(null);
  const [bulkOperationId, setBulkOperationId] = useState("");
  const [bulkBusy, setBulkBusy] = useState<"preview" | "execute" | "">("");
  const requestId = useRef(0);

  const load = useCallback(async (cursor: string | null) => {
    const id = ++requestId.current;
    setLoading(true);
    setHistoryError("");
    setItems([]);
    setNextCursor(null);
    try {
      const path = productId ? `/products/admin/${productId}/changes` : "/products/admin/changes";
      const response = await api.get<ProductChangesPage>(path, {
        params: { limit: compact ? 8 : 30, ...(cursor ? { cursor } : {}) }
      });
      if (id !== requestId.current) return;
      setItems(response.data.items);
      setNextCursor(response.data.nextCursor);
    } catch {
      if (id === requestId.current) setHistoryError(c.error);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [c.error, compact, productId]);

  useEffect(() => { void load(cursors[page] ?? null); }, [cursors, load, page]);
  useEffect(() => {
    if (compact) return;
    void api.get<Vendor[]>("/seller/vendors")
      .then((response) => setVendors(response.data))
      .catch(() => setVendors([]));
  }, [compact]);

  function clearBulkPreview() {
    setBulkPreview(null);
    setBulkOperationId("");
  }

  function resetHistory() {
    setPage(0);
    setCursors([null]);
  }

  function goNext() {
    if (!nextCursor) return;
    setCursors((current) => [...current.slice(0, page + 1), nextCursor]);
    setPage((current) => current + 1);
  }

  function bulkPayload() {
    return {
      mode: bulkMode,
      count: bulkCount,
      ...(bulkMode === "after_time" && bulkAfter ? { after: new Date(bulkAfter).toISOString() } : {}),
      operator: bulkOperator,
      ...(bulkAction ? { actions: [bulkAction] } : {}),
      ...(bulkProductType ? { productTypes: [bulkProductType] } : {}),
      ...(bulkSellerId ? { sellerIds: [bulkSellerId] } : {})
    };
  }

  async function previewBulkUndo() {
    if (bulkMode === "after_time" && !bulkAfter) return;
    setBulkBusy("preview");
    setError("");
    setMessage("");
    try {
      const response = await api.post<ProductBulkUndoPreview>("/products/admin/changes/bulk-undo/preview", bulkPayload());
      setBulkPreview(response.data);
      setBulkOperationId(crypto.randomUUID());
    } catch {
      setError(c.error);
    } finally {
      setBulkBusy("");
    }
  }

  async function executeBulkUndo() {
    if (!bulkPreview?.changeIds.length || !bulkOperationId) return;
    setBulkBusy("execute");
    setError("");
    try {
      const response = await api.post<ProductBulkUndoResult>("/products/admin/changes/bulk-undo", {
        ...bulkPayload(),
        operationId: bulkOperationId,
        changeIds: bulkPreview.changeIds
      });
      setMessage(`${response.data.undoneCount} ${bulkCopy.done}`);
      clearBulkPreview();
      resetHistory();
    } catch {
      setError(c.error);
    } finally {
      setBulkBusy("");
    }
  }

  async function restore(event: ProductChangeEvent, side: "before" | "after") {
    const key = `${event.id}:${side}`;
    if (confirmKey !== key) {
      setConfirmKey(key);
      return;
    }
    setRestoringKey(key);
    setError("");
    try {
      const response = await api.post<AdminProductSummary>(`/products/admin/${event.product.id}/restore`, { changeId: event.id, side });
      onRestored?.(response.data);
      setMessage(c.restored);
      setConfirmKey(null);
      resetHistory();
    } catch {
      setError(c.error);
    } finally {
      setRestoringKey(null);
    }
  }

  const actionLabel = (action: ProductChangeEvent["action"]) => action === "create" ? c.create : action === "update" ? c.update : action === "review" ? c.review : c.restoreAction;
  const fieldLabel = (field: string) => ({ title: locale === "fa" ? "عنوان" : locale === "ar" ? "العنوان" : "title", slug: locale === "fa" ? "نامک" : locale === "ar" ? "المعرّف" : "slug", description: locale === "fa" ? "توضیحات" : locale === "ar" ? "الوصف" : "description", category: locale === "fa" ? "دسته‌بندی" : locale === "ar" ? "الفئة" : "category", status: locale === "fa" ? "وضعیت" : locale === "ar" ? "الحالة" : "status" }[field] ?? field);

  return (
    <section className={styles.workspace} data-compact={compact || undefined} aria-labelledby={compact ? undefined : "product-changes-title"}>
      {!compact ? <header><div><h2 id="product-changes-title">{c.title}</h2><p>{c.intro}</p></div></header> : <h3 className={styles.compactTitle}>{c.title}</h3>}
      {!compact ? <CollapsibleFilters className={styles.bulkPanel} surface={false} locale={locale} title={bulkCopy.title} description={bulkCopy.intro} activeCount={[bulkMode !== "last", bulkAfter, bulkOperator !== "and", bulkAction, bulkProductType, bulkSellerId].filter(Boolean).length}>
        <div className={styles.bulkGrid}>
          <label><span>{bulkCopy.last}</span><select value={bulkMode} onChange={(event) => { setBulkMode(event.target.value as "last" | "after_time"); clearBulkPreview(); }}><option value="last">{bulkCopy.last}</option><option value="after_time">{bulkCopy.afterTime}</option></select></label>
          <label><span>{bulkCopy.count}</span><input type="number" min={1} max={100} value={bulkCount} onChange={(event) => { setBulkCount(Math.max(1, Math.min(100, Number(event.target.value) || 1))); clearBulkPreview(); }} /></label>
          {bulkMode === "after_time" ? <label><span>{bulkCopy.time}</span><input type="datetime-local" required value={bulkAfter} onChange={(event) => { setBulkAfter(event.target.value); clearBulkPreview(); }} /></label> : null}
          <label><span>{bulkCopy.action}</span><select value={bulkAction} onChange={(event) => { setBulkAction(event.target.value as typeof bulkAction); clearBulkPreview(); }}><option value="">{bulkCopy.any}</option><option value="update">{bulkCopy.update}</option><option value="review">{bulkCopy.review}</option><option value="restore">{bulkCopy.restore}</option></select></label>
          <label><span>{bulkCopy.productType}</span><select value={bulkProductType} onChange={(event) => { setBulkProductType(event.target.value as typeof bulkProductType); clearBulkPreview(); }}><option value="">{bulkCopy.any}</option><option value="digital">Digital</option><option value="physical">Physical</option><option value="service">Service</option><option value="bridge">Bridge</option></select></label>
          <label><span>{bulkCopy.seller}</span><select value={bulkSellerId} onChange={(event) => { setBulkSellerId(event.target.value); clearBulkPreview(); }}><option value="">{bulkCopy.any}</option>{vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.shopName}</option>)}</select></label>
          <label><span>{bulkCopy.combine}</span><select value={bulkOperator} onChange={(event) => { setBulkOperator(event.target.value as "and" | "or"); clearBulkPreview(); }}><option value="and">{bulkCopy.and}</option><option value="or">{bulkCopy.or}</option></select></label>
        </div>
        <div className={styles.bulkActions}>
          <button type="button" disabled={Boolean(bulkBusy) || (bulkMode === "after_time" && !bulkAfter)} onClick={() => void previewBulkUndo()}>{bulkBusy === "preview" ? bulkCopy.previewing : bulkCopy.preview}</button>
          {bulkPreview ? <div className={styles.bulkPreview}><strong>{bulkPreview.changeCount} {bulkCopy.selected} {bulkPreview.affectedProductCount} {bulkCopy.products}</strong>{bulkPreview.hasMore ? <small>{bulkCopy.more}</small> : null}</div> : null}
          {bulkPreview?.changeCount ? <button className={styles.dangerButton} type="button" disabled={Boolean(bulkBusy)} onClick={() => void executeBulkUndo()}>{bulkBusy === "execute" ? bulkCopy.executing : bulkCopy.execute}</button> : null}
        </div>
      </CollapsibleFilters> : null}
      {historyError ? <p className={styles.error} role="alert">{historyError} <button type="button" onClick={() => void load(cursors[page] ?? null)}>{c.retry}</button></p> : null}
      {error ? <p className={styles.error} role="alert">{error}</p> : null}
      {message ? <p className={styles.message} role="status">{message}</p> : null}
      {loading && !items.length ? <p className={styles.empty}>{c.loading}</p> : null}
      {!loading && !historyError && !items.length ? <p className={styles.empty}>{c.empty}</p> : null}
      <ol className={styles.timeline}>
        {items.map((event) => (
          <li key={event.id}>
            <span className={styles.marker} aria-hidden="true" />
            <div className={styles.card}>
              <div className={styles.cardHead}>
                <div>
                  <strong>{actionLabel(event.action)}</strong>
                  {!compact ? <Link href={`/${locale}/admin/products/${event.product.id}` as Route}>{c.product}: {event.product.title}</Link> : null}
                </div>
                <time dateTime={event.createdAt}>{new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(event.createdAt))}</time>
              </div>
              <p>{c.fields}: {event.changedFields.length ? event.changedFields.map(fieldLabel).join("، ") : "—"}</p>
              <small>
                {c.by} {event.actor.name} · {event.product.seller?.shopName ?? "—"} · {event.product.type ?? "—"}
              </small>
              <div className={styles.restoreActions}>
                <button type="button" disabled={Boolean(restoringKey)} onClick={() => void restore(event, "after")}>
                  {restoringKey === `${event.id}:after` ? c.restoring : confirmKey === `${event.id}:after` ? c.confirm : c.restore}
                </button>
                {event.before ? <button type="button" disabled={Boolean(restoringKey)} onClick={() => void restore(event, "before")}>
                  {restoringKey === `${event.id}:before` ? c.restoring : confirmKey === `${event.id}:before` ? c.confirm : c.undo}
                </button> : null}
              </div>
            </div>
          </li>
        ))}
      </ol>
      {(page > 0 || nextCursor) ? <nav className={styles.pagination} aria-label={c.page}>
        <span>{c.page} {(page + 1).toLocaleString(locale)}</span>
        <div>
          <button type="button" disabled={page === 0 || loading} onClick={() => setPage((current) => current - 1)}>{c.previous}</button>
          <button type="button" disabled={!nextCursor || loading} onClick={goNext}>{c.next}</button>
        </div>
      </nav> : null}
    </section>
  );
}
