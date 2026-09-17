"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import type { AdminUsdRateSettings, UsdRateProviderId } from "@topgsm/shared-types";
import type { Locale } from "@/lib/i18n";
import { api } from "@/lib/api/client";
import styles from "./UsdSettingsWorkspace.module.css";

const copy = {
  en: {
    eyebrow: "Platform settings / USD",
    title: "USD exchange rate",
    intro: "Choose the market source used to convert USD offers into integer IRR checkout totals.",
    automation: "Automatic refresh",
    automationHint: "Fetch the selected public market source every three hours. Disabling it keeps the last saved rate.",
    enabled: "Cron is enabled",
    disabled: "Cron is disabled",
    rate: "USD sell price",
    rateHint: "Enter the value in toman. One toman is converted to 10 IRR at checkout.",
    toman: "toman",
    irr: "IRR per USD",
    source: "Current source",
    sourceAuto: "AlanChand",
    sourceManual: "Manual override",
    providerTitle: "Automatic price source",
    providerHint: "Choose which source the scheduled refresh uses. Prices below are fetched independently.",
    selected: "Selected",
    select: "Use this source",
    available: "Live quote",
    unavailable: "Quote unavailable",
    providerError: "Provider error",
    openSource: "Open source",
    unknown: "No rate saved",
    status: "Cron status",
    never: "Waiting for first run",
    running: "Fetching now",
    success: "Healthy",
    failed: "Failed",
    cancelled: "Cancelled by an admin change",
    next: "Next run",
    attempt: "Last attempt",
    successAt: "Last successful fetch",
    failure: "Last failure",
    warning: "Automatic USD refresh failed. Checkout continues using the last saved rate; review the error and source before changing it manually.",
    errorCode: "Error code",
    save: "Save USD settings",
    saving: "Saving…",
    saved: "USD settings saved.",
    retry: "Try again",
    loadError: "USD settings could not be loaded.",
    saveError: "USD settings could not be saved.",
    sourceLink: "Open selected source",
    noChanges: "No unsaved changes"
  },
  fa: {
    eyebrow: "تنظیمات پلتفرم / دلار",
    title: "نرخ دلار",
    intro: "منبع بازار مورد استفاده برای تبدیل قیمت‌های دلاری به مبلغ صحیح ریالی در پرداخت را انتخاب کنید.",
    automation: "به‌روزرسانی خودکار",
    automationHint: "هر سه ساعت منبع عمومی انتخاب‌شده بررسی می‌شود. با غیرفعال‌سازی، آخرین نرخ ذخیره‌شده باقی می‌ماند.",
    enabled: "کرون فعال است",
    disabled: "کرون غیرفعال است",
    rate: "قیمت فروش دلار",
    rateHint: "مبلغ را به تومان وارد کنید؛ هر تومان هنگام پرداخت به ۱۰ ریال تبدیل می‌شود.",
    toman: "تومان",
    irr: "ریال برای هر دلار",
    source: "منبع نرخ فعلی",
    sourceAuto: "الان‌چند",
    sourceManual: "ثبت دستی",
    providerTitle: "منبع خودکار قیمت",
    providerHint: "منبع به‌روزرسانی زمان‌بندی‌شده را انتخاب کنید. قیمت هر منبع جداگانه دریافت می‌شود.",
    selected: "انتخاب‌شده",
    select: "استفاده از این منبع",
    available: "قیمت لحظه‌ای",
    unavailable: "قیمت در دسترس نیست",
    providerError: "خطای منبع",
    openSource: "مشاهده منبع",
    unknown: "هنوز نرخی ذخیره نشده",
    status: "وضعیت کرون",
    never: "در انتظار اولین اجرا",
    running: "در حال دریافت",
    success: "سالم",
    failed: "ناموفق",
    cancelled: "به‌دلیل تغییر مدیر لغو شد",
    next: "اجرای بعدی",
    attempt: "آخرین تلاش",
    successAt: "آخرین دریافت موفق",
    failure: "آخرین خطا",
    warning: "به‌روزرسانی خودکار نرخ دلار ناموفق بود. پرداخت با آخرین نرخ ذخیره‌شده ادامه می‌یابد؛ پیش از ثبت دستی، خطا و منبع را بررسی کنید.",
    errorCode: "کد خطا",
    save: "ذخیره تنظیمات دلار",
    saving: "در حال ذخیره…",
    saved: "تنظیمات دلار ذخیره شد.",
    retry: "تلاش دوباره",
    loadError: "تنظیمات دلار بارگذاری نشد.",
    saveError: "تنظیمات دلار ذخیره نشد.",
    sourceLink: "مشاهده منبع انتخاب‌شده",
    noChanges: "تغییر ذخیره‌نشده‌ای وجود ندارد"
  },
  ar: {
    eyebrow: "إعدادات المنصة / الدولار",
    title: "سعر صرف الدولار",
    intro: "اختر مصدر السوق المستخدم لتحويل العروض الدولارية إلى إجماليات صحيحة بالريال الإيراني.",
    automation: "التحديث التلقائي",
    automationHint: "يتم فحص مصدر السوق العام المحدد كل ثلاث ساعات. عند التعطيل يبقى آخر سعر محفوظ.",
    enabled: "مهمة cron مفعّلة",
    disabled: "مهمة cron معطّلة",
    rate: "سعر بيع الدولار",
    rateHint: "أدخل القيمة بالتومان؛ يحوّل كل تومان إلى 10 ريالات عند الدفع.",
    toman: "تومان",
    irr: "ريال لكل دولار",
    source: "مصدر السعر الحالي",
    sourceAuto: "AlanChand",
    sourceManual: "إدخال يدوي",
    providerTitle: "مصدر السعر التلقائي",
    providerHint: "اختر المصدر الذي يستخدمه التحديث المجدول. يتم جلب الأسعار أدناه بشكل مستقل.",
    selected: "محدد",
    select: "استخدم هذا المصدر",
    available: "سعر مباشر",
    unavailable: "السعر غير متاح",
    providerError: "خطأ المصدر",
    openSource: "فتح المصدر",
    unknown: "لا يوجد سعر محفوظ",
    status: "حالة cron",
    never: "بانتظار التشغيل الأول",
    running: "جارٍ الجلب",
    success: "سليم",
    failed: "فشل",
    cancelled: "أُلغي بسبب تغيير إداري",
    next: "التشغيل التالي",
    attempt: "آخر محاولة",
    successAt: "آخر جلب ناجح",
    failure: "آخر فشل",
    warning: "فشل التحديث التلقائي للدولار. يستمر الدفع باستخدام آخر سعر محفوظ؛ راجع الخطأ والمصدر قبل التعديل اليدوي.",
    errorCode: "رمز الخطأ",
    save: "حفظ إعدادات الدولار",
    saving: "جارٍ الحفظ…",
    saved: "تم حفظ إعدادات الدولار.",
    retry: "حاول مجدداً",
    loadError: "تعذر تحميل إعدادات الدولار.",
    saveError: "تعذر حفظ إعدادات الدولار.",
    sourceLink: "فتح المصدر المحدد",
    noChanges: "لا توجد تغييرات غير محفوظة"
  }
} as const;

