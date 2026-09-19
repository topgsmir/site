"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { AdminShippingSettings } from "@topgsm/shared-types";
import type { Locale } from "@/lib/i18n";
import { api } from "@/lib/api/client";
import { AdminSellerShippingProfiles } from "./AdminSellerShippingProfiles";
import styles from "./SmsSettingsWorkspace.module.css";

const copy = {
  en: {
    eyebrow: "Platform settings / Shipping", title: "Shipping settings", intro: "Configure Amadast fulfilment for physical marketplace orders.",
    credentials: "Amadast connection", credentialHint: "The client code is encrypted before storage and is never returned to this browser. Leave it blank to keep the current code.",
    clientCode: "Client code", configured: "Configured · ending in {hint}", missing: "No client code configured", environment: "Currently supplied by the deployment environment. Saving a new code moves it to encrypted database storage.", database: "Stored encrypted in the database.",
    userId: "Amadast user ID", storeId: "Amadast store ID", productType: "Product type ID", packageType: "Package type ID",
    enabledTitle: "Amadast shipping", enabledHint: "Allow sellers to register physical orders and refresh courier tracking from Amadast.", enabled: "Shipping is enabled", disabled: "Shipping is disabled", warning: "Disabling Amadast removes the seller action but keeps existing shipment and tracking records.",
    save: "Save shipping settings", saving: "Saving…", saved: "Shipping settings saved.", noChanges: "No unsaved changes", retry: "Try again", loadError: "Shipping settings could not be loaded.", saveError: "Shipping settings could not be saved. Review the required IDs and try again.", updated: "Last changed {date}"
  },
  fa: {
    eyebrow: "تنظیمات پلتفرم / ارسال", title: "تنظیمات ارسال", intro: "اتصال آمادست را برای ارسال سفارش‌های فیزیکی بازار تنظیم کنید.",
    credentials: "اتصال آمادست", credentialHint: "کد کلاینت پیش از ذخیره رمزنگاری می‌شود و هرگز به مرورگر برگردانده نمی‌شود. برای نگه‌داشتن کد فعلی، این فیلد را خالی بگذارید.",
    clientCode: "کد کلاینت", configured: "تنظیم شده · چهار نویسه پایانی {hint}", missing: "کد کلاینت تنظیم نشده است", environment: "کد فعلی از محیط اجرا خوانده می‌شود. با ذخیره کد جدید، مقدار فعال به‌صورت رمزنگاری‌شده در پایگاه داده نگهداری می‌شود.", database: "به‌صورت رمزنگاری‌شده در پایگاه داده ذخیره شده است.",
    userId: "شناسه کاربر آمادست", storeId: "شناسه فروشگاه آمادست", productType: "شناسه نوع محصول", packageType: "شناسه نوع بسته‌بندی",
    enabledTitle: "ارسال با آمادست", enabledHint: "به فروشنده‌ها اجازه دهید سفارش فیزیکی را در آمادست ثبت و کد رهگیری را دریافت کنند.", enabled: "ارسال فعال است", disabled: "ارسال غیرفعال است", warning: "با غیرفعال‌سازی، گزینه آمادست از سفارش‌های فروشنده حذف می‌شود؛ سوابق ارسال و رهگیری باقی می‌مانند.",
    save: "ذخیره تنظیمات ارسال", saving: "در حال ذخیره…", saved: "تنظیمات ارسال ذخیره شد.", noChanges: "تغییر ذخیره‌نشده‌ای وجود ندارد", retry: "تلاش دوباره", loadError: "تنظیمات ارسال بارگذاری نشد.", saveError: "تنظیمات ارسال ذخیره نشد. شناسه‌های ضروری را بررسی کنید.", updated: "آخرین تغییر: {date}"
  },
  ar: {
    eyebrow: "إعدادات المنصة / الشحن", title: "إعدادات الشحن", intro: "قم بإعداد Amadast لشحن طلبات المنتجات المادية.",
    credentials: "اتصال Amadast", credentialHint: "يُشفّر رمز العميل قبل التخزين ولا يُعاد إلى المتصفح. اتركه فارغاً للاحتفاظ بالرمز الحالي.",
    clientCode: "رمز العميل", configured: "تم الإعداد · ينتهي بـ {hint}", missing: "لم يتم إعداد رمز العميل", environment: "الرمز الحالي مقدم من بيئة التشغيل. يؤدي حفظ رمز جديد إلى تخزينه مشفراً في قاعدة البيانات.", database: "مخزن بشكل مشفر في قاعدة البيانات.",
    userId: "معرّف مستخدم Amadast", storeId: "معرّف متجر Amadast", productType: "معرّف نوع المنتج", packageType: "معرّف نوع التغليف",
    enabledTitle: "الشحن عبر Amadast", enabledHint: "اسمح للبائعين بتسجيل الطلبات المادية وتحديث تتبع شركة الشحن.", enabled: "الشحن مفعّل", disabled: "الشحن معطّل", warning: "يؤدي التعطيل إلى إزالة إجراء Amadast من طلبات البائع مع الاحتفاظ بسجلات الشحن والتتبع.",
    save: "حفظ إعدادات الشحن", saving: "جارٍ الحفظ…", saved: "تم حفظ إعدادات الشحن.", noChanges: "لا توجد تغييرات غير محفوظة", retry: "حاول مجدداً", loadError: "تعذر تحميل إعدادات الشحن.", saveError: "تعذر حفظ إعدادات الشحن. راجع المعرّفات المطلوبة.", updated: "آخر تغيير: {date}"
  }
} as const;

