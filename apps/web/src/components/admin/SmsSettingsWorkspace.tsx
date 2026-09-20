"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { AdminSmsSettings } from "@topgsm/shared-types";
import type { Locale } from "@/lib/i18n";
import { api } from "@/lib/api/client";
import styles from "./SmsSettingsWorkspace.module.css";

const copy = {
  en: {
    eyebrow: "Platform settings / SMS",
    title: "SMS settings",
    intro: "Control which SMS-backed features are available across the storefront.",
    providerTitle: "SMS.ir credentials",
    providerHint: "The API key is encrypted before storage and is never returned to this browser. Leave it blank to keep the current key.",
    apiKey: "API key",
    apiKeyConfigured: "Configured · ending in {hint}",
    apiKeyMissing: "No API key configured",
    environmentSource: "Currently supplied by the deployment environment. Saving a new key moves the active credential into encrypted database storage.",
    databaseSource: "Stored encrypted in the database.",
    otpTemplate: "OTP template ID",
    sellerTemplate: "New-order seller template ID",
    buyerSuccessTemplate: "Buyer success template ID",
    buyerFailureTemplate: "Buyer failure template ID",
    templateHint: "Use the numeric template IDs from your SMS.ir account.",
    otpTitle: "One-time password sign-in",
    testModeTitle: "SMS test mode",
    testModeHint: "Print SMS details, including one-time codes, in the API console instead of sending them. Anyone with access to those logs can read the codes.",
    testModeEnabled: "Test mode is on",
    testModeDisabled: "Test mode is off",
    otpHint: "Allow customers to request and verify a six-digit SMS code during checkout.",
    enabled: "OTP is enabled",
    disabled: "OTP is disabled",
    warning: "Disabling OTP stops new requests and rejects verification of existing codes. Customers who are not signed in will not be able to complete OTP checkout.",
    save: "Save SMS settings",
    saving: "Saving…",
    saved: "SMS settings saved.",
    noChanges: "No unsaved changes",
    retry: "Try again",
    loadError: "SMS settings could not be loaded. Refresh and try again.",
    saveError: "SMS settings could not be saved. Try again.",
    updated: "Last changed {date}"
  },
  fa: {
    eyebrow: "تنظیمات پلتفرم / پیامک",
    title: "تنظیمات پیامک",
    intro: "قابلیت‌های وابسته به پیامک را در سراسر فروشگاه مدیریت کنید.",
    providerTitle: "اطلاعات اتصال SMS.ir",
    providerHint: "کلید API پیش از ذخیره رمزنگاری می‌شود و هرگز به مرورگر برگردانده نمی‌شود. برای نگه‌داشتن کلید فعلی، این فیلد را خالی بگذارید.",
    apiKey: "کلید API",
    apiKeyConfigured: "تنظیم شده · چهار نویسه پایانی {hint}",
    apiKeyMissing: "کلید API تنظیم نشده است",
    environmentSource: "کلید فعلی از تنظیمات محیط اجرا خوانده می‌شود. با ذخیره کلید جدید، اطلاعات فعال به‌صورت رمزنگاری‌شده در پایگاه داده نگهداری می‌شود.",
    databaseSource: "به‌صورت رمزنگاری‌شده در پایگاه داده ذخیره شده است.",
    otpTemplate: "شناسه قالب رمز یک‌بارمصرف",
    sellerTemplate: "شناسه قالب سفارش جدید برای فروشنده",
    buyerSuccessTemplate: "شناسه قالب موفقیت برای خریدار",
    buyerFailureTemplate: "شناسه قالب ناموفق برای خریدار",
    templateHint: "شناسه‌های عددی قالب را از حساب SMS.ir وارد کنید.",
    otpTitle: "ورود با رمز یک‌بارمصرف",
    testModeTitle: "حالت آزمایشی پیامک",
    testModeHint: "جزئیات پیامک، از جمله کدهای یک‌بارمصرف، به‌جای ارسال در کنسول API چاپ می‌شود. افراد دارای دسترسی به گزارش‌ها می‌توانند کدها را بخوانند.",
    testModeEnabled: "حالت آزمایشی روشن است",
    testModeDisabled: "حالت آزمایشی خاموش است",
    otpHint: "به مشتری اجازه دهید هنگام خرید کد شش‌رقمی پیامکی دریافت و تأیید کند.",
    enabled: "رمز یک‌بارمصرف فعال است",
    disabled: "رمز یک‌بارمصرف غیرفعال است",
    warning: "با غیرفعال‌سازی، درخواست کد جدید و تأیید کدهای صادرشده متوقف می‌شود. مشتری واردنشده نمی‌تواند خرید مبتنی بر رمز یک‌بارمصرف را تکمیل کند.",
    save: "ذخیره تنظیمات پیامک",
    saving: "در حال ذخیره…",
    saved: "تنظیمات پیامک ذخیره شد.",
    noChanges: "تغییر ذخیره‌نشده‌ای وجود ندارد",
    retry: "تلاش دوباره",
    loadError: "تنظیمات پیامک بارگذاری نشد. صفحه را تازه کنید.",
    saveError: "تنظیمات پیامک ذخیره نشد. دوباره تلاش کنید.",
    updated: "آخرین تغییر: {date}"
  },
  ar: {
    eyebrow: "إعدادات المنصة / الرسائل النصية",
    title: "إعدادات الرسائل النصية",
    intro: "تحكم في الميزات التي تعتمد على الرسائل النصية في المتجر.",
    providerTitle: "بيانات اعتماد SMS.ir",
    providerHint: "يُشفّر مفتاح API قبل التخزين ولا يُعاد إلى المتصفح. اتركه فارغاً للاحتفاظ بالمفتاح الحالي.",
    apiKey: "مفتاح API",
    apiKeyConfigured: "تم الإعداد · ينتهي بـ {hint}",
    apiKeyMissing: "لم يتم إعداد مفتاح API",
    environmentSource: "المفتاح الحالي مقدم من بيئة التشغيل. يؤدي حفظ مفتاح جديد إلى نقله إلى تخزين قاعدة البيانات المشفر.",
    databaseSource: "مخزن بشكل مشفر في قاعدة البيانات.",
    otpTemplate: "معرّف قالب OTP",
    sellerTemplate: "معرّف قالب الطلب الجديد للبائع",
    buyerSuccessTemplate: "معرّف قالب نجاح المشتري",
    buyerFailureTemplate: "معرّف قالب فشل المشتري",
    templateHint: "أدخل معرّفات القوالب الرقمية من حساب SMS.ir.",
    otpTitle: "تسجيل الدخول برمز لمرة واحدة",
    testModeTitle: "وضع اختبار الرسائل",
    testModeHint: "تُطبع تفاصيل الرسائل، بما فيها رموز الدخول، في سجل API بدلاً من إرسالها. يمكن لمن يصل إلى السجل قراءة الرموز.",
    testModeEnabled: "وضع الاختبار مفعّل",
    testModeDisabled: "وضع الاختبار معطّل",
    otpHint: "اسمح للعملاء بطلب رمز من ستة أرقام والتحقق منه أثناء الدفع.",
    enabled: "رمز OTP مفعّل",
    disabled: "رمز OTP معطّل",
    warning: "يؤدي التعطيل إلى إيقاف الطلبات الجديدة ورفض التحقق من الرموز الحالية. لن يتمكن العميل غير المسجل من إكمال الدفع عبر OTP.",
    save: "حفظ إعدادات الرسائل",
    saving: "جارٍ الحفظ…",
    saved: "تم حفظ إعدادات الرسائل النصية.",
    noChanges: "لا توجد تغييرات غير محفوظة",
    retry: "حاول مجدداً",
    loadError: "تعذر تحميل إعدادات الرسائل. حدّث الصفحة وحاول مجدداً.",
    saveError: "تعذر حفظ إعدادات الرسائل. حاول مجدداً.",
    updated: "آخر تغيير: {date}"
  }
} as const;