export function UsdSettingsWorkspace({ locale }: { locale: Locale }) {
  const c = copy[locale];
  const [saved, setSaved] = useState<AdminUsdRateSettings | null>(null);
  const [automationEnabled, setAutomationEnabled] = useState(true);
  const [selectedProvider, setSelectedProvider] = useState<UsdRateProviderId>("alanchand");
  const [rateToman, setRateToman] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const response = await api.get<AdminUsdRateSettings>("/admin/settings/usd");
      setSaved(response.data);
      if (!quiet) {
        setAutomationEnabled(response.data.automationEnabled);
        setSelectedProvider(response.data.selectedProvider);
        setRateToman(response.data.currentRateToman ?? "");
      }
      setError("");
    } catch {
      if (!quiet) setError(c.loadError);
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [c.loadError]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(true), 30_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const rateChanged = saved !== null && rateToman !== (saved.currentRateToman ?? "");
  const automationChanged = saved !== null && automationEnabled !== saved.automationEnabled;
  const providerChanged = saved !== null && selectedProvider !== saved.selectedProvider;
  const dirty = rateChanged || automationChanged || providerChanged;
  const formatter = useMemo(() => new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }), [locale]);
  const date = useCallback((value: string | null) => value
    ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
    : "—", [locale]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dirty) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await api.patch<AdminUsdRateSettings>("/admin/settings/usd", {
        ...(automationChanged ? { automationEnabled } : {}),
        ...(providerChanged ? { provider: selectedProvider } : {}),
        ...(rateChanged ? { manualRateToman: rateToman } : {})
      });
      setSaved(response.data);
      setAutomationEnabled(response.data.automationEnabled);
      setSelectedProvider(response.data.selectedProvider);
      setRateToman(response.data.currentRateToman ?? "");
      setMessage(c.saved);
    } catch {
      setError(c.saveError);
    } finally {
      setSaving(false);
    }
  }

  const statusLabel = saved ? c[saved.cronStatus] : c.never;
  const sourceLabel = saved?.rateSource === "alanchand"
    ? c.sourceAuto
    : saved?.rateSource === "nobitex"
      ? "Nobitex"
      : saved?.rateSource === "tgju"
        ? "TGJU"
        : saved?.rateSource === "manual"
          ? c.sourceManual
          : c.unknown;

  return <section className={styles.workspace} aria-labelledby="usd-settings-title">
    <header className={styles.header}><span>{c.eyebrow}</span><h1 id="usd-settings-title">{c.title}</h1><p>{c.intro}</p></header>
    {loading ? <div className={styles.skeleton} aria-busy="true"><i /><i /></div> : error && !saved ? (
      <div className={styles.error} role="alert"><p>{error}</p><button type="button" onClick={() => void load()}>{c.retry}</button></div>
    ) : saved ? <form className={styles.form} onSubmit={submit}>
      {saved.cronStatus === "failed" ? <div className={styles.warning} role="alert"><strong>{c.warning}</strong><span>{c.errorCode}: <code>{saved.lastErrorCode ?? "UNKNOWN"}</code></span></div> : null}
      <div className={styles.heroRate}>
        <div><span>{c.rate}</span><strong>{saved.currentRateToman ? formatter.format(Number(saved.currentRateToman)) : "—"}<small>{c.toman}</small></strong><p>{c.source}: {sourceLabel}</p></div>
        <div><span>{c.irr}</span><strong>{saved.currentRateIrr ? formatter.format(Number(saved.currentRateIrr)) : "—"}</strong><a href={saved.sourceUrl} target="_blank" rel="noopener noreferrer">{c.sourceLink}</a></div>
      </div>
      <div className={styles.settingRow}>
        <div><h2>{c.automation}</h2><p>{c.automationHint}</p><strong data-enabled={automationEnabled}>{automationEnabled ? c.enabled : c.disabled}</strong></div>
        <label className={styles.toggle}><span className={styles.visuallyHidden}>{c.automation}</span><input type="checkbox" checked={automationEnabled} disabled={saving} onChange={(event) => { setAutomationEnabled(event.target.checked); setMessage(""); }} /><span aria-hidden="true"><i /></span></label>
      </div>
      <fieldset className={styles.providers}>
        <legend>{c.providerTitle}</legend>
        <p>{c.providerHint}</p>
        <div className={styles.providerGrid}>
          {saved.providers.map((provider) => {
            const isSelected = selectedProvider === provider.id;
            return <label key={provider.id} className={styles.providerCard} data-selected={isSelected}>
              <input type="radio" name="usd-provider" value={provider.id} checked={isSelected} disabled={saving} onChange={() => { setSelectedProvider(provider.id); setMessage(""); }} />
              <span className={styles.providerHead}><strong>{provider.name}</strong><i>{isSelected ? c.selected : c.select}</i></span>
              <span className={styles.providerPrice}>{provider.rateToman ? <>{formatter.format(Number(provider.rateToman))}<small>{c.toman}</small></> : "—"}</span>
              <span className={provider.status === "available" ? styles.providerAvailable : styles.providerUnavailable}>{provider.status === "available" ? c.available : c.unavailable}</span>
              {provider.errorCode ? <code>{c.providerError}: {provider.errorCode}</code> : null}
              <a href={provider.sourceUrl} target="_blank" rel="noopener noreferrer" onClick={(event) => event.stopPropagation()}>{c.openSource}</a>
            </label>;
          })}
        </div>
      </fieldset>
      <label className={styles.rateField}><span>{c.rate}</span><input inputMode="decimal" pattern="\d{1,8}(?:\.\d{1,2})?" value={rateToman} onChange={(event) => { setRateToman(event.target.value); setMessage(""); }} /><small>{c.rateHint}</small></label>
      <section className={styles.statusPanel} aria-label={c.status}><header><h2>{c.status}</h2><strong data-status={saved.cronStatus}>{statusLabel}</strong></header><dl><div><dt>{c.attempt}</dt><dd>{date(saved.lastAttemptAt)}</dd></div><div><dt>{c.successAt}</dt><dd>{date(saved.lastSuccessAt)}</dd></div><div><dt>{c.failure}</dt><dd>{date(saved.lastFailureAt)}</dd></div><div><dt>{c.next}</dt><dd>{automationEnabled ? date(saved.nextRunAt) : "—"}</dd></div></dl></section>
      <footer className={styles.actions}><div aria-live="polite">{error ? <span className={styles.errorText}>{error}</span> : message ? <span className={styles.success}>{message}</span> : <span>{dirty ? "" : c.noChanges}</span>}</div><button type="submit" disabled={!dirty || saving || (rateChanged && !rateToman)}>{saving ? c.saving : c.save}</button></footer>
    </form> : null}
  </section>;
}
