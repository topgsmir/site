"use client";

import axios from "axios";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import type { HomepageStory } from "@topgsm/shared-types";
import type { Locale } from "@/lib/i18n";
import { api } from "@/lib/api/client";
import styles from "./HomepageStoriesWorkspace.module.css";

type Draft = { title: string; targetUrl: string; position: number; enabled: boolean; file: File | null };

const emptyDraft = (): Draft => ({ title: "", targetUrl: "", position: 0, enabled: true, file: null });

const copy = {
  fa: { title: "استوری‌های صفحه اصلی", description: "برای هر زبان تصویر، عنوان و لینک مقصد تعریف کنید. استوری‌های فعال بر اساس ترتیب در بالای صفحه اصلی نمایش داده می‌شوند.", language: "زبان محتوا", add: "استوری جدید", edit: "ویرایش استوری", name: "عنوان", namePlaceholder: "مثلاً خدمات آنلاین", url: "لینک مقصد", urlPlaceholder: "https://example.com یا /fa/products", order: "ترتیب نمایش", orderLabel: "ترتیب", active: "نمایش در صفحه اصلی", image: "تصویر مربع", imageHint: "PNG، JPG یا WebP تا ۵ مگابایت. تصویر به‌صورت مربع برش می‌خورد.", replaceHint: "برای نگه‌داشتن تصویر فعلی، فایلی انتخاب نکنید.", selectedImage: "تصویر انتخاب‌شده", preview: "پیش‌نمایش در صفحه اصلی", save: "ذخیره استوری", saving: "در حال ذخیره…", cancel: "انصراف", editAction: "ویرایش", remove: "حذف", removeQuestion: "این استوری حذف شود؟", confirm: "بله، حذف شود", listTitle: "استوری‌های این زبان", count: (value: string) => `${value} استوری`, empty: "هنوز استوری‌ای برای این زبان ساخته نشده است. اولین استوری را از فرم روبه‌رو اضافه کنید.", loading: "در حال بارگذاری استوری‌ها…", saved: "استوری ذخیره شد.", deleted: "استوری حذف شد.", loadError: "بارگذاری استوری‌ها ناموفق بود.", saveError: "ذخیره استوری ناموفق بود.", deleteError: "حذف استوری ناموفق بود.", inactive: "غیرفعال" },
  en: { title: "Homepage stories", description: "Set an image, label, and destination for each language. Active stories appear in display order near the top of the homepage.", language: "Content language", add: "New story", edit: "Edit story", name: "Label", namePlaceholder: "For example, Online services", url: "Destination URL", urlPlaceholder: "https://example.com or /en/products", order: "Display order", orderLabel: "Order", active: "Show on homepage", image: "Square image", imageHint: "PNG, JPG, or WebP up to 5 MB. The image is cropped to a square.", replaceHint: "Leave this empty to keep the current image.", selectedImage: "Selected image", preview: "Homepage preview", save: "Save story", saving: "Saving…", cancel: "Cancel", editAction: "Edit", remove: "Delete", removeQuestion: "Delete this story?", confirm: "Yes, delete", listTitle: "Stories in this language", count: (value: string) => `${value} ${value === "1" ? "story" : "stories"}`, empty: "No stories have been created for this language. Add the first one using the editor.", loading: "Loading stories…", saved: "Story saved.", deleted: "Story deleted.", loadError: "Could not load stories.", saveError: "Could not save the story.", deleteError: "Could not delete the story.", inactive: "Inactive" },
  ar: { title: "قصص الصفحة الرئيسية", description: "حدد صورة وعنواناً ورابطاً لكل لغة. تظهر القصص النشطة حسب ترتيب العرض أعلى الصفحة الرئيسية.", language: "لغة المحتوى", add: "قصة جديدة", edit: "تعديل القصة", name: "العنوان", namePlaceholder: "مثلاً الخدمات عبر الإنترنت", url: "رابط الوجهة", urlPlaceholder: "https://example.com أو /ar/products", order: "ترتيب العرض", orderLabel: "الترتيب", active: "عرض في الصفحة الرئيسية", image: "صورة مربعة", imageHint: "PNG أو JPG أو WebP حتى 5 ميغابايت. تُقص الصورة بشكل مربع.", replaceHint: "اترك الحقل فارغاً للاحتفاظ بالصورة الحالية.", selectedImage: "الصورة المحددة", preview: "معاينة الصفحة الرئيسية", save: "حفظ القصة", saving: "جارٍ الحفظ…", cancel: "إلغاء", editAction: "تعديل", remove: "حذف", removeQuestion: "هل تريد حذف هذه القصة؟", confirm: "نعم، احذفها", listTitle: "قصص هذه اللغة", count: (value: string) => `${value} قصة`, empty: "لم تُنشأ قصص لهذه اللغة بعد. أضف القصة الأولى من المحرر.", loading: "جارٍ تحميل القصص…", saved: "تم حفظ القصة.", deleted: "تم حذف القصة.", loadError: "تعذر تحميل القصص.", saveError: "تعذر حفظ القصة.", deleteError: "تعذر حذف القصة.", inactive: "غير نشطة" }
} as const;

