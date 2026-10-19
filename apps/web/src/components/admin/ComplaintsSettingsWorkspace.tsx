"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { Locale } from "@/lib/i18n";
import { api } from "@/lib/api/client";
import styles from "./ComplaintsSettingsWorkspace.module.css";

type ComplaintsSettings = { phoneNumber: string; telegramId: string };

const copy = {
  fa: {
    title: "ثبت شکایات",
    description: "شماره تماس یا شناسه تلگرام واحد رسیدگی به شکایات را برای نمایش در صفحه عمومی تنظیم کنید.",
    phone: "شماره تماس",
    telegram: "شناسه تلگرام",
    phoneHint: "مثلاً ۰۹۱۲۱۲۳۴۵۶۷ یا ۰۵۱۳۲۷۲۸۰۴۹. خالی بگذارید تا نمایش داده نشود.",
    telegramHint: "مثلاً TopGsm_Support یا @TopGsm_Support یا لینک t.me. خالی بگذارید تا نمایش داده نشود.",
    save: "ذخیره راه‌های ارتباطی",
    saving: "در حال ذخیره…",
    saved: "راه‌های ارتباطی ذخیره شد.",
    noChanges: "همه تغییرات ذخیره شده‌اند.",
    loading: "در حال بارگذاری تنظیمات شکایات…",
    retry: "تلاش دوباره",
    loadError: "بارگذاری تنظیمات شکایات ناموفق بود.",
    saveError: "ذخیره تنظیمات شکایات ناموفق بود.",
    preview: "پیش‌نمایش",
    previewEmpty: "هنوز شماره‌ای یا تلگرامی وارد نشده است."
  },
  en: {
    title: "Complaints",
    description: "Set the phone number or Telegram ID shown on the public complaints page.",
    phone: "Phone number",
    telegram: "Telegram ID",
    phoneHint: "For example 09121234567. Leave empty to hide it.",
    telegramHint: "For example TopGsm_Support, @TopGsm_Support, or a t.me link. Leave empty to hide it.",
    save: "Save contacts",
    saving: "Saving…",
    saved: "Complaint contacts saved.",
    noChanges: "All changes are saved.",
    loading: "Loading complaints settings…",
    retry: "Try again",
    loadError: "Could not load complaints settings.",
    saveError: "Could not save complaints settings.",
    preview: "Preview",
    previewEmpty: "No phone number or Telegram ID entered yet."
  },
  ar: {
    title: "الشكاوى",
    description: "اضبط رقم الهاتف أو معرّف تيليجرام الظاهر في صفحة الشكاوى العامة.",
    phone: "رقم الهاتف",
    telegram: "معرّف تيليجرام",
    phoneHint: "مثلاً 09121234567. اتركه فارغاً لإخفائه.",
    telegramHint: "مثلاً TopGsm_Support أو @TopGsm_Support أو رابط t.me. اتركه فارغاً لإخفائه.",
    save: "حفظ وسائل التواصل",
    saving: "جارٍ الحفظ…",
    saved: "تم حفظ وسائل التواصل للشكاوى.",
    noChanges: "جميع التغييرات محفوظة.",
    loading: "جارٍ تحميل إعدادات الشكاوى…",
    retry: "حاول مجدداً",
    loadError: "تعذر تحميل إعدادات الشكاوى.",
    saveError: "تعذر حفظ إعدادات الشكاوى.",
    preview: "معاينة",
    previewEmpty: "لم يُدخل بعد رقم هاتف أو معرّف تيليجرام."
  }
} as const;

const empty: ComplaintsSettings = { phoneNumber: "", telegramId: "" };

export function ComplaintsSettingsWorkspace({ locale }: { locale: Locale }) {
  const c = copy[locale];
  const [draft, setDraft] = useState<ComplaintsSettings>(empty);
  const [saved, setSaved] = useState<ComplaintsSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get<ComplaintsSettings>("/admin/settings/complaints");
      setDraft(data);
      setSaved(data);
    } catch {
      setError(c.loadError);
    } finally {
      setLoading(false);
    }
  }, [c.loadError]);

  useEffect(() => {
    let active = true;
    void api.get<ComplaintsSettings>("/admin/settings/complaints")
      .then(({ data }) => { if (active) { setDraft(data); setSaved(data); } })
      .catch(() => { if (active) setError(c.loadError); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [c.loadError]);

  const dirty = saved !== null && (draft.phoneNumber !== saved.phoneNumber || draft.telegramId !== saved.telegramId);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dirty) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const { data } = await api.patch<ComplaintsSettings>("/admin/settings/complaints", draft);
      setDraft(data);
      setSaved(data);
      setMessage(c.saved);
    } catch {
      setError(c.saveError);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={styles.workspace} aria-labelledby="complaints-settings-title" dir={locale === "en" ? "ltr" : "rtl"}>
      <header className={styles.header}>
        <h1 id="complaints-settings-title">{c.title}</h1>
        <p>{c.description}</p>
      </header>
      {loading ? (
        <p className={styles.loading} role="status">{c.loading}</p>
      ) : !saved ? (
        <div className={styles.error} role="alert">
          <p>{error}</p>
          <button type="button" onClick={() => void load()}>{c.retry}</button>
        </div>
      ) : (
        <form className={styles.form} onSubmit={save}>
          <div className={styles.fields}>
            <div className={styles.field}>
              <label htmlFor="complaints-phone">{c.phone}</label>
              <input
                id="complaints-phone"
                dir="ltr"
                maxLength={40}
                value={draft.phoneNumber}
                disabled={saving}
                onChange={(event) => { setDraft((current) => ({ ...current, phoneNumber: event.target.value })); setMessage(""); }}
              />
              <small>{c.phoneHint}</small>
            </div>
            <div className={styles.field}>
              <label htmlFor="complaints-telegram">{c.telegram}</label>
              <input
                id="complaints-telegram"
                dir="ltr"
                maxLength={64}
                value={draft.telegramId}
                disabled={saving}
                onChange={(event) => { setDraft((current) => ({ ...current, telegramId: event.target.value })); setMessage(""); }}
              />
              <small>{c.telegramHint}</small>
            </div>
          </div>
          <aside className={styles.preview} aria-label={c.preview}>
            <h2>{c.preview}</h2>
            {!draft.phoneNumber.trim() && !draft.telegramId.trim() ? (
              <p data-empty="true">{c.previewEmpty}</p>
            ) : (
              <ul>
                {draft.phoneNumber.trim() ? <li dir="ltr"><bdi>{draft.phoneNumber.trim()}</bdi></li> : null}
                {draft.telegramId.trim() ? <li dir="ltr"><bdi>{draft.telegramId.trim().startsWith("@") ? draft.telegramId.trim() : `@${draft.telegramId.trim()}`}</bdi></li> : null}
              </ul>
            )}
          </aside>
          <footer className={styles.actions}>
            <div aria-live="polite">
              {error ? <span className={styles.errorText} role="alert">{error}</span> : message ? <span className={styles.success}>{message}</span> : !dirty ? c.noChanges : null}
            </div>
            <button type="submit" disabled={!dirty || saving}>{saving ? c.saving : c.save}</button>
          </footer>
        </form>
      )}
    </section>
  );
}
