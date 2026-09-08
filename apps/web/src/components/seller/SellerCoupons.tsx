"use client";

import axios from "axios";
import type {
  CouponDiscountType,
  SellerCoupon,
  SellerCouponsPage
} from "@topgsm/shared-types";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api/client";
import type { Locale } from "@/lib/i18n";
import styles from "./SellerCoupons.module.css";

const copy = {
  en: {
    title: "Coupons",
    description: "Create seller-scoped discount codes for eligible orders.",
    create: "Create coupon",
    creating: "Creating…",
    code: "Coupon code",
    type: "Discount type",
    percentage: "Percentage",
    fixed: "Fixed amount",
    value: "Discount value",
    currency: "Currency",
    minimum: "Minimum order amount (optional)",
    maximum: "Maximum redemptions (optional)",
    starts: "Starts at (optional)",
    expires: "Expires at (optional)",
    active: "Coupon is active",
    status: "Status",
    schedule: "Schedule",
    redemptions: "Redemptions",
    noLimit: "No limit",
    noExpiry: "No expiry",
    enabled: "Active",
    disabled: "Inactive",
    empty: "No coupons yet. Create the first discount code for this shop.",
    loading: "Loading coupons…",
    loadError: "Coupons could not be loaded. Check your access and try again.",
    createError: "The coupon could not be created. Review the values and try again.",
    retry: "Try again",
    more: "Load more"
  },
  fa: {
    title: "کدهای تخفیف",
    description: "برای سفارش‌های واجد شرایط، کد تخفیف مخصوص فروشگاه بسازید.",
    create: "ساخت کد تخفیف",
    creating: "در حال ساخت…",
    code: "کد تخفیف",
    type: "نوع تخفیف",
    percentage: "درصدی",
    fixed: "مبلغ ثابت",
    value: "مقدار تخفیف",
    currency: "واحد پول",
    minimum: "حداقل مبلغ سفارش (اختیاری)",
    maximum: "حداکثر دفعات استفاده (اختیاری)",
    starts: "زمان شروع (اختیاری)",
    expires: "زمان پایان (اختیاری)",
    active: "کد تخفیف فعال باشد",
    status: "وضعیت",
    schedule: "بازه زمانی",
    redemptions: "دفعات استفاده",
    noLimit: "بدون محدودیت",
    noExpiry: "بدون انقضا",
    enabled: "فعال",
    disabled: "غیرفعال",
    empty: "هنوز کد تخفیفی ندارید. اولین کد فروشگاه را بسازید.",
    loading: "در حال بارگذاری کدها…",
    loadError: "کدهای تخفیف بارگذاری نشدند. دسترسی خود را بررسی کنید.",
    createError: "کد تخفیف ساخته نشد. مقادیر را بررسی و دوباره تلاش کنید.",
    retry: "تلاش دوباره",
    more: "نمایش بیشتر"
  },
  ar: {
    title: "القسائم",
    description: "أنشئ رموز خصم خاصة بالمتجر للطلبات المؤهلة.",
    create: "إنشاء قسيمة",
    creating: "جارٍ الإنشاء…",
    code: "رمز القسيمة",
    type: "نوع الخصم",
    percentage: "نسبة مئوية",
    fixed: "مبلغ ثابت",
    value: "قيمة الخصم",
    currency: "العملة",
    minimum: "الحد الأدنى للطلب (اختياري)",
    maximum: "الحد الأقصى للاستخدام (اختياري)",
    starts: "يبدأ في (اختياري)",
    expires: "ينتهي في (اختياري)",
    active: "القسيمة نشطة",
    status: "الحالة",
    schedule: "الجدول",
    redemptions: "الاستخدامات",
    noLimit: "بلا حد",
    noExpiry: "بلا انتهاء",
    enabled: "نشطة",
    disabled: "غير نشطة",
    empty: "لا توجد قسائم بعد. أنشئ أول رمز خصم للمتجر.",
    loading: "جارٍ تحميل القسائم…",
    loadError: "تعذر تحميل القسائم. تحقق من صلاحياتك وحاول مجدداً.",
    createError: "تعذر إنشاء القسيمة. راجع القيم وحاول مجدداً.",
    retry: "حاول مجدداً",
    more: "تحميل المزيد"
  }
} as const;

type CouponDraft = {
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
  code: "",
  discountType: "percentage",
  discountValue: "",
  currency: "IRR",
  minimumOrderAmount: "",
  maximumRedemptions: "",
  startsAt: "",
  expiresAt: "",
  active: true
};

function errorMessage(error: unknown, fallback: string) {
  if (!axios.isAxiosError(error)) return fallback;
  const message = error.response?.data?.message;
  return Array.isArray(message)
    ? message.join(" ")
    : typeof message === "string" ? message : fallback;
}

function toIso(value: string) {
  return value ? new Date(value).toISOString() : undefined;
}

