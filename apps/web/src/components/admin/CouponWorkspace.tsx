"use client";

import axios from "axios";
import type {
  AdminSellerCoupon,
  AdminSellerCouponsPage,
  CouponDiscountType,
  Vendor
} from "@topgsm/shared-types";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api/client";
import { currencyLabel, formatCurrencyAmount } from "@/lib/currency";
import type { Locale } from "@/lib/i18n";
import styles from "./CouponWorkspace.module.css";

const copy = {
  en: {
    eyebrow: "Sales service",
    title: "Seller coupons",
    intro: "Create and manage discount codes across every seller account.",
    createTitle: "New coupon",
    editTitle: "Edit coupon",
    seller: "Seller",
    allSellers: "All sellers",
    code: "Coupon code",
    type: "Discount type",
    percentage: "Percentage",
    fixed: "Fixed amount",
    value: "Discount value",
    currency: "Currency",
    minimum: "Minimum order amount",
    maximum: "Maximum redemptions",
    starts: "Starts at",
    expires: "Expires at",
    optional: "Optional",
    active: "Active",
    create: "Create coupon",
    save: "Save changes",
    cancel: "Cancel edit",
    submitting: "Saving…",
    status: "Status",
    schedule: "Schedule",
    redemptions: "Redemptions",
    noLimit: "No limit",
    noExpiry: "No expiry",
    enabled: "Active",
    disabled: "Inactive",
    edit: "Edit",
    remove: "Delete",
    confirmDelete: "Delete this coupon permanently?",
    empty: "No coupons match this seller filter.",
    loading: "Loading coupons…",
    loadError: "Coupons could not be loaded. Refresh and try again.",
    saveError: "The coupon could not be saved. Review the values and try again.",
    deleteError: "The coupon could not be deleted.",
    sellersError: "Seller accounts could not be loaded.",
    retry: "Try again",
    more: "Load more"
  },
  fa: {
    eyebrow: "سرویس فروش",
    title: "کدهای تخفیف فروشندگان",
    intro: "کدهای تخفیف همه فروشنده‌ها را از یک‌جا بسازید و مدیریت کنید.",
    createTitle: "کد تخفیف جدید",
    editTitle: "ویرایش کد تخفیف",
    seller: "فروشنده",
    allSellers: "همه فروشنده‌ها",
    code: "کد تخفیف",
    type: "نوع تخفیف",
    percentage: "درصدی",
    fixed: "مبلغ ثابت",
    value: "مقدار تخفیف",
    currency: "واحد پول",
    minimum: "حداقل مبلغ سفارش",
    maximum: "حداکثر دفعات استفاده",
    starts: "زمان شروع",
    expires: "زمان پایان",
    optional: "اختیاری",
    active: "فعال",
    create: "ساخت کد تخفیف",
    save: "ذخیره تغییرات",
    cancel: "لغو ویرایش",
    submitting: "در حال ذخیره…",
    status: "وضعیت",
    schedule: "بازه زمانی",
    redemptions: "دفعات استفاده",
    noLimit: "بدون محدودیت",
    noExpiry: "بدون انقضا",
    enabled: "فعال",
    disabled: "غیرفعال",
    edit: "ویرایش",
    remove: "حذف",
    confirmDelete: "این کد تخفیف برای همیشه حذف شود؟",
    empty: "برای این فیلتر کد تخفیفی پیدا نشد.",
    loading: "در حال بارگذاری کدها…",
    loadError: "کدهای تخفیف بارگذاری نشدند. صفحه را تازه کنید.",
    saveError: "کد تخفیف ذخیره نشد. مقادیر را بررسی و دوباره تلاش کنید.",
    deleteError: "حذف کد تخفیف انجام نشد.",
    sellersError: "حساب‌های فروشندگان بارگذاری نشدند.",
    retry: "تلاش دوباره",
    more: "نمایش بیشتر"
  },
  ar: {
    eyebrow: "خدمة المبيعات",
    title: "قسائم البائعين",
    intro: "أنشئ رموز الخصم وأدرها لجميع حسابات البائعين من مكان واحد.",
    createTitle: "قسيمة جديدة",
    editTitle: "تعديل القسيمة",
    seller: "البائع",
    allSellers: "جميع البائعين",
    code: "رمز القسيمة",
    type: "نوع الخصم",
    percentage: "نسبة مئوية",
    fixed: "مبلغ ثابت",
    value: "قيمة الخصم",
    currency: "العملة",
    minimum: "الحد الأدنى للطلب",
    maximum: "الحد الأقصى للاستخدام",
    starts: "يبدأ في",
    expires: "ينتهي في",
    optional: "اختياري",
    active: "نشطة",
    create: "إنشاء القسيمة",
    save: "حفظ التغييرات",
    cancel: "إلغاء التعديل",
    submitting: "جارٍ الحفظ…",
    status: "الحالة",
    schedule: "الجدول",
    redemptions: "الاستخدامات",
    noLimit: "بلا حد",
    noExpiry: "بلا انتهاء",
    enabled: "نشطة",
    disabled: "غير نشطة",
    edit: "تعديل",
    remove: "حذف",
    confirmDelete: "هل تريد حذف هذه القسيمة نهائياً؟",
    empty: "لا توجد قسائم مطابقة لتصفية البائع.",
    loading: "جارٍ تحميل القسائم…",
    loadError: "تعذر تحميل القسائم. حدّث الصفحة وحاول مجدداً.",
    saveError: "تعذر حفظ القسيمة. راجع القيم وحاول مجدداً.",
    deleteError: "تعذر حذف القسيمة.",
    sellersError: "تعذر تحميل حسابات البائعين.",
    retry: "حاول مجدداً",
    more: "تحميل المزيد"
  }
} as const;

