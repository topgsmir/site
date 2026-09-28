"use client";

import { useEffect, useMemo, useState } from "react";
import type { Locale } from "@/lib/i18n";
import { api } from "@/lib/api/client";
import type { ProductStatus, Vendor } from "@topgsm/shared-types";
import styles from "./ProductBulkEdit.module.css";

type Action = "status" | "category" | "seller" | "stock" | "price" | "price_percent" | "tags_add" | "tags_remove" | "tr ash";
type Preview = { revision: string; productCount: number; offerCount: number; items: Array<{ id: string; title: string; before: string; after: string; offerCount: number }> };
type Category = { id: string; name: string };

const labels = {
  en: { selected: "selected", clear: "Clear selection", action: "Bulk action", choose: "Choose an action", status: "Publication status", category: "Change category", seller: "Transfer seller", stock: "Set physical stock", price: "Set offer price", price_percent: "Adjust prices by percent", tags_add: "Add tag", tags_remove: "Remove tag", trash: "Move to trash", value: "Value", categorySearch: "Search categories", uncategorized: "No category", sellerChoose: "Choose seller", preview: "Preview changes", previewing: "Preparing preview…", apply: "Confirm and apply", applying: "Applying…", cancel: "Cancel preview", offers: "offers", before: "Before", after: "After", warning: "Review every change before confirming. Price, seller, and trash changes can affect live listings.", done: "Products updated.", error: "Could not complete the bulk edit. Review the selection and try again.", max: "Choose no more than 50 products.", draft: "Draft", pending_review: "Pending review", active: "Published", archived: "Archived" },
  fa: { selected: "انتخاب شده", clear: "پاک کردن انتخاب", action: "عملیات گروهی", choose: "انتخاب عملیات", status: "وضعیت انتشار", category: "تغییر دسته‌بندی", seller: "انتقال فروشنده", stock: "تعیین موجودی فیزیکی", price: "تعیین قیمت پیشنهادها", price_percent: "تغییر درصدی قیمت", tags_add: "افزودن برچسب", tags_remove: "حذف برچسب", trash: "انتقال به زباله‌دان", value: "مقدار", categorySearch: "جست‌وجوی دسته‌بندی", uncategorized: "بدون دسته‌بندی", sellerChoose: "انتخاب فروشنده", preview: "پیش‌نمایش تغییرات", previewing: "در حال آماده‌سازی…", apply: "تأیید و اعمال", applying: "در حال اعمال…", cancel: "بستن پیش‌نمایش", offers: "پیشنهاد", before: "پیش از تغییر", after: "پس از تغییر", warning: "پیش از تأیید، همه تغییرات را بررسی کنید. قیمت، فروشنده و زباله‌دان می‌توانند بر فهرست زنده اثر بگذارند.", done: "محصولات به‌روزرسانی شدند.", error: "ویرایش گروهی انجام نشد. انتخاب‌ها را بررسی و دوباره تلاش کنید.", max: "حداکثر ۵۰ محصول انتخاب کنید.", draft: "پیش‌نویس", pending_review: "در انتظار بررسی", active: "منتشرشده", archived: "بایگانی‌شده" },
  ar: { selected: "محدد", clear: "مسح التحديد", action: "إجراء جماعي", choose: "اختر إجراءً", status: "حالة النشر", category: "تغيير الفئة", seller: "نقل البائع", stock: "تحديد المخزون", price: "تحديد السعر", price_percent: "تعديل السعر بالنسبة", tags_add: "إضافة وسم", tags_remove: "إزالة وسم", trash: "نقل إلى المهملات", value: "القيمة", categorySearch: "بحث الفئات", uncategorized: "بلا فئة", sellerChoose: "اختر بائعاً", preview: "معاينة التغييرات", previewing: "جارٍ التحضير…", apply: "تأكيد وتطبيق", applying: "جارٍ التطبيق…", cancel: "إغلاق المعاينة", offers: "عرض", before: "قبل", after: "بعد", warning: "راجع التغييرات قبل التأكيد. قد تؤثر الأسعار والبائع والمهملات على العروض المباشرة.", done: "تم تحديث المنتجات.", error: "تعذر التعديل الجماعي. راجع التحديد وحاول مجدداً.", max: "حدد ٥٠ منتجاً كحد أقصى.", draft: "مسودة", pending_review: "بانتظار المراجعة", active: "منشور", archived: "مؤرشف" }
} as const;

function errorText(error: unknown, fallback: string) {
  if (typeof error === "object" && error && "response" in error) {
    const response = (error as { response?: { data?: { message?: string | string[] } } }).response;
    if (typeof response?.data?.message === "string") return response.data.message;
    if (Array.isArray(response?.data?.message)) return response.data.message.join(" ");
  }
  return fallback;
}

function asciiDigits(value: string) {
  return value.replace(/[۰-۹٠-٩]/gu, (digit) => String(digit.charCodeAt(0) - (digit <= "٩" ? 1632 : 1776)));
}