export function SellerCoupons({ locale }: { locale: Locale }) {
  const c = copy[locale];
  const [coupons, setCoupons] = useState<SellerCoupon[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [draft, setDraft] = useState<CouponDraft>(emptyDraft);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [listError, setListError] = useState("");
  const [formError, setFormError] = useState("");

  const load = useCallback(async (cursor?: string) => {
    setLoading(true);
    setListError("");
    try {
      const response = await api.get<SellerCouponsPage>("/coupons/mine", {
        params: { limit: 20, ...(cursor ? { cursor } : {}) }
      });
      setCoupons((current) => cursor
        ? [...current, ...response.data.items]
        : response.data.items);
      setNextCursor(response.data.nextCursor);
    } catch (error) {
      setListError(errorMessage(error, c.loadError));
    } finally {
      setLoading(false);
    }
  }, [c.loadError]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  function update<K extends keyof CouponDraft>(key: K, value: CouponDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setFormError("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setFormError("");
    try {
      const response = await api.post<SellerCoupon>("/coupons", {
        code: draft.code.trim(),
        discountType: draft.discountType,
        discountValue: draft.discountValue.trim(),
        currency: draft.currency.trim(),
        ...(draft.minimumOrderAmount.trim()
          ? { minimumOrderAmount: draft.minimumOrderAmount.trim() }
          : {}),
        ...(draft.maximumRedemptions
          ? { maximumRedemptions: Number(draft.maximumRedemptions) }
          : {}),
        ...(draft.startsAt ? { startsAt: toIso(draft.startsAt) } : {}),
        ...(draft.expiresAt ? { expiresAt: toIso(draft.expiresAt) } : {}),
        active: draft.active
      });
      setCoupons((current) => [response.data, ...current]);
      setDraft(emptyDraft);
    } catch (error) {
      setFormError(errorMessage(error, c.createError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className={styles.layout} aria-labelledby="coupons-title">
      <div className={styles.heading}>
        <h2 id="coupons-title">{c.title}</h2>
        <p>{c.description}</p>
      </div>

      <form className={styles.form} onSubmit={submit} aria-busy={submitting}>
        <div className={styles.grid}>
          <label><span>{c.code}</span><input required minLength={3} maxLength={32} pattern="[A-Za-z0-9][A-Za-z0-9_-]{2,31}" value={draft.code} onChange={(event) => update("code", event.target.value.toUpperCase())} /></label>
          <label><span>{c.type}</span><select value={draft.discountType} onChange={(event) => update("discountType", event.target.value as CouponDiscountType)}><option value="percentage">{c.percentage}</option><option value="fixed">{c.fixed}</option></select></label>
          <label><span>{c.value}</span><input required inputMode="decimal" pattern="(?:0|[1-9][0-9]*)(?:\.[0-9]{1,4})?" value={draft.discountValue} onChange={(event) => update("discountValue", event.target.value)} /></label>
          <label><span>{c.currency}</span><input required minLength={3} maxLength={3} pattern="[A-Za-z]{3}" value={draft.currency} onChange={(event) => update("currency", event.target.value.toUpperCase())} /></label>
          <label><span>{c.minimum}</span><input inputMode="decimal" pattern="(?:0|[1-9][0-9]*)(?:\.[0-9]{1,4})?" value={draft.minimumOrderAmount} onChange={(event) => update("minimumOrderAmount", event.target.value)} /></label>
          <label><span>{c.maximum}</span><input type="number" min="1" max="1000000000" value={draft.maximumRedemptions} onChange={(event) => update("maximumRedemptions", event.target.value)} /></label>
          <label><span>{c.starts}</span><input type="datetime-local" value={draft.startsAt} onChange={(event) => update("startsAt", event.target.value)} /></label>
          <label><span>{c.expires}</span><input type="datetime-local" value={draft.expiresAt} onChange={(event) => update("expiresAt", event.target.value)} /></label>
        </div>
        <label className={styles.checkbox}><input type="checkbox" checked={draft.active} onChange={(event) => update("active", event.target.checked)} /><span>{c.active}</span></label>
        <div className={styles.actions}>
          <p role="alert">{formError}</p>
          <button type="submit" disabled={submitting}>{submitting ? c.creating : c.create}</button>
        </div>
      </form>

      <div className={styles.list}>
        {listError ? <div className={styles.message} role="alert"><p>{listError}</p><button type="button" onClick={() => void load()}>{c.retry}</button></div> : null}
        {!listError && loading && coupons.length === 0 ? <p className={styles.message}>{c.loading}</p> : null}
        {!listError && !loading && coupons.length === 0 ? <p className={styles.message}>{c.empty}</p> : null}
        {coupons.map((coupon) => (
          <article className={styles.coupon} key={coupon.id}>
            <div><strong>{coupon.code}</strong><span>{coupon.discountType === "percentage" ? `${coupon.discountValue}%` : `${coupon.discountValue} ${coupon.currency}`}</span></div>
            <dl>
              <div><dt>{c.status}</dt><dd>{coupon.active ? c.enabled : c.disabled}</dd></div>
              <div><dt>{c.redemptions}</dt><dd>{coupon.redeemedCount} / {coupon.maximumRedemptions ?? c.noLimit}</dd></div>
              <div><dt>{c.schedule}</dt><dd>{new Date(coupon.startsAt).toLocaleDateString(locale)} – {coupon.expiresAt ? new Date(coupon.expiresAt).toLocaleDateString(locale) : c.noExpiry}</dd></div>
            </dl>
          </article>
        ))}
        {nextCursor ? <button className={styles.more} type="button" disabled={loading} onClick={() => void load(nextCursor)}>{c.more}</button> : null}
      </div>
    </section>
  );
}
