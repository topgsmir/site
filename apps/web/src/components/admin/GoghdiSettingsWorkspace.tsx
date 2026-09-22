"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import type { AdminGoghdiSettings } from "@topgsm/shared-types";
import { api } from "@/lib/api/client";
import type { Locale } from "@/lib/i18n";
import styles from "./SmsSettingsWorkspace.module.css";

const copy = {
  en: {
    eyebrow: "Platform settings / Chat", title: "Goghdi chat", intro: "Connect order conversations to Goghdi and route each eligible order to its selected seller.",
    connection: "Browser SDK connection", connectionHint: "These non-secret values are sent to customer browsers. Production URLs must use HTTPS.", sdkUrl: "SDK URL", tenantId: "Tenant ID", apiUrl: "API URL", socketUrl: "Socket URL (optional)", widgetUrl: "Widget URL",
    secret: "Tenant secret", secretHint: "Encrypted before storage and never returned to this browser. Leave blank to keep the current secret.", configured: "Configured · ending in {hint}", missing: "No tenant secret configured", environment: "Currently supplied by the deployment environment.", database: "Stored encrypted in the database.",
    enabledTitle: "Order chat", enabledHint: "Show chat actions for eligible physical, service, and bridge orders when the selected seller has a Goghdi agent ID.", enabled: "Order chat is enabled", disabled: "Order chat is disabled",
    save: "Save Goghdi settings", saving: "Saving…", saved: "Goghdi settings saved.", noChanges: "No unsaved changes", loadError: "Goghdi settings could not be loaded.", saveError: "Goghdi settings could not be saved.", retry: "Try again", updated: "Last changed {date}"
  },
  fa: {
    eyebrow: "تنظیمات پلتفرم / گفت‌وگو", title: "گفت‌وگوی Goghdi", intro: "گفت‌وگوی سفارش را به Goghdi متصل کنید و هر سفارش واجد شرایط را به فروشنده انتخاب‌شده بسپارید.",
    connection: "اتصال SDK مرورگر", connectionHint: "این مقادیر غیرمحرمانه به مرورگر مشتری فرستاده می‌شوند. نشانی‌های محیط عملیاتی باید HTTPS باشند.", sdkUrl: "نشانی SDK", tenantId: "شناسه مستأجر", apiUrl: "نشانی API", socketUrl: "نشانی سوکت (اختیاری)", widgetUrl: "نشانی ویجت",
    secret: "رمز مستأجر", secretHint: "پیش از ذخیره رمزنگاری می‌شود و هرگز به مرورگر برنمی‌گردد. برای نگه‌داشتن رمز فعلی، خالی بگذارید.", configured: "تنظیم شده · پایان با {hint}", missing: "رمز مستأجر تنظیم نشده است", environment: "اکنون از محیط استقرار خوانده می‌شود.", database: "به‌صورت رمزنگاری‌شده در پایگاه داده ذخیره شده است.",
    enabledTitle: "گفت‌وگوی سفارش", enabledHint: "برای سفارش‌های فیزیکی، خدماتی و بریج که فروشنده آن‌ها شناسه عامل Goghdi دارد، دکمه گفت‌وگو نمایش داده شود.", enabled: "گفت‌وگوی سفارش فعال است", disabled: "گفت‌وگوی سفارش غیرفعال است",
    save: "ذخیره تنظیمات Goghdi", saving: "در حال ذخیره…", saved: "تنظیمات Goghdi ذخیره شد.", noChanges: "تغییر ذخیره‌نشده‌ای وجود ندارد", loadError: "تنظیمات Goghdi بارگذاری نشد.", saveError: "تنظیمات Goghdi ذخیره نشد.", retry: "تلاش دوباره", updated: "آخرین تغییر: {date}"
  },
  ar: {
    eyebrow: "إعدادات المنصة / الدردشة", title: "دردشة Goghdi", intro: "اربط محادثات الطلبات بـ Goghdi ووجّه كل طلب مؤهل إلى البائع المحدد.",
    connection: "اتصال SDK للمتصفح", connectionHint: "تُرسل هذه القيم غير السرية إلى متصفح العميل. يجب أن تستخدم روابط الإنتاج HTTPS.", sdkUrl: "رابط SDK", tenantId: "معرّف المستأجر", apiUrl: "رابط API", socketUrl: "رابط المقبس (اختياري)", widgetUrl: "رابط الأداة",
    secret: "سر المستأجر", secretHint: "يُشفّر قبل التخزين ولا يعود إلى المتصفح. اتركه فارغاً للاحتفاظ بالسر الحالي.", configured: "تم الإعداد · ينتهي بـ {hint}", missing: "لم يتم إعداد سر المستأجر", environment: "مقدم حالياً من بيئة النشر.", database: "مخزن بشكل مشفر في قاعدة البيانات.",
    enabledTitle: "دردشة الطلب", enabledHint: "اعرض إجراء الدردشة للطلبات المادية والخدمية والجسر عندما يملك البائع المحدد معرّف وكيل Goghdi.", enabled: "دردشة الطلب مفعلة", disabled: "دردشة الطلب معطلة",
    save: "حفظ إعدادات Goghdi", saving: "جارٍ الحفظ…", saved: "تم حفظ إعدادات Goghdi.", noChanges: "لا توجد تغييرات غير محفوظة", loadError: "تعذر تحميل إعدادات Goghdi.", saveError: "تعذر حفظ إعدادات Goghdi.", retry: "حاول مجدداً", updated: "آخر تغيير {date}"
  }
} as const;