export function HomepageStoriesWorkspace({ locale }: { locale: Locale }) {
  const c = copy[locale];
  const [contentLocale, setContentLocale] = useState<Locale>(locale);
  const [items, setItems] = useState<HomepageStory[]>([]);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [fileInputKey, setFileInputKey] = useState(0);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);

  const currentStory = useMemo(() => items.find((item) => item.id === editingId), [editingId, items]);
  const previewUrl = localPreviewUrl ?? currentStory?.image.url ?? null;
  const formattedCount = new Intl.NumberFormat(locale).format(items.length);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get<HomepageStory[]>(`/admin/stories?locale=${contentLocale}`);
      setItems(data);
    } catch {
      setError(c.loadError);
    } finally {
      setLoading(false);
    }
  }, [c.loadError, contentLocale]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!draft.file) { setLocalPreviewUrl(null); return; }
    const objectUrl = URL.createObjectURL(draft.file);
    setLocalPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [draft.file]);

  function resetForm() {
    setDraft(emptyDraft());
    setEditingId(null);
    setFileInputKey((value) => value + 1);
  }

  function startEdit(story: HomepageStory) {
    setEditingId(story.id);
    setDraft({ title: story.title, targetUrl: story.targetUrl, position: story.position, enabled: story.enabled, file: null });
    setDeleteId(null);
    setMessage("");
    setError("");
    document.getElementById("story-editor")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingId && !draft.file) return;
    setSaving(true);
    setError("");
    setMessage("");
    const form = new FormData();
    form.set("locale", contentLocale);
    form.set("title", draft.title);
    form.set("targetUrl", draft.targetUrl);
    form.set("position", String(draft.position));
    form.set("enabled", String(draft.enabled));
    if (draft.file) form.set("file", draft.file);
    try {
      if (editingId) await api.patch(`/admin/stories/${editingId}`, form);
      else await api.post("/admin/stories", form);
      resetForm();
      setMessage(c.saved);
      await load();
    } catch (requestError) {
      setError(apiErrorMessage(requestError, c.saveError));
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await api.delete(`/admin/stories/${id}`);
      if (editingId === id) resetForm();
      setDeleteId(null);
      setMessage(c.deleted);
      await load();
    } catch (requestError) {
      setError(apiErrorMessage(requestError, c.deleteError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={styles.workspace} aria-labelledby="stories-title" dir={locale === "en" ? "ltr" : "rtl"}>
      <header className={styles.header}>
        <div><h1 id="stories-title">{c.title}</h1><p>{c.description}</p></div>
        <label className={styles.localeField}><span>{c.language}</span><select value={contentLocale} disabled={saving} onChange={(event) => { setContentLocale(event.target.value as Locale); resetForm(); setMessage(""); }}><option value="fa">فارسی</option><option value="en">English</option><option value="ar">العربية</option></select></label>
      </header>

      <div className={styles.feedback} aria-live="polite">
        {error ? <p className={styles.error} role="alert">{error}</p> : null}
        {message ? <p className={styles.success} role="status">{message}</p> : null}
      </div>

      <div className={styles.layout}>
        <form className={styles.form} id="story-editor" onSubmit={submit} aria-busy={saving}>
          <div className={styles.formHeading}><div><span>{c.preview}</span><h2>{editingId ? c.edit : c.add}</h2></div>{editingId ? <button type="button" className={styles.textButton} disabled={saving} onClick={resetForm}>{c.cancel}</button> : null}</div>
          <div className={styles.preview} data-empty={!previewUrl}>
            <div className={styles.previewRing}>{previewUrl ? <Image unoptimized src={previewUrl} width={104} height={104} alt={draft.file?.name ?? draft.title} /> : <span aria-hidden="true">1:1</span>}</div>
            <strong>{draft.title || c.namePlaceholder}</strong>
          </div>
          <label className={styles.field}><span>{c.name}</span><input required maxLength={80} value={draft.title} placeholder={c.namePlaceholder} disabled={saving} autoComplete="off" onChange={(event) => setDraft((value) => ({ ...value, title: event.target.value }))} /></label>
          <label className={styles.field}><span>{c.url}</span><input required maxLength={2048} value={draft.targetUrl} placeholder={c.urlPlaceholder} disabled={saving} dir="ltr" inputMode="url" autoComplete="url" onChange={(event) => setDraft((value) => ({ ...value, targetUrl: event.target.value }))} /></label>
          <label className={styles.field}><span>{c.order}</span><input required type="number" inputMode="numeric" min={0} max={10000} value={draft.position} disabled={saving} onChange={(event) => setDraft((value) => ({ ...value, position: Number(event.target.value) }))} /></label>
          <label className={`${styles.field} ${styles.fileField}`}><span>{c.image}</span><input key={fileInputKey} required={!editingId} type="file" accept="image/png,image/jpeg,image/webp" disabled={saving} onChange={(event) => setDraft((value) => ({ ...value, file: event.target.files?.[0] ?? null }))} /><small>{draft.file ? `${c.selectedImage}: ${draft.file.name}` : editingId ? c.replaceHint : c.imageHint}</small></label>
          <label className={styles.switchField}><span><strong>{c.active}</strong></span><input type="checkbox" checked={draft.enabled} disabled={saving} onChange={(event) => setDraft((value) => ({ ...value, enabled: event.target.checked }))} /><i aria-hidden="true" /></label>
          <div className={styles.formActions}><button className={styles.primary} type="submit" disabled={saving || (!editingId && !draft.file)}>{saving ? c.saving : c.save}</button>{editingId ? <button type="button" className={styles.secondary} disabled={saving} onClick={resetForm}>{c.cancel}</button> : null}</div>
        </form>

        <section className={styles.listPanel} aria-labelledby="story-list-title" aria-busy={loading}>
          <header className={styles.listHeader}><div><h2 id="story-list-title">{c.listTitle}</h2><p>{c.count(formattedCount)}</p></div></header>
          {loading ? <div className={styles.skeleton} role="status" aria-label={c.loading}><i /><i /><i /></div> : null}
          {!loading && !items.length ? <div className={styles.emptyState}><span aria-hidden="true">1:1</span><p>{c.empty}</p></div> : null}
          {!loading && items.length ? <div className={styles.list}>{items.map((story) => <article className={styles.card} key={story.id} data-inactive={!story.enabled}>
            <Image unoptimized src={story.image.url} width={76} height={76} alt="" />
            <div className={styles.cardBody}><div><h3>{story.title}</h3>{!story.enabled ? <span>{c.inactive}</span> : null}</div><a href={story.targetUrl} target="_blank" rel="noopener noreferrer" dir="ltr">{story.targetUrl}</a><small>{c.orderLabel} {new Intl.NumberFormat(locale).format(story.position)}</small></div>
            <div className={styles.cardActions}><button type="button" onClick={() => startEdit(story)} disabled={saving}>{c.editAction}</button>{deleteId === story.id ? <div className={styles.confirm}><span>{c.removeQuestion}</span><button type="button" className={styles.confirmDelete} onClick={() => void remove(story.id)} disabled={saving}>{c.confirm}</button><button type="button" onClick={() => setDeleteId(null)} disabled={saving}>{c.cancel}</button></div> : <button type="button" className={styles.danger} onClick={() => setDeleteId(story.id)} disabled={saving}>{c.remove}</button>}</div>
          </article>)}</div> : null}
        </section>
      </div>
    </section>
  );
}

function apiErrorMessage(error: unknown, fallback: string) {
  if (!axios.isAxiosError(error)) return fallback;
  const message = error.response?.data?.message;
  return typeof message === "string" ? message : Array.isArray(message) && typeof message[0] === "string" ? message[0] : fallback;
}
