"use client";

import type { BlogLocale, BlogTaxonomyTerm } from "@topgsm/shared-types";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api } from "@/lib/api/client";
import type { Locale } from "@/lib/i18n";
import styles from "./BlogTaxonomyWorkspace.module.css";

type Kind = "category" | "tag";
type TranslationDraft = { name: string; slug: string; description: string; metaTitle: string; metaDescription: string };
type Draft = Record<BlogLocale, TranslationDraft>;
const locales: BlogLocale[] = ["fa", "en", "ar"];
const PAGE_SIZE = 20;
const navigationCopy = {
  fa: { retry: "بارگذاری دوباره", previous: "صفحه قبل", next: "صفحه بعد", page: "صفحه", of: "از", items: "مورد" },
  en: { retry: "Try again", previous: "Previous page", next: "Next page", page: "Page", of: "of", items: "items" },
  ar: { retry: "إعادة المحاولة", previous: "الصفحة السابقة", next: "الصفحة التالية", page: "الصفحة", of: "من", items: "عناصر" }
} as const;
const emptyTranslation = (): TranslationDraft => ({ name: "", slug: "", description: "", metaTitle: "", metaDescription: "" });
const emptyDraft = (): Draft => ({ fa: emptyTranslation(), en: emptyTranslation(), ar: emptyTranslation() });
const copy = {
  fa: { category: "دسته‌بندی‌ها", tag: "برچسب‌ها", add: "افزودن", edit: "ویرایش", delete: "حذف", save: "ذخیره", cancel: "انصراف", name: "نام", slug: "نامک", description: "توضیحات", metaTitle: "عنوان متا", metaDescription: "توضیحات متا", order: "ترتیب", up: "انتقال به بالا", down: "انتقال به پایین", empty: "موردی ثبت نشده است.", loading: "در حال بارگذاری…", loadError: "بارگذاری انجام نشد.", saveError: "ذخیره انجام نشد. نامک‌ها باید در هر زبان یکتا باشند.", deleteError: "حذف انجام نشد. ممکن است این مورد در مقاله‌ای استفاده شده باشد.", orderError: "ترتیب ذخیره نشد؛ فهرست دوباره بارگذاری شد.", saved: "ذخیره شد.", deleted: "حذف شد.", confirm: "این مورد حذف شود؟", language: "زبان", actions: "عملیات", used: "موردهای استفاده‌شده در مقاله قابل حذف نیستند." },
  en: { category: "Categories", tag: "Tags", add: "Add", edit: "Edit", delete: "Delete", save: "Save", cancel: "Cancel", name: "Name", slug: "Slug", description: "Description", metaTitle: "Meta title", metaDescription: "Meta description", order: "Order", up: "Move up", down: "Move down", empty: "No items yet.", loading: "Loading…", loadError: "Could not load items.", saveError: "Could not save. Slugs must be unique in each language.", deleteError: "Could not delete. This item may be used by an article.", orderError: "Could not save the order; the list was reloaded.", saved: "Saved.", deleted: "Deleted.", confirm: "Delete this item?", language: "Language", actions: "Actions", used: "Items used by articles cannot be deleted." },
  ar: { category: "التصنيفات", tag: "الوسوم", add: "إضافة", edit: "تحرير", delete: "حذف", save: "حفظ", cancel: "إلغاء", name: "الاسم", slug: "المعرّف", description: "الوصف", metaTitle: "عنوان ميتا", metaDescription: "وصف ميتا", order: "الترتيب", up: "نقل للأعلى", down: "نقل للأسفل", empty: "لا توجد عناصر بعد.", loading: "جارٍ التحميل…", loadError: "تعذر تحميل العناصر.", saveError: "تعذر الحفظ. يجب أن تكون المعرّفات فريدة لكل لغة.", deleteError: "تعذر الحذف. قد يكون هذا العنصر مستخدماً في مقال.", orderError: "تعذر حفظ الترتيب؛ أعيد تحميل القائمة.", saved: "تم الحفظ.", deleted: "تم الحذف.", confirm: "حذف هذا العنصر؟", language: "اللغة", actions: "الإجراءات", used: "لا يمكن حذف عناصر مستخدمة في المقالات." }
} as const;

