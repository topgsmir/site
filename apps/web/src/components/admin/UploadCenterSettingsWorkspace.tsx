"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { Locale } from "@/lib/i18n";
import { api } from "@/lib/api/client";
import type { UploadCenterSettings } from "@/components/dashboard/UploadCenterNavigation";
import styles from "./UploadCenterSettingsWorkspace.module.css";

const copy = {
  fa: { title: "مراکز آپلود", intro: "نشانی دو مرکز آپلود را برای پنل مدیریت و فروشندگان تنظیم کنید.", free: "مرکز آپلود محصولات رایگان", regular: "مرکز آپلود محصولات عادی", hint: "نشانی کامل HTTPS را وارد کنید. خالی گذاشتن، لینک را غیرفعال می‌کند.", save: "ذخیره نشانی‌ها", saving: "در حال ذخیره…", saved: "نشانی‌ها ذخیره شدند.", loading: "در حال بارگذاری…", error: "بارگذاری یا ذخیره نشانی‌ها ناموفق بود.", retry: "تلاش دوباره" },
  en: { title: "Upload centers", intro: "Set the two upload center destinations shown in admin and seller panels.", free: "Free product upload center", regular: "Regular product upload center", hint: "Enter a full HTTPS URL. Leave empty to disable the link.", save: "Save URLs", saving: "Saving…", saved: "URLs saved.", loading: "Loading…", error: "Could not load or save the URLs.", retry: "Try again" },
  ar: { title: "مراكز الرفع", intro: "اضبط رابطَي مركزي الرفع الظاهرين في لوحتي الإدارة والبائع.", free: "مركز رفع المنتجات المجانية", regular: "مركز رفع المنتجات العادية", hint: "أدخل رابط HTTPS كاملاً. اتركه فارغاً لتعطيل الرابط.", save: "حفظ الروابط", saving: "جارٍ الحفظ…", saved: "حُفظت الروابط.", loading: "جارٍ التحميل…", error: "تعذر تحميل الروابط أو حفظها.", retry: "حاول مجدداً" }
} as const;

const empty: UploadCenterSettings = { freeUrl: "", regularUrl: "" };

export function UploadCenterSettingsWorkspace({ locale }: { locale: Locale }) {
  const c = copy[locale];
  const [draft, setDraft] = useState<UploadCenterSettings>(empty);
  const [saved, setSaved] = useState<UploadCenterSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { const { data } = await api.get<UploadCenterSettings>("/admin/settings/upload-centers"); setDraft(data); setSaved(data); }
    catch { setError(c.error); }
    finally { setLoading(false); }
  }, [c.error]);
  useEffect(() => {
    let active = true;
    void api.get<UploadCenterSettings>("/admin/settings/upload-centers")
      .then(({ data }) => { if (active) { setDraft(data); setSaved(data); } })
      .catch(() => { if (active) setError(c.error); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [c.error]);
  const dirty = saved && (draft.freeUrl !== saved.freeUrl || draft.regularUrl !== saved.regularUrl);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dirty) return;
    setSaving(true); setError(""); setMessage("");
    try {
      const { data } = await api.patch<UploadCenterSettings>("/admin/settings/upload-centers", draft);
      setDraft(data); setSaved(data); setMessage(c.saved);
      window.dispatchEvent(new Event("upload-centers-updated"));
    } catch { setError(c.error); }
    finally { setSaving(false); }
  }
  return <section className={styles.workspace} dir={locale === "en" ? "ltr" : "rtl"}>
    <header><h1>{c.title}</h1><p>{c.intro}</p></header>
    {loading ? <p role="status">{c.loading}</p> : !saved ? <div role="alert"><p>{error}</p><button type="button" onClick={() => void load()}>{c.retry}</button></div> :
      <form onSubmit={save}>
        <div className={styles.fields}>
          <label>{c.free}<input type="url" maxLength={2048} pattern="https://.*" placeholder="https://" value={draft.freeUrl} disabled={saving} onChange={(event) => setDraft({ ...draft, freeUrl: event.target.value })} /></label>
          <label>{c.regular}<input type="url" maxLength={2048} pattern="https://.*" placeholder="https://" value={draft.regularUrl} disabled={saving} onChange={(event) => setDraft({ ...draft, regularUrl: event.target.value })} /></label>
        </div>
        <p className={styles.hint}>{c.hint}</p>
        <footer><span role={error ? "alert" : "status"}>{error || message}</span><button type="submit" disabled={saving || !dirty}>{saving ? c.saving : c.save}</button></footer>
      </form>}
  </section>;
}