export function SmsSettingsWorkspace({ locale }: { locale: Locale }) {
  const c = copy[locale];
  const [saved, setSaved] = useState<AdminSmsSettings | null>(null);
  const [otpEnabled, setOtpEnabled] = useState(true);
  const [testModeEnabled, setTestModeEnabled] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [templateIds, setTemplateIds] = useState({
    otp: "",
    sellerNewOrder: "",
    buyerSuccess: "",
    buyerFailure: ""
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await api.get<AdminSmsSettings>("/admin/settings/sms");
      setSaved(response.data);
      setOtpEnabled(response.data.otpEnabled);
      setTestModeEnabled(response.data.testModeEnabled);
      setApiKey("");
      setTemplateIds(Object.fromEntries(
        Object.entries(response.data.templateIds).map(([key, value]) => [key, value?.toString() ?? ""])
      ) as typeof templateIds);
    } catch {
      setError(c.loadError);
    } finally {
      setLoading(false);
    }
  }, [c.loadError]);

  useEffect(() => {
    void load();
  }, [load]);

  const numberOrNull = (value: string) => value === "" ? null : Number(value);
  const dirty = saved !== null && (
    saved.otpEnabled !== otpEnabled ||
    saved.testModeEnabled !== testModeEnabled ||
    apiKey.trim().length > 0 ||
    (Object.keys(templateIds) as Array<keyof typeof templateIds>).some(
      (key) => saved.templateIds[key] !== numberOrNull(templateIds[key])
    )
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dirty) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await api.patch<AdminSmsSettings>("/admin/settings/sms", {
        otpEnabled,
        testModeEnabled,
        ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
        otpTemplateId: numberOrNull(templateIds.otp),
        sellerNewOrderTemplateId: numberOrNull(templateIds.sellerNewOrder),
        buyerSuccessTemplateId: numberOrNull(templateIds.buyerSuccess),
        buyerFailureTemplateId: numberOrNull(templateIds.buyerFailure)
      });
      setSaved(response.data);
      setOtpEnabled(response.data.otpEnabled);
      setTestModeEnabled(response.data.testModeEnabled);
      setApiKey("");
      setTemplateIds(Object.fromEntries(
        Object.entries(response.data.templateIds).map(([key, value]) => [key, value?.toString() ?? ""])
      ) as typeof templateIds);
      setMessage(c.saved);
    } catch {
      setError(c.saveError);
    } finally {
      setSaving(false);
    }
  }

  const updatedLabel = saved?.updatedAt
    ? c.updated.replace("{date}", new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(saved.updatedAt)))
    : null;

  return (
    <section className={styles.workspace} aria-labelledby="sms-settings-title">
      <header className={styles.header}>
        <span>{c.eyebrow}</span>
        <h1 id="sms-settings-title">{c.title}</h1>
        <p>{c.intro}</p>
      </header>

      {loading ? (
        <div className={styles.skeleton} aria-label={c.intro} aria-busy="true"><i /><i /></div>
      ) : error && !saved ? (
        <div className={styles.error} role="alert"><p>{error}</p><button type="button" onClick={() => void load()}>{c.retry}</button></div>
      ) : (
        <form className={styles.form} onSubmit={submit}>
          <section className={styles.credentials} aria-labelledby="sms-provider-title">
            <div>
              <h2 id="sms-provider-title">{c.providerTitle}</h2>
              <p>{c.providerHint}</p>
              <strong data-configured={saved?.apiKeyConfigured}>
                {saved?.apiKeyConfigured
                  ? c.apiKeyConfigured.replace("{hint}", saved.apiKeyHint ?? "••••")
                  : c.apiKeyMissing}
              </strong>
              {saved?.credentialSource !== "none" ? (
                <small>{saved?.credentialSource === "environment" ? c.environmentSource : c.databaseSource}</small>
              ) : null}
            </div>
            <label>
              <span>{c.apiKey}</span>
              <input
                type="password"
                value={apiKey}
                minLength={8}
                maxLength={2000}
                autoComplete="new-password"
                spellCheck={false}
                disabled={saving}
                onChange={(event) => {
                  setApiKey(event.target.value);
                  setMessage("");
                  setError("");
                }}
              />
            </label>
            <fieldset>
              <legend>{c.templateHint}</legend>
              {([
                ["otp", c.otpTemplate],
                ["sellerNewOrder", c.sellerTemplate],
                ["buyerSuccess", c.buyerSuccessTemplate],
                ["buyerFailure", c.buyerFailureTemplate]
              ] as const).map(([key, label]) => (
                <label key={key}>
                  <span>{label}</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={2_147_483_647}
                    value={templateIds[key]}
                    disabled={saving}
                    onChange={(event) => {
                      setTemplateIds((current) => ({ ...current, [key]: event.target.value }));
                      setMessage("");
                      setError("");
                    }}
                  />
                </label>
              ))}
            </fieldset>
          </section>

          <div className={styles.settingRow}>
            <div>
              <h2>{c.otpTitle}</h2>
              <p>{c.otpHint}</p>
              <strong data-enabled={otpEnabled}>{otpEnabled ? c.enabled : c.disabled}</strong>
            </div>
            <label className={styles.toggle}>
              <span className={styles.visuallyHidden}>{c.otpTitle}</span>
              <input
                type="checkbox"
                checked={otpEnabled}
                disabled={saving}
                onChange={(event) => {
                  setOtpEnabled(event.target.checked);
                  setMessage("");
                  setError("");
                }}
              />
              <span aria-hidden="true"><i /></span>
            </label>
          </div>

          {!otpEnabled ? <p className={styles.warning}>{c.warning}</p> : null}
          <div className={styles.settingRow}>
            <div>
              <h2>{c.testModeTitle}</h2>
              <p>{c.testModeHint}</p>
              <strong data-enabled={testModeEnabled}>{testModeEnabled ? c.testModeEnabled : c.testModeDisabled}</strong>
            </div>
            <label className={styles.toggle}>
              <span className={styles.visuallyHidden}>{c.testModeTitle}</span>
              <input
                type="checkbox"
                checked={testModeEnabled}
                disabled={saving}
                onChange={(event) => {
                  setTestModeEnabled(event.target.checked);
                  setMessage("");
                  setError("");
                }}
              />
              <span aria-hidden="true"><i /></span>
            </label>
          </div>
          <footer className={styles.actions}>
            <div aria-live="polite">
              {error ? <span className={styles.errorText}>{error}</span> : null}
              {!error && message ? <span className={styles.success}>{message}</span> : null}
              {!error && !message ? <span>{dirty ? "" : c.noChanges}</span> : null}
              {updatedLabel ? <small>{updatedLabel}</small> : null}
            </div>
            <button type="submit" disabled={!dirty || saving}>{saving ? c.saving : c.save}</button>
          </footer>
        </form>
      )}
    </section>
  );
}