type FormState = { userId: string; storeId: string; productType: string; packageType: string };
const fromSettings = (settings: AdminShippingSettings): FormState => ({
  userId: settings.userId?.toString() ?? "", storeId: settings.storeId?.toString() ?? "",
  productType: settings.productType.toString(), packageType: settings.packageType.toString()
});

export function ShippingSettingsWorkspace({ locale }: { locale: Locale }) {
  const c = copy[locale];
  const [saved, setSaved] = useState<AdminShippingSettings | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [clientCode, setClientCode] = useState("");
  const [form, setForm] = useState<FormState>({ userId: "", storeId: "", productType: "1", packageType: "1" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await api.get<AdminShippingSettings>("/admin/settings/shipping");
      setSaved(response.data); setEnabled(response.data.enabled); setClientCode(""); setForm(fromSettings(response.data));
    } catch { setError(c.loadError); } finally { setLoading(false); }
  }, [c.loadError]);
  useEffect(() => { void load(); }, [load]);

  const numberOrNull = (value: string) => value ? Number(value) : null;
  const dirty = saved !== null && (enabled !== saved.enabled || clientCode.trim().length > 0 || JSON.stringify(form) !== JSON.stringify(fromSettings(saved)));
  const change = (key: keyof FormState, value: string) => { setForm((current) => ({ ...current, [key]: value })); setMessage(""); setError(""); };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!dirty) return;
    setSaving(true); setError(""); setMessage("");
    try {
      const response = await api.patch<AdminShippingSettings>("/admin/settings/shipping", {
        enabled,
        ...(clientCode.trim() ? { clientCode: clientCode.trim() } : {}),
        userId: numberOrNull(form.userId), storeId: numberOrNull(form.storeId),
        productType: Number(form.productType), packageType: Number(form.packageType)
      });
      setSaved(response.data); setEnabled(response.data.enabled); setClientCode(""); setForm(fromSettings(response.data)); setMessage(c.saved);
    } catch { setError(c.saveError); } finally { setSaving(false); }
  }

  const updatedLabel = saved?.updatedAt ? c.updated.replace("{date}", new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(saved.updatedAt))) : null;
  return <section className={styles.workspace} aria-labelledby="shipping-settings-title">
    <header className={styles.header}><span>{c.eyebrow}</span><h1 id="shipping-settings-title">{c.title}</h1><p>{c.intro}</p></header>
    {loading ? <div className={styles.skeleton} aria-label={c.intro} aria-busy="true"><i /><i /></div> : error && !saved ? <div className={styles.error} role="alert"><p>{error}</p><button type="button" onClick={() => void load()}>{c.retry}</button></div> :
      <form className={styles.form} onSubmit={submit}>
        <section className={styles.credentials} aria-labelledby="shipping-provider-title">
          <div><h2 id="shipping-provider-title">{c.credentials}</h2><p>{c.credentialHint}</p><strong data-configured={saved?.clientCodeConfigured}>{saved?.clientCodeConfigured ? c.configured.replace("{hint}", saved.clientCodeHint ?? "••••") : c.missing}</strong>{saved?.credentialSource !== "none" ? <small>{saved?.credentialSource === "environment" ? c.environment : c.database}</small> : null}</div>
          <label><span>{c.clientCode}</span><input type="password" value={clientCode} minLength={4} maxLength={200} autoComplete="new-password" spellCheck={false} disabled={saving} onChange={(event) => { setClientCode(event.target.value); setMessage(""); setError(""); }} /></label>
          <fieldset><legend>{c.credentials}</legend>{([
            ["userId", c.userId, "number"], ["storeId", c.storeId, "number"], ["productType", c.productType, "number"], ["packageType", c.packageType, "number"]
          ] as const).map(([key, label, type]) => <label key={key}><span>{label}</span><input type={type} inputMode="numeric" min={1} max={2_147_483_647} value={form[key]} disabled={saving} onChange={(event) => change(key, event.target.value)} /></label>)}</fieldset>
        </section>
        <div className={styles.settingRow}><div><h2>{c.enabledTitle}</h2><p>{c.enabledHint}</p><strong data-enabled={enabled}>{enabled ? c.enabled : c.disabled}</strong></div><label className={styles.toggle}><span className={styles.visuallyHidden}>{c.enabledTitle}</span><input type="checkbox" checked={enabled} disabled={saving} onChange={(event) => { setEnabled(event.target.checked); setMessage(""); setError(""); }} /><span aria-hidden="true"><i /></span></label></div>
        {!enabled ? <p className={styles.warning}>{c.warning}</p> : null}
        <footer className={styles.actions}><div aria-live="polite">{error ? <span className={styles.errorText}>{error}</span> : null}{!error && message ? <span className={styles.success}>{message}</span> : null}{!error && !message ? <span>{dirty ? "" : c.noChanges}</span> : null}{updatedLabel ? <small>{updatedLabel}</small> : null}</div><button type="submit" disabled={!dirty || saving}>{saving ? c.saving : c.save}</button></footer>
      </form>}
    <AdminSellerShippingProfiles locale={locale} />
  </section>;
}
