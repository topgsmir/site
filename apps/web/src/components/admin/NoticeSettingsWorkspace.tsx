"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { Locale } from "@/lib/i18n";
import { api } from "@/lib/api/client";
import styles from "./NoticeSettingsWorkspace.module.css";

type NoticeSettings = { message: string; enabled: boolean };
const copy = {
  fa: { title: "اطلاعیه کاربران", description: "پیامی کوتاه برای نمایش در بالای صفحات کاربران بنویسید.", label: "متن اطلاعیه", placeholder: "متن اطلاعیه را اینجا بنویسید…", enabled: "نمایش اطلاعیه", enabledHint: "پس از ذخیره، پیام در بالای صفحات کاربران نمایش داده می‌شود.", disabledHint: "متن حفظ می‌شود، اما به کاربران نمایش داده نمی‌شود.", preview: "پیش‌نمایش اطلاعیه", previewEmpty: "متنی برای پیش‌نمایش وارد کنید.", characters: "از ۵۰۰ نویسه", save: "ذخیره اطلاعیه", saving: "در حال ذخیره…", saved: "اطلاعیه ذخیره شد.", noChanges: "همه تغییرات ذخیره شده‌اند.", loading: "در حال بارگذاری تنظیمات اطلاعیه…", retry: "تلاش دوباره", loadError: "بارگذاری اطلاعیه ناموفق بود.", saveError: "ذخیره اطلاعیه ناموفق بود." },
  en: { title: "User notice", description: "Write a short message to display above user pages.", label: "Notice text", placeholder: "Write your notice here…", enabled: "Show notice", enabledHint: "After saving, the message appears above user pages.", disabledHint: "The text is kept, but users will not see it.", preview: "Notice preview", previewEmpty: "Enter text to preview the notice.", characters: "of 500 characters", save: "Save notice", saving: "Saving…", saved: "Notice saved.", noChanges: "All changes are saved.", loading: "Loading notice settings…", retry: "Try again", loadError: "Could not load the notice.", saveError: "Could not save the notice." },
  ar: { title: "إشعار المستخدمين", description: "اكتب رسالة قصيرة لعرضها أعلى صفحات المستخدمين.", label: "نص الإشعار", placeholder: "اكتب نص الإشعار هنا…", enabled: "عرض الإشعار", enabledHint: "بعد الحفظ، ستظهر الرسالة أعلى صفحات المستخدمين.", disabledHint: "سيُحتفظ بالنص، لكنه لن يظهر للمستخدمين.", preview: "معاينة الإشعار", previewEmpty: "أدخل نصاً لمعاينة الإشعار.", characters: "من ٥٠٠ حرف", save: "حفظ الإشعار", saving: "جارٍ الحفظ…", saved: "تم حفظ الإشعار.", noChanges: "جميع التغييرات محفوظة.", loading: "جارٍ تحميل إعدادات الإشعار…", retry: "حاول مجدداً", loadError: "تعذر تحميل الإشعار.", saveError: "تعذر حفظ الإشعار." }
} as const;

export function NoticeSettingsWorkspace({ locale }: { locale: Locale }) {
  const c = copy[locale];
  const [draft, setDraft] = useState<NoticeSettings>({ message: "", enabled: false });
  const [saved, setSaved] = useState<NoticeSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { const { data } = await api.get<NoticeSettings>("/admin/settings/notice"); setDraft(data); setSaved(data); }
    catch { setError(c.loadError); }
    finally { setLoading(false); }
  }, [c.loadError]);
  useEffect(() => { void load(); }, [load]);
  const dirty = saved !== null && (draft.message !== saved.message || draft.enabled !== saved.enabled);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!dirty) return;
    setSaving(true); setError(""); setMessage("");
    try { const { data } = await api.patch<NoticeSettings>("/admin/settings/notice", draft); setDraft(data); setSaved(data); setMessage(c.saved); }
    catch { setError(c.saveError); }
    finally { setSaving(false); }
  }
  return <section className={styles.workspace} aria-labelledby="notice-settings-title" dir={locale === "en" ? "ltr" : "rtl"}>
    <header className={styles.header}><h1 id="notice-settings-title">{c.title}</h1><p>{c.description}</p></header>
    {loading ? <p className={styles.loading} role="status">{c.loading}</p> : !saved ? <div className={styles.error} role="alert"><p>{error}</p><button type="button" onClick={() => void load()}>{c.retry}</button></div> :
      <form className={styles.form} onSubmit={save}>
        <div className={styles.editor}>
          <div className={styles.field}><label htmlFor="notice-message">{c.label}</label><textarea id="notice-message" required={draft.enabled} maxLength={500} rows={6} placeholder={c.placeholder} value={draft.message} disabled={saving} onChange={(event) => { setDraft((current) => ({ ...current, message: event.target.value })); setMessage(""); }} /><small>{new Intl.NumberFormat(locale).format(draft.message.length)} {c.characters}</small></div>
          <aside className={styles.preview} aria-label={c.preview}><h2>{c.preview}</h2><div className={styles.previewNotice} data-empty={!draft.message.trim()}>{draft.message.trim() || c.previewEmpty}</div></aside>
        </div>
        <div className={styles.settingRow}><div><h2>{c.enabled}</h2><p>{draft.enabled ? c.enabledHint : c.disabledHint}</p></div><label className={styles.toggle}><span className={styles.visuallyHidden}>{c.enabled}</span><input type="checkbox" checked={draft.enabled} disabled={saving} onChange={(event) => { setDraft((current) => ({ ...current, enabled: event.target.checked })); setMessage(""); }} /><span aria-hidden="true"><i /></span></label></div>
        <footer className={styles.actions}><div aria-live="polite">{error ? <span className={styles.errorText} role="alert">{error}</span> : message ? <span className={styles.success}>{message}</span> : !dirty ? c.noChanges : null}</div><button type="submit" disabled={!dirty || saving}>{saving ? c.saving : c.save}</button></footer>
      </form>}
  </section>;
}