type CouponDraft = {
  sellerId: string;
  code: string;
  discountType: CouponDiscountType;
  discountValue: string;
  currency: string;
  minimumOrderAmount: string;
  maximumRedemptions: string;
  startsAt: string;
  expiresAt: string;
  active: boolean;
};

const emptyDraft: CouponDraft = {
  sellerId: "",
  code: "",
  discountType: "percentage",
  discountValue: "",
  currency: "TOMAN",
  minimumOrderAmount: "",
  maximumRedemptions: "",
  startsAt: "",
  expiresAt: "",
  active: true
};

function errorMessage(error: unknown, fallback: string) {
  if (!axios.isAxiosError(error)) return fallback;
  const message = error.response?.data?.message;
  return Array.isArray(message) ? message.join(" ") : typeof message === "string" ? message : fallback;
}

function toIso(value: string) {
  return value ? new Date(value).toISOString() : undefined;
}

function toLocalInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function CouponWorkspace({ locale }: { locale: Locale }) {
  const c = copy[locale];
  const [coupons, setCoupons] = useState<AdminSellerCoupon[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [sellerFilter, setSellerFilter] = useState("");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [draft, setDraft] = useState<CouponDraft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [listError, setListError] = useState("");
  const [formError, setFormError] = useState("");

  const loadCoupons = useCallback(async (cursor?: string) => {
    setLoading(true);
    setListError("");
    try {
      const response = await api.get<AdminSellerCouponsPage>("/coupons/admin", {
        params: { limit: 20, ...(cursor ? { cursor } : {}), ...(sellerFilter ? { sellerId: sellerFilter } : {}) }
      });
      setCoupons((current) => cursor ? [...current, ...response.data.items] : response.data.items);
      setNextCursor(response.data.nextCursor);
    } catch (error) {
      setListError(errorMessage(error, c.loadError));
    } finally {
      setLoading(false);
    }
  }, [c.loadError, sellerFilter]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => void loadCoupons());
    return () => window.cancelAnimationFrame(frame);
  }, [loadCoupons]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      void api.get<Vendor[]>("/seller/vendors")
        .then((response) => {
          setVendors(response.data);
          setDraft((current) => current.sellerId || response.data.length === 0
            ? current
            : { ...current, sellerId: response.data[0].id });
        })
        .catch((error) => setFormError(errorMessage(error, c.sellersError)));
    });
    return () => window.cancelAnimationFrame(frame);
  }, [c.sellersError]);

  function update<K extends keyof CouponDraft>(key: K, value: CouponDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setFormError("");
  }

  function resetForm() {
    setEditingId(null);
    setDraft({ ...emptyDraft, sellerId: vendors[0]?.id ?? "" });
    setFormError("");
  }

  function beginEdit(coupon: AdminSellerCoupon) {
    setEditingId(coupon.id);
    setDraft({
      sellerId: coupon.seller.id,
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      currency: coupon.currency,
      minimumOrderAmount: coupon.minimumOrderAmount ?? "",
      maximumRedemptions: coupon.maximumRedemptions?.toString() ?? "",
      startsAt: toLocalInput(coupon.startsAt),
      expiresAt: toLocalInput(coupon.expiresAt),
      active: coupon.active
    });
    setFormError("");
    document.getElementById("admin-coupon-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setFormError("");
    const values = {
      code: draft.code.trim(),
      discountType: draft.discountType,
      discountValue: draft.discountValue.trim(),
      currency: draft.currency.trim(),
      minimumOrderAmount: draft.minimumOrderAmount.trim() || null,
      maximumRedemptions: draft.maximumRedemptions ? Number(draft.maximumRedemptions) : null,
      startsAt: toIso(draft.startsAt),
      expiresAt: toIso(draft.expiresAt) ?? null,
      active: draft.active
    };
    try {
      const response = editingId
        ? await api.patch<AdminSellerCoupon>(`/coupons/admin/${editingId}`, values)
        : await api.post<AdminSellerCoupon>("/coupons/admin", {
            ...values,
            sellerId: draft.sellerId,
            ...(values.minimumOrderAmount === null ? { minimumOrderAmount: undefined } : {}),
            ...(values.maximumRedemptions === null ? { maximumRedemptions: undefined } : {}),
            ...(values.startsAt === undefined ? { startsAt: undefined } : {}),
            ...(values.expiresAt === null ? { expiresAt: undefined } : {})
          });
      setCoupons((current) => editingId
        ? current.map((coupon) => coupon.id === editingId ? response.data : coupon)
        : sellerFilter && sellerFilter !== response.data.seller.id ? current : [response.data, ...current]);
      resetForm();
    } catch (error) {
      setFormError(errorMessage(error, c.saveError));
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(coupon: AdminSellerCoupon) {
    if (!window.confirm(c.confirmDelete)) return;
    setDeletingId(coupon.id);
    setListError("");
    try {
      await api.delete(`/coupons/admin/${coupon.id}`);
      setCoupons((current) => current.filter((item) => item.id !== coupon.id));
      if (editingId === coupon.id) resetForm();
    } catch (error) {
      setListError(errorMessage(error, c.deleteError));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className={styles.workspace} aria-labelledby="admin-coupons-title">
      <header className={styles.hero}>
        <span>{c.eyebrow}</span>
        <h1 id="admin-coupons-title">{c.title}</h1>
        <p>{c.intro}</p>
      </header>

      <form id="admin-coupon-form" className={styles.form} onSubmit={submit} aria-busy={submitting}>
        <div className={styles.formHeader}>
          <h2>{editingId ? c.editTitle : c.createTitle}</h2>
          {editingId ? <button type="button" onClick={resetForm}>{c.cancel}</button> : null}
        </div>
        <div className={styles.fields}>
          <label><span>{c.seller}</span><select required disabled={Boolean(editingId)} value={draft.sellerId} onChange={(event) => update("sellerId", event.target.value)}><option value="" disabled>{c.seller}</option>{vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.shopName}</option>)}</select></label>
          <label><span>{c.code}</span><input required minLength={3} maxLength={32} pattern="[A-Za-z0-9][A-Za-z0-9_-]{2,31}" value={draft.code} onChange={(event) => update("code", event.target.value.toUpperCase())} /></label>
          <label><span>{c.type}</span><select value={draft.discountType} onChange={(event) => update("discountType", event.target.value as CouponDiscountType)}><option value="percentage">{c.percentage}</option><option value="fixed">{c.fixed}</option></select></label>
          <label><span>{c.value}</span><input required inputMode="decimal" pattern="(?:0|[1-9][0-9]*)(?:\.[0-9]{1,4})?" value={draft.discountValue} onChange={(event) => update("discountValue", event.target.value)} /></label>
          <label><span>{c.currency}</span><strong>تومان</strong></label>
          <label><span>{c.minimum} <small>{c.optional}</small></span><input inputMode="decimal" pattern="(?:0|[1-9][0-9]*)(?:\.[0-9]{1,4})?" value={draft.minimumOrderAmount} onChange={(event) => update("minimumOrderAmount", event.target.value)} /></label>
          <label><span>{c.maximum} <small>{c.optional}</small></span><input type="number" min="1" max="1000000000" value={draft.maximumRedemptions} onChange={(event) => update("maximumRedemptions", event.target.value)} /></label>
          <label><span>{c.starts} <small>{c.optional}</small></span><input type="datetime-local" value={draft.startsAt} onChange={(event) => update("startsAt", event.target.value)} /></label>
          <label><span>{c.expires} <small>{c.optional}</small></span><input type="datetime-local" value={draft.expiresAt} onChange={(event) => update("expiresAt", event.target.value)} /></label>
        </div>
        <div className={styles.formFooter}>
          <label className={styles.checkbox}><input type="checkbox" checked={draft.active} onChange={(event) => update("active", event.target.checked)} /><span>{c.active}</span></label>
          <p role="alert">{formError}</p>
          <button className={styles.primary} type="submit" disabled={submitting || vendors.length === 0}>{submitting ? c.submitting : editingId ? c.save : c.create}</button>
        </div>
      </form>

      <div className={styles.listHeader}>
        <label><span>{c.seller}</span><select value={sellerFilter} onChange={(event) => setSellerFilter(event.target.value)}><option value="">{c.allSellers}</option>{vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.shopName}</option>)}</select></label>
      </div>

      <div className={styles.list} aria-busy={loading}>
        {listError ? <div className={styles.message} role="alert"><p>{listError}</p><button type="button" onClick={() => void loadCoupons()}>{c.retry}</button></div> : null}
        {!listError && loading && coupons.length === 0 ? <p className={styles.message}>{c.loading}</p> : null}
        {!listError && !loading && coupons.length === 0 ? <p className={styles.message}>{c.empty}</p> : null}
        {coupons.map((coupon) => (
          <article className={styles.coupon} key={coupon.id}>
            <div className={styles.couponLead}><small>{coupon.seller.shopName}</small><strong>{coupon.code}</strong><span>{coupon.discountType === "percentage" ? `${coupon.discountValue}%` : `${formatCurrencyAmount(coupon.discountValue, coupon.currency, locale)} ${currencyLabel(coupon.currency)}`}</span></div>
            <dl>
              <div><dt>{c.status}</dt><dd data-active={coupon.active}>{coupon.active ? c.enabled : c.disabled}</dd></div>
              <div><dt>{c.redemptions}</dt><dd>{coupon.redeemedCount} / {coupon.maximumRedemptions ?? c.noLimit}</dd></div>
              <div><dt>{c.schedule}</dt><dd>{new Date(coupon.startsAt).toLocaleDateString(locale)} – {coupon.expiresAt ? new Date(coupon.expiresAt).toLocaleDateString(locale) : c.noExpiry}</dd></div>
            </dl>
            <div className={styles.rowActions}><button type="button" onClick={() => beginEdit(coupon)}>{c.edit}</button><button className={styles.danger} type="button" disabled={deletingId === coupon.id} onClick={() => void remove(coupon)}>{c.remove}</button></div>
          </article>
        ))}
        {nextCursor ? <button className={styles.more} type="button" disabled={loading} onClick={() => void loadCoupons(nextCursor)}>{c.more}</button> : null}
      </div>
    </section>
  );
}
