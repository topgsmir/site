"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { AdminShippingSettings } from "@topgsm/shared-types";
import type { Locale } from "@/lib/i18n";
import { api } from "@/lib/api/client";
import { safeApiError, type SafeApiErrorCopy } from "@/lib/api/error";
import { AdminSellerShippingProfiles } from "./AdminSellerShippingProfiles";
import styles from "./SmsSettingsWorkspace.module.css";

const copy = {
  en: {
    eyebrow: "Platform settings / Shipping", title: "Shipping settings", intro: "Add the active shipping provider API key once. TopGSM provisions each seller automatically.",
    credentials: "Shipping API connection", credentialHint: "The API key is encrypted before storage and is never returned to this browser. Seller resources are provisioned automatically when they first ship an order.",
    clientCode: "API key", configured: "Configured · ending in {hint}", missing: "No API key configured", environment: "Currently supplied by the deployment environment. Saving a new key moves it to encrypted database storage.", database: "Stored encrypted in the database.",
    save: "Save API key", saving: "Saving…", saved: "Shipping API key saved.", noChanges: "Enter a new API key to replace the current one", retry: "Try again", loadError: "Shipping settings could not be loaded.", saveError: "The shipping API key could not be saved.", updated: "Last changed {date}"
  },
  fa: {
    eyebrow: "تنظیمات پلتفرم / ارسال", title: "تنظیمات ارسال", intro: "کلید API سرویس فعال ارسال را یک‌بار وارد کنید. تاپ‌جی‌اس‌ام منابع هر فروشنده را خودکار می‌سازد.",
    credentials: "اتصال API ارسال", credentialHint: "کلید API پیش از ذخیره رمزنگاری می‌شود و هرگز به مرورگر برگردانده نمی‌شود. منابع هر فروشنده هنگام اولین ارسال به‌صورت خودکار ساخته می‌شوند.",
    clientCode: "کلید API", configured: "تنظیم شده · چهار نویسه پایانی {hint}", missing: "کلید API تنظیم نشده است", environment: "کلید فعلی از محیط اجرا خوانده می‌شود. با ذخیره کلید جدید، مقدار فعال به‌صورت رمزنگاری‌شده در پایگاه داده نگهداری می‌شود.", database: "به‌صورت رمزنگاری‌شده در پایگاه داده ذخیره شده است.",
    save: "ذخیره کلید API", saving: "در حال ذخیره…", saved: "کلید API ارسال ذخیره شد.", noChanges: "برای جایگزینی، کلید API جدید را وارد کنید", retry: "تلاش دوباره", loadError: "تنظیمات ارسال بارگذاری نشد.", saveError: "کلید API ارسال ذخیره نشد.", updated: "آخرین تغییر: {date}"
  },
  ar: {
    eyebrow: "إعدادات المنصة / الشحن", title: "إعدادات الشحن", intro: "أدخل مفتاح API لمزود الشحن النشط مرة واحدة. ينشئ TopGSM موارد كل بائع تلقائياً.",
    credentials: "اتصال API للشحن", credentialHint: "يُشفّر مفتاح API قبل التخزين ولا يُعاد إلى المتصفح. تُنشأ موارد البائع تلقائياً عند أول عملية شحن.",
    clientCode: "مفتاح API", configured: "تم الإعداد · ينتهي بـ {hint}", missing: "لم يتم إعداد مفتاح API", environment: "المفتاح الحالي مقدم من بيئة التشغيل. يؤدي حفظ مفتاح جديد إلى تخزينه مشفراً في قاعدة البيانات.", database: "مخزن بشكل مشفر في قاعدة البيانات.",
    save: "حفظ مفتاح API", saving: "جارٍ الحفظ…", saved: "تم حفظ مفتاح API للشحن.", noChanges: "أدخل مفتاح API جديداً لاستبدال المفتاح الحالي", retry: "حاول مجدداً", loadError: "تعذر تحميل إعدادات الشحن.", saveError: "تعذر حفظ مفتاح API للشحن.", updated: "آخر تغيير: {date}"
  }
} as const;

