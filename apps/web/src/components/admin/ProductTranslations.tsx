"use client";
import { ProductAiPanel } from "@/components/ai/ProductAiPanel";

import { useEffect, useState } from "react";
import type { ProductTranslation } from "@topgsm/shared-types";
import type { Locale } from "@/lib/i18n";
import { api } from "@/lib/api/client";
import styles from "./ProductTranslations.module.css";

const copy = {
  fa: { heading: "ترجمه محصول", intro: "عنوان و توضیحات انگلیسی یا عربی را بنویسید و منتشر کنید. تغییرات پیش‌نویس تا زمان انتشار در صفحه محصول دیده نمی‌شوند.", title: "عنوان", description: "توضیحات", category: "دسته‌بندی", save: "ذخیره پیش‌نویس", publish: "ذخیره و انتشار", unpublish: "لغو انتشار ترجمه", preview: "پیش‌نمایش پیش‌نویس", published: "منتشرشده", draft: "منتشر نشده", error: "ترجمه ذخیره نشد. دوباره تلاش کنید.", loadError: "ترجمه‌ها بارگذاری نشدند.", retry: "تلاش دوباره", saved: "تغییرات ذخیره شد.", loading: "در حال بارگذاری…" },
  en: { heading: "Product translations", intro: "Write and publish English or Arabic product content. Draft edits stay private until published.", title: "Title", description: "Description", category: "Category", save: "Save draft", publish: "Save and publish", unpublish: "Unpublish translation", preview: "Draft preview", published: "Published", draft: "Not published", error: "The translation could not be saved. Try again.", loadError: "Translations could not be loaded.", retry: "Try again", saved: "Changes saved.", loading: "Loading…" },
  ar: { heading: "ترجمات المنتج", intro: "اكتب محتوى المنتج بالإنجليزية أو العربية ثم انشره. تبقى تعديلات المسودة خاصة حتى نشرها.", title: "العنوان", description: "الوصف", category: "الفئة", save: "حفظ المسودة", publish: "حفظ ونشر", unpublish: "إلغاء نشر الترجمة", preview: "معاينة المسودة", published: "منشور", draft: "غير منشور", error: "تعذر حفظ الترجمة. حاول مرة أخرى.", loadError: "تعذر تحميل الترجمات.", retry: "حاول مرة أخرى", saved: "تم حفظ التغييرات.", loading: "جارٍ التحميل…" }
};

export function ProductTranslations({ productId, locale }: { productId: string; locale: Locale }) {
  const [rows, setRows] = useState<ProductTranslation[] | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const c = copy[locale];
  useEffect(() => {
    const controller = new AbortController();
    api.get<ProductTranslation[]>(`/products/admin/${productId}/translations`, { signal: controller.signal })
      .then(({ data }) => { setRows(data); setError(false); })
      .catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [productId, retry]);
  return <section className={styles.section} aria-labelledby="product-translations-heading">
    <h2 id="product-translations-heading">{c.heading}</h2><p>{c.intro}</p>
    {error ? <p role="alert">{c.loadError} <button type="button" onClick={() => setRetry((n) => n + 1)}>{c.retry}</button></p> : rows === null ? <p>{c.loading}</p> :
      (["en", "ar"] as const).map((language) => <TranslationEditor key={`${productId}:${language}`} productId={productId} language={language} locale={locale} initial={rows.find((row) => row.locale === language)} />)}
  </section>;
}

function TranslationEditor({ productId, language, locale, initial }: { productId: string; language: "en" | "ar"; locale: Locale; initial?: ProductTranslation }) {
  const c = copy[locale];
  const [draft, setDraft] = useState(initial?.draft ?? { title: "", description: "", category: "" });
  const [published, setPublished] = useState(Boolean(initial?.published));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [saved, setSaved] = useState(false);
  async function save(action: "draft" | "publish" | "unpublish") {
    if (busy) return;
    setBusy(true); setError(false); setSaved(false);
    try {
      const base = `/products/admin/${productId}/translations/${language}`;
      const response = action === "unpublish" ? await api.post<ProductTranslation[]>(`${base}/unpublish`) : await api.patch<ProductTranslation[]>(base, draft);
      const rows = action === "publish" ? (await api.post<ProductTranslation[]>(`${base}/publish`)).data : response.data;
      const row = rows.find((item) => item.locale === language)!;
      setDraft(row.draft); setPublished(Boolean(row.published)); setSaved(true);
    } catch { setError(true); } finally { setBusy(false); }
  }
  return <form className={styles.editor} onSubmit={(event) => { event.preventDefault(); void save("draft"); }} aria-busy={busy}>
    <header><h3 lang={language}>{language === "en" ? "English" : "العربية"}</h3><span>{published ? c.published : c.draft}</span></header>
    <fieldset disabled={busy}>
      <ProductAiPanel locale={locale} language={language} disabled={busy} value={{ title: draft.title, description: draft.description, category: draft.category ?? "" }} onChange={(value) => { setDraft(value); setSaved(false); }} />
      <label>{c.title}<input lang={language} dir={language === "ar" ? "rtl" : "ltr"} maxLength={200} value={draft.title} onChange={(event) => { setDraft({ ...draft, title: event.target.value }); setSaved(false); }} /></label>
      <label>{c.category}<input lang={language} dir={language === "ar" ? "rtl" : "ltr"} maxLength={100} value={draft.category ?? ""} onChange={(event) => { setDraft({ ...draft, category: event.target.value }); setSaved(false); }} /></label>
      <label>{c.description}<textarea lang={language} dir={language === "ar" ? "rtl" : "ltr"} maxLength={10000} rows={6} value={draft.description} onChange={(event) => { setDraft({ ...draft, description: event.target.value }); setSaved(false); }} /></label>
      <details><summary>{c.preview}</summary><article dir={language === "ar" ? "rtl" : "ltr"} lang={language}><h4>{draft.title}</h4><p>{draft.category}</p><p className={styles.preview}>{draft.description}</p></article></details>
      <footer><button type="submit">{c.save}</button><button type="button" disabled={draft.title.trim().length < 2 || !draft.description.trim()} onClick={() => void save("publish")}>{c.publish}</button>{published && <button type="button" onClick={() => void save("unpublish")}>{c.unpublish}</button>}</footer>
    </fieldset>
    {error && <p role="alert">{c.error}</p>}{saved && <p role="status">{c.saved}</p>}
  </form>;
}