function draftFrom(term: BlogTaxonomyTerm): Draft {
  const draft = emptyDraft();
  for (const translation of term.translations) draft[translation.locale] = {
    name: translation.name,
    slug: translation.slug,
    description: translation.description ?? "",
    metaTitle: translation.meta_title ?? "",
    metaDescription: translation.meta_description ?? ""
  };
  return draft;
}

export function BlogTaxonomyWorkspace({ locale, kind }: { locale: Locale; kind: Kind }) {
  const c = copy[locale];
  const navigation = navigationCopy[locale];
  const title = c[kind];
  const path = `/blog/manage/${kind === "category" ? "categories" : "tags"}`;
  const [terms, setTerms] = useState<BlogTaxonomyTerm[]>([]);
  const [editingId, setEditingId] = useState<string | null | undefined>(undefined);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [page, setPage] = useState(0);
  const [message, setMessage] = useState("");
  const load = useCallback(() =>
    api.get<{ categories: BlogTaxonomyTerm[]; tags: BlogTaxonomyTerm[] }>("/blog/manage/taxonomy").then((response) => {
      const nextTerms = kind === "category" ? response.data.categories : response.data.tags;
      setTerms(nextTerms);
      setPage((current) => Math.min(current, Math.max(0, Math.ceil(nextTerms.length / PAGE_SIZE) - 1)));
      setLoadFailed(false);
      setMessage("");
      return true;
    }).catch(() => { setLoadFailed(true); return false; }).finally(() => setLoading(false)),
  [kind]);
  useEffect(() => { void load(); }, [load]);

  function retryLoad() { setLoading(true); setLoadFailed(false); void load(); }

  function edit(term: BlogTaxonomyTerm) { setEditingId(term.id); setDraft(draftFrom(term)); setMessage(""); }
  function startCreate() { setEditingId(null); setDraft(emptyDraft()); setMessage(""); }
  function update(code: BlogLocale, field: keyof TranslationDraft, value: string) {
    setDraft((current) => ({ ...current, [code]: { ...current[code], [field]: value } }));
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      const body = { translations: locales.map((code) => ({ locale: code, ...draft[code] })) };
      if (editingId) await api.patch(`${path}/${editingId}`, body);
      else await api.post(path, body);
      setEditingId(undefined);
      if (await load()) setMessage(c.saved);
    } catch { setMessage(c.saveError); }
    finally { setBusy(false); }
  }
  async function remove(term: BlogTaxonomyTerm) {
    if (busy || !window.confirm(c.confirm)) return;
    setBusy(true);
    try { await api.delete(`${path}/${term.id}`); if (await load()) setMessage(c.deleted); }
    catch { setMessage(c.deleteError); }
    finally { setBusy(false); }
  }
  async function move(index: number, direction: -1 | 1) {
    const next = [...terms];
    [next[index], next[index + direction]] = [next[index + direction], next[index]];
    setBusy(true);
    setTerms(next);
    try { await api.put(`${path}/order`, { ids: next.map((term) => term.id) }); setMessage(c.saved); }
    catch { await load(); setMessage(c.orderError); }
    finally { setBusy(false); }
  }

  const pageCount = Math.max(1, Math.ceil(terms.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const visibleTerms = terms.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  return <section className={styles.workspace} aria-labelledby="taxonomy-title">
    <header className={styles.header}><div><h1 id="taxonomy-title">{title}</h1><p>{c.used}</p></div><button type="button" onClick={startCreate} disabled={busy}>{c.add} {title}</button></header>
    {message ? <p className={styles.status} role="status">{message}</p> : null}
    {editingId !== undefined ? <form className={styles.form} onSubmit={save}>
      <div className={styles.formHeading}><h2>{editingId ? c.edit : c.add} {title}</h2><button type="button" onClick={() => setEditingId(undefined)} disabled={busy}>{c.cancel}</button></div>
      <div className={styles.languages}>{locales.map((code) => <fieldset key={code} disabled={busy}><legend>{code.toUpperCase()}</legend>
        <div className={styles.fields}>
          <label>{c.name}<input required maxLength={kind === "category" ? 100 : 80} value={draft[code].name} onChange={(event) => update(code, "name", event.target.value)} /></label>
          <label>{c.slug}<input required maxLength={kind === "category" ? 120 : 100} dir="ltr" pattern="[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*" value={draft[code].slug} onChange={(event) => update(code, "slug", event.target.value)} /></label>
          <label className={styles.wide}>{c.description}<textarea maxLength={4000} rows={2} value={draft[code].description} onChange={(event) => update(code, "description", event.target.value)} /></label>
          <label>{c.metaTitle}<input maxLength={160} value={draft[code].metaTitle} onChange={(event) => update(code, "metaTitle", event.target.value)} /></label>
          <label>{c.metaDescription}<input maxLength={320} value={draft[code].metaDescription} onChange={(event) => update(code, "metaDescription", event.target.value)} /></label>
        </div>
      </fieldset>)}</div><button type="submit" disabled={busy}>{c.save}</button>
    </form> : null}
    {loading ? <div className={styles.loading} role="status" aria-label={c.loading}><span>{c.loading}</span><div aria-hidden="true" /><div aria-hidden="true" /><div aria-hidden="true" /><div aria-hidden="true" /><div aria-hidden="true" /></div> : null}
    {!loading && loadFailed ? <div className={styles.feedback} role="alert"><p>{c.loadError}</p><button type="button" onClick={retryLoad}>{navigation.retry}</button></div> : null}
    {!loading && !loadFailed && terms.length === 0 ? <div className={styles.feedback}><p>{c.empty}</p><button type="button" onClick={startCreate}>{c.add} {title}</button></div> : null}
    {!loading && !loadFailed && terms.length > 0 ? <div className={styles.list} role="list" aria-label={title}>{visibleTerms.map((term, offset) => {
      const index = currentPage * PAGE_SIZE + offset;
      const translation = term.translations.find((item) => item.locale === locale) ?? term.translations[0];
      return <div className={styles.row} role="listitem" key={term.id}>
        <div className={styles.term}><strong>{translation?.name}</strong><span dir="ltr">/{translation?.slug}</span></div>
        <div className={styles.actions} aria-label={`${c.actions}: ${translation?.name}`}>
          <button type="button" aria-label={`${c.up}: ${translation?.name}`} title={c.up} disabled={busy || index === 0 || terms.length > 500} onClick={() => void move(index, -1)}>↑</button>
          <button type="button" aria-label={`${c.down}: ${translation?.name}`} title={c.down} disabled={busy || index === terms.length - 1 || terms.length > 500} onClick={() => void move(index, 1)}>↓</button>
          <button type="button" disabled={busy} onClick={() => edit(term)}>{c.edit}</button>
          <button type="button" disabled={busy} onClick={() => void remove(term)}>{c.delete}</button>
        </div>
      </div>;
    })}</div> : null}
    {!loading && !loadFailed && pageCount > 1 ? <nav className={styles.pagination} aria-label={`${title} · ${navigation.page}`}>
      <button type="button" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>{navigation.previous}</button>
      <span>{navigation.page} {new Intl.NumberFormat(locale).format(currentPage + 1)} {navigation.of} {new Intl.NumberFormat(locale).format(pageCount)} · {new Intl.NumberFormat(locale).format(terms.length)} {navigation.items}</span>
      <button type="button" disabled={currentPage >= pageCount - 1} onClick={() => setPage(currentPage + 1)}>{navigation.next}</button>
    </nav> : null}
  </section>;
}