const saveErrorCopy = {
  en: { fallback: "The shipping API key could not be saved.", network: "The API server could not be reached.", auth: "Your admin session has expired. Sign in again.", forbidden: "You do not have permission to change shipping settings.", validation: "Enter a valid shipping API key.", unavailable: "Secure credential storage is unavailable. Check the API encryption configuration.", rateLimited: "Too many attempts. Wait a moment and try again.", conflict: "The shipping settings changed elsewhere. Refresh and try again.", notFound: "Shipping settings are unavailable.", reference: "Reference" },
  fa: { fallback: "کلید API ارسال ذخیره نشد.", network: "ارتباط با سرور API برقرار نشد.", auth: "نشست مدیریتی شما منقضی شده است. دوباره وارد شوید.", forbidden: "اجازه تغییر تنظیمات ارسال را ندارید.", validation: "یک کلید API معتبر ارسال وارد کنید.", unavailable: "ذخیره امن کلید در دسترس نیست. تنظیمات رمزنگاری API را بررسی کنید.", rateLimited: "تعداد تلاش‌ها زیاد است. کمی صبر کنید و دوباره تلاش کنید.", conflict: "تنظیمات ارسال در جای دیگری تغییر کرده است. صفحه را تازه‌سازی کنید.", notFound: "تنظیمات ارسال در دسترس نیست.", reference: "شناسه پیگیری" },
  ar: { fallback: "تعذر حفظ مفتاح API للشحن.", network: "تعذر الاتصال بخادم API.", auth: "انتهت جلسة الإدارة. سجّل الدخول مجدداً.", forbidden: "ليس لديك إذن لتغيير إعدادات الشحن.", validation: "أدخل مفتاح API صالحاً للشحن.", unavailable: "التخزين الآمن لبيانات الاعتماد غير متاح. تحقق من إعدادات تشفير API.", rateLimited: "محاولات كثيرة. انتظر قليلاً ثم حاول مجدداً.", conflict: "تغيرت إعدادات الشحن في مكان آخر. حدّث الصفحة وحاول مجدداً.", notFound: "إعدادات الشحن غير متاحة.", reference: "المرجع" }
} satisfies Record<Locale, SafeApiErrorCopy>;

export function ShippingSettingsWorkspace({ locale }: { locale: Locale }) {
  const c = copy[locale];
  const [saved, setSaved] = useState<AdminShippingSettings | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await api.get<AdminShippingSettings>("/admin/settings/shipping");
      setSaved(response.data); setApiKey("");
    } catch { setError(c.loadError); } finally { setLoading(false); }
  }, [c.loadError]);
  useEffect(() => { void load(); }, [load]);

  const dirty = apiKey.trim().length >= 4;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!dirty) return;
    setSaving(true); setError(""); setMessage("");
    try {
      const response = await api.patch<AdminShippingSettings>("/admin/settings/shipping", {
        apiKey: apiKey.trim()
      });
      setSaved(response.data); setApiKey(""); setMessage(c.saved);
    } catch (cause) { setError(safeApiError(cause, saveErrorCopy[locale])); } finally { setSaving(false); }
  }

  const updatedLabel = saved?.updatedAt ? c.updated.replace("{date}", new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(saved.updatedAt))) : null;
  return <section className={styles.workspace} aria-labelledby="shipping-settings-title">
    <header className={styles.header}><span>{c.eyebrow}</span><h1 id="shipping-settings-title">{c.title}</h1><p>{c.intro}</p></header>
    {loading ? <div className={styles.skeleton} aria-label={c.intro} aria-busy="true"><i /><i /></div> : error && !saved ? <div className={styles.error} role="alert"><p>{error}</p><button type="button" onClick={() => void load()}>{c.retry}</button></div> :
      <form className={styles.form} onSubmit={submit}>
        <section className={styles.credentials} aria-labelledby="shipping-provider-title">
          <div><h2 id="shipping-provider-title">{c.credentials} · {saved?.providerName}</h2><p>{c.credentialHint}</p><strong data-configured={saved?.apiKeyConfigured}>{saved?.apiKeyConfigured ? c.configured.replace("{hint}", saved.apiKeyHint ?? "••••") : c.missing}</strong>{saved?.credentialSource !== "none" ? <small>{saved?.credentialSource === "environment" ? c.environment : c.database}</small> : null}</div>
          <label><span>{c.clientCode}</span><input required type="password" value={apiKey} minLength={4} maxLength={200} autoComplete="new-password" spellCheck={false} disabled={saving} onChange={(event) => { setApiKey(event.target.value); setMessage(""); setError(""); }} /></label>
        </section>
        <footer className={styles.actions}><div aria-live="polite">{error ? <span className={styles.errorText}>{error}</span> : null}{!error && message ? <span className={styles.success}>{message}</span> : null}{!error && !message ? <span>{dirty ? "" : c.noChanges}</span> : null}{updatedLabel ? <small>{updatedLabel}</small> : null}</div><button type="submit" disabled={!dirty || saving}>{saving ? c.saving : c.save}</button></footer>
      </form>}
    <AdminSellerShippingProfiles locale={locale} />
  </section>;
}