export function ProductBulkEdit({ locale, selectedIds, onClear, onDone }: { locale: Locale; selectedIds: string[]; onClear: () => void; onDone: () => void }) {
  const c = labels[locale];
  const [action, setAction] = useState<Action | "">("");
  const [status, setStatus] = useState<ProductStatus>("active");
  const [categoryId, setCategoryId] = useState("");
  const [categorySearch, setCategorySearch] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [sellerId, setSellerId] = useState("");
  const [value, setValue] = useState("");
  const [preview, setPreview] = useState<(Preview & { fingerprint: string; operationId: string }) | null>(null);
  const [busy, setBusy] = useState<"preview" | "apply" | "">("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (action !== "category") return;
    let active = true;
    const timer = window.setTimeout(() => {
      void api.get<{ items: Category[] }>("/products/categories", { params: { search: categorySearch, limit: 50 } })
        .then((response) => { if (active) setCategories(response.data.items); })
        .catch(() => { if (active) setError(c.error); });
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [action, categorySearch, c.error]);

  useEffect(() => {
    if (action !== "seller") return;
    let active = true;
    void api.get<Vendor[]>("/seller/vendors").then((response) => { if (active) setVendors(response.data); }).catch(() => { if (active) setError(c.error); });
    return () => { active = false; };
  }, [action, c.error]);

  const payload = useMemo(() => ({
    productIds: [...selectedIds].sort(), action,
    ...(action === "status" ? { status } : {}),
    ...(action === "category" ? { categoryId: categoryId || null } : {}),
    ...(action === "seller" ? { sellerId } : {}),
    ...(action === "stock" ? { stock: Number(value) } : {}),
    ...(action === "price" ? { price: value } : {}),
    ...(action === "price_percent" ? { percent: value } : {}),
    ...(action === "tags_add" || action === "tags_remove" ? { tag: value.trim() } : {})
  }), [selectedIds, action, status, categoryId, sellerId, value]);
  const fingerprint = JSON.stringify(payload);
  const shownPreview = preview?.fingerprint === fingerprint ? preview : null;
  const canPreview = Boolean(action) && selectedIds.length <= 50 &&
    (action !== "seller" || Boolean(sellerId)) &&
    (!["price", "price_percent", "tags_add", "tags_remove", "stock"].includes(action) || value.trim() !== "") &&
    (action !== "stock" || (Number.isInteger(Number(value)) && Number(value) >= 0));

  async function prepare() {
    if (!canPreview) return;
    setBusy("preview"); setError(""); setMessage(""); setPreview(null);
    try {
      const response = await api.post<Preview>("/products/admin/bulk-edit/preview", payload);
      setPreview({ ...response.data, fingerprint, operationId: crypto.randomUUID() });
    } catch (caught) { setError(errorText(caught, c.error)); }
    finally { setBusy(""); }
  }

  async function apply() {
    if (!shownPreview || busy) return;
    setBusy("apply"); setError("");
    try {
      await api.post("/products/admin/bulk-edit", { ...payload, revision: shownPreview.revision, operationId: shownPreview.operationId });
      setPreview(null); setMessage(c.done); onClear(); onDone();
    } catch (caught) { setError(errorText(caught, c.error)); }
    finally { setBusy(""); }
  }

  return <section className={styles.panel} aria-label={c.action}>
    <div className={styles.top}><strong>{selectedIds.length.toLocaleString(locale)} {c.selected}</strong><button type="button" onClick={onClear} disabled={Boolean(busy)}>{c.clear}</button></div>
    <div className={styles.controls}>
      <label><span>{c.action}</span><select value={action} onChange={(event) => { setAction(event.target.value as Action | ""); setValue(""); setError(""); }}><option value="">{c.choose}</option>{(["status", "category", "seller", "stock", "price", "price_percent", "tags_add", "tags_remove", "trash"] as const).map((key) => <option key={key} value={key}>{c[key]}</option>)}</select></label>
      {action === "status" ? <label><span>{c.value}</span><select value={status} onChange={(event) => setStatus(event.target.value as ProductStatus)}>{(["draft", "pending_review", "active", "archived"] as const).map((key) => <option key={key} value={key}>{c[key]}</option>)}</select></label> : null}
      {action === "category" ? <><label><span>{c.categorySearch}</span><input value={categorySearch} onChange={(event) => { setCategorySearch(event.target.value); setCategoryId(""); }} /></label><label><span>{c.category}</span><select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}><option value="">{c.uncategorized}</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label></> : null}
      {action === "seller" ? <label><span>{c.seller}</span><select value={sellerId} onChange={(event) => setSellerId(event.target.value)}><option value="">{c.sellerChoose}</option>{vendors.filter((vendor) => vendor.status === "active").map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.shopName}</option>)}</select></label> : null}
      {(["price", "price_percent", "stock", "tags_add", "tags_remove"] as string[]).includes(action) ? <label><span>{c.value}</span><input value={value} onChange={(event) => setValue(action.startsWith("tags_") ? event.target.value : asciiDigits(event.target.value))} type={action === "stock" ? "number" : "text"} min={action === "stock" ? 0 : undefined} maxLength={action.startsWith("tags_") ? 50 : 30} inputMode={action.startsWith("tags_") ? "text" : "decimal"} /></label> : null}
      <button className={styles.primary} type="button" disabled={!canPreview || Boolean(busy)} onClick={() => void prepare()}>{busy === "preview" ? c.previewing : c.preview}</button>
    </div>
    {selectedIds.length > 50 ? <p role="alert">{c.max}</p> : null}
    {error ? <p className={styles.error} role="alert">{error}</p> : null}
    {message ? <p role="status">{message}</p> : null}
    {shownPreview ? <div className={styles.preview} aria-live="polite"><p><strong>{shownPreview.productCount.toLocaleString(locale)} {c.selected} · {shownPreview.offerCount.toLocaleString(locale)} {c.offers}</strong></p><p>{c.warning}</p><div className={styles.previewList}>{shownPreview.items.map((item) => <div key={item.id} className={styles.previewRow}><strong>{item.title}</strong><span><small>{c.before}</small><bdi>{item.before}</bdi></span><span><small>{c.after}</small><bdi>{item.after}</bdi></span></div>)}</div><div className={styles.actions}><button type="button" onClick={() => setPreview(null)} disabled={Boolean(busy)}>{c.cancel}</button><button className={styles.primary} type="button" disabled={Boolean(busy)} onClick={() => void apply()}>{busy === "apply" ? c.applying : c.apply}</button></div></div> : null}
  </section>;
}