type FormState = Pick<AdminGoghdiSettings, "enabled"> & {
  sdkUrl: string; tenantId: string; apiUrl: string; socketUrl: string; widgetUrl: string; tenantSecret: string;
};

const toForm = (settings: AdminGoghdiSettings): FormState => ({
  enabled: settings.enabled,
  sdkUrl: settings.sdkUrl ?? "",
  tenantId: settings.tenantId ?? "",
  apiUrl: settings.apiUrl ?? "",
  socketUrl: settings.socketUrl ?? "",
  widgetUrl: settings.widgetUrl ?? "",
  tenantSecret: ""
});

export function GoghdiSettingsWorkspace({ locale }: { locale: Locale }) {
  const c = copy[locale];
  const [saved, setSaved] = useState<AdminGoghdiSettings | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const value = (await api.get<AdminGoghdiSettings>("/admin/settings/goghdi")).data;
      setSaved(value); setForm(toForm(value));
    } catch { setError(c.loadError); }
    finally { setLoading(false); }
  }, [c.loadError]);
  useEffect(() => { void load(); }, [load]);

  const dirty = useMemo(() => {
    if (!saved || !form) return false;
    return form.tenantSecret.length > 0 || JSON.stringify({ ...form, tenantSecret: "" }) !== JSON.stringify(toForm(saved));
  }, [form, saved]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => current ? { ...current, [key]: value } : current);
    setMessage(""); setError("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form || !dirty) return;
    setSaving(true); setError(""); setMessage("");
    try {
      const value = (await api.patch<AdminGoghdiSettings>("/admin/settings/goghdi", {
        enabled: form.enabled,
        sdkUrl: form.sdkUrl.trim() || null,
        tenantId: form.tenantId.trim() || null,
        apiUrl: form.apiUrl.trim() || null,
        socketUrl: form.socketUrl.trim() || null,
        widgetUrl: form.widgetUrl.trim() || null,
        ...(form.tenantSecret.trim() ? { tenantSecret: form.tenantSecret.trim() } : {})
      })).data;
      setSaved(value); setForm(toForm(value)); setMessage(c.saved);
    } catch { setError(c.saveError); }
    finally { setSaving(false); }
  }

  if (loading && !form) return <section className={styles.workspace}><div className={styles.skeleton} role="status"><span className={styles.visuallyHidden}>{c.loadError}</span><i /><i /></div></section>;
  if (!form || !saved) return <section className={styles.workspace}><div className={styles.error} role="alert"><p>{error || c.loadError}</p><button type="button" onClick={() => void load()}>{c.retry}</button></div></section>;

  const credentialStatus = saved.tenantSecretConfigured
    ? c.configured.replace("{hint}", saved.tenantSecretHint ?? "••••")
    : c.missing;
  return <section className={styles.workspace} aria-labelledby="goghdi-settings-title">
    <header className={styles.header}><span>{c.eyebrow}</span><h1 id="goghdi-settings-title">{c.title}</h1><p>{c.intro}</p></header>
    <form className={styles.form} onSubmit={submit}>
      <div className={styles.credentials}>
        <div><h2>{c.connection}</h2><p>{c.connectionHint}</p></div>
        <fieldset>
          <legend>{c.connectionHint}</legend>
          <UrlField label={c.sdkUrl} value={form.sdkUrl} onChange={(value) => update("sdkUrl", value)} required={form.enabled} />
          <TextField label={c.tenantId} value={form.tenantId} onChange={(value) => update("tenantId", value)} required={form.enabled} maxLength={100} />
          <UrlField label={c.apiUrl} value={form.apiUrl} onChange={(value) => update("apiUrl", value)} required={form.enabled} />
          <UrlField label={c.socketUrl} value={form.socketUrl} onChange={(value) => update("socketUrl", value)} />
          <UrlField label={c.widgetUrl} value={form.widgetUrl} onChange={(value) => update("widgetUrl", value)} required={form.enabled} />
        </fieldset>
      </div>
      <div className={styles.credentials}>
        <div><h2>{c.secret}</h2><p>{c.secretHint}</p><strong data-configured={saved.tenantSecretConfigured}>{credentialStatus}</strong><small>{saved.credentialSource === "database" ? c.database : saved.credentialSource === "environment" ? c.environment : ""}</small></div>
        <label><span>{c.secret}</span><input type="password" minLength={16} maxLength={2000} value={form.tenantSecret} onChange={(event) => update("tenantSecret", event.target.value)} autoComplete="new-password" disabled={saving} /></label>
      </div>
      <div className={styles.settingRow}><div><h2>{c.enabledTitle}</h2><p>{c.enabledHint}</p><strong data-enabled={form.enabled}>{form.enabled ? c.enabled : c.disabled}</strong></div><label className={styles.toggle}><span className={styles.visuallyHidden}>{c.enabledTitle}</span><input type="checkbox" checked={form.enabled} onChange={(event) => update("enabled", event.target.checked)} disabled={saving} /><span aria-hidden="true"><i /></span></label></div>
      {error ? <p className={styles.errorText} role="alert">{error}</p> : null}
      <footer className={styles.actions}><div><span className={message ? styles.success : undefined}>{message || (dirty ? "" : c.noChanges)}</span>{saved.updatedAt ? <small>{c.updated.replace("{date}", new Date(saved.updatedAt).toLocaleString(locale))}</small> : null}</div><button type="submit" disabled={saving || !dirty}>{saving ? c.saving : c.save}</button></footer>
    </form>
  </section>;
}

function TextField({ label, value, onChange, required, maxLength = 2048 }: { label: string; value: string; onChange(value: string): void; required?: boolean; maxLength?: number }) {
  return <label><span>{label}</span><input value={value} onChange={(event) => onChange(event.target.value)} required={required} maxLength={maxLength} /></label>;
}
function UrlField(props: Parameters<typeof TextField>[0]) {
  return <label><span>{props.label}</span><input type="url" value={props.value} onChange={(event) => props.onChange(event.target.value)} required={props.required} maxLength={props.maxLength ?? 2048} inputMode="url" dir="ltr" /></label>;
}
