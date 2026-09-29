"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import type { Locale } from "@/lib/i18n";
import { api, API_BASE } from "@/lib/api/client";
import styles from "./ProductCategoriesWorkspace.module.css";

type Category = {
  id: string; name: string; slug: string; description: string | null;
  metaTitle: string | null; metaDescription: string | null;
  parentId: string | null; parentName: string | null; imageUrl: string | null;
  productCount: number; childCount: number;
};
type Page = { items: Category[]; nextCursor: string | null };
type Draft = { name: string; slug: string; description: string; metaTitle: string; metaDescription: string; parentId: string };
const emptyDraft: Draft = { name: "", slug: "", description: "", metaTitle: "", metaDescription: "", parentId: "" };
const slugify = (value: string) => value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").slice(0, 160);
const copy = {
  en: { title: "Product categories", add: "New category", search: "Search categories", name: "Title", slug: "Slug", description: "Description", metaTitle: "Meta title", metaDescription: "Meta description", parent: "Parent category", root: "No parent", parentSearch: "Find a parent or replacement", products: "Products", children: "Subcategories", edit: "Edit", save: "Save category", cancel: "Cancel", image: "Image", upload: "Upload image", removeImage: "Remove image", delete: "Delete category", deleteHint: "Move its products to another category or leave them uncategorized. Move child categories first.", uncategorize: "Leave products uncategorized", move: "Move products to", confirmDelete: "Confirm deletion", more: "Load more", empty: "No categories found.", loading: "Loading categories…", saved: "Category saved.", deleted: "Category deleted.", failed: "The request failed. Please try again.", chooseReplacement: "Choose a replacement category.", imageHint: "JPEG, PNG or WebP · up to 8 MiB" },
  fa: { title: "دسته‌بندی‌های محصولات", add: "دسته‌بندی جدید", search: "جست‌وجوی دسته‌بندی", name: "عنوان", slug: "نامک", description: "توضیحات", metaTitle: "عنوان متا", metaDescription: "توضیحات متا", parent: "دسته‌بندی والد", root: "بدون والد", parentSearch: "جست‌وجوی والد یا جایگزین", products: "محصول", children: "زیردسته", edit: "ویرایش", save: "ذخیره دسته‌بندی", cancel: "انصراف", image: "تصویر", upload: "بارگذاری تصویر", removeImage: "حذف تصویر", delete: "حذف دسته‌بندی", deleteHint: "محصولات را به دسته‌ای دیگر منتقل کنید یا بدون دسته بگذارید. ابتدا زیردسته‌ها را منتقل کنید.", uncategorize: "محصولات بدون دسته شوند", move: "انتقال محصولات به", confirmDelete: "تأیید حذف", more: "نمایش بیشتر", empty: "دسته‌بندی‌ای پیدا نشد.", loading: "در حال بارگذاری دسته‌بندی‌ها…", saved: "دسته‌بندی ذخیره شد.", deleted: "دسته‌بندی حذف شد.", failed: "درخواست انجام نشد. دوباره تلاش کنید.", chooseReplacement: "دسته‌بندی جایگزین را انتخاب کنید.", imageHint: "JPEG، PNG یا WebP · حداکثر ۸ مگابایت" },
  ar: { title: "فئات المنتجات", add: "فئة جديدة", search: "البحث في الفئات", name: "العنوان", slug: "الرابط المختصر", description: "الوصف", metaTitle: "عنوان ميتا", metaDescription: "وصف ميتا", parent: "الفئة الأم", root: "بدون فئة أم", parentSearch: "ابحث عن فئة أم أو بديلة", products: "المنتجات", children: "الفئات الفرعية", edit: "تعديل", save: "حفظ الفئة", cancel: "إلغاء", image: "الصورة", upload: "رفع الصورة", removeImage: "حذف الصورة", delete: "حذف الفئة", deleteHint: "انقل منتجاتها إلى فئة أخرى أو اتركها بلا فئة. انقل الفئات الفرعية أولاً.", uncategorize: "ترك المنتجات بلا فئة", move: "نقل المنتجات إلى", confirmDelete: "تأكيد الحذف", more: "عرض المزيد", empty: "لم يتم العثور على فئات.", loading: "جار تحميل الفئات…", saved: "تم حفظ الفئة.", deleted: "تم حذف الفئة.", failed: "تعذر إكمال الطلب. حاول مرة أخرى.", chooseReplacement: "اختر فئة بديلة.", imageHint: "JPEG أو PNG أو WebP · حتى 8 ميغابايت" }
} as const;

function message(error: unknown, fallback: string) {
  if (typeof error === "object" && error && "response" in error) {
    const value = (error as { response?: { data?: { message?: string | string[] } } }).response?.data?.message;
    if (typeof value === "string") return value;
    if (Array.isArray(value)) return value.join(" ");
  }
  return fallback;
}

export function ProductCategoriesWorkspace({ locale }: { locale: Locale }) {
  const c = copy[locale];
  const [items, setItems] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState<Category | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [choiceSearch, setChoiceSearch] = useState("");
  const [choices, setChoices] = useState<Category[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [productAction, setProductAction] = useState<"uncategorize" | "move">("uncategorize");
  const [replacementId, setReplacementId] = useState("");

  const refresh = useCallback(async (term = search) => {
    const { data } = await api.get<Page>("/products/admin/categories", { params: { search: term, limit: 50 } });
    setItems(data.items);
    setNextCursor(data.nextCursor);
  }, [search]);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      setLoading(true);
      void api.get<Page>("/products/admin/categories", { params: { search, limit: 50 } }).then(({ data }) => {
        if (active) { setItems(data.items); setNextCursor(data.nextCursor); setError(""); }
      }).catch((requestError: unknown) => { if (active) setError(message(requestError, c.failed)); })
        .finally(() => { if (active) setLoading(false); });
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [search, c.failed]);

  useEffect(() => {
    if (!formOpen) return;
    let active = true;
    const timer = setTimeout(() => {
      void api.get<Page>("/products/admin/categories", { params: { search: choiceSearch, limit: 50 } }).then(({ data }) => {
        if (active) setChoices(data.items);
      }).catch(() => { if (active) setChoices([]); });
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [formOpen, choiceSearch]);

  function open(category: Category | null) {
    setEditing(category);
    setDraft(category ? { name: category.name, slug: category.slug, description: category.description ?? "", metaTitle: category.metaTitle ?? "", metaDescription: category.metaDescription ?? "", parentId: category.parentId ?? "" } : emptyDraft);
    setChoiceSearch(""); setDeleting(false); setProductAction("uncategorize"); setReplacementId(""); setError(""); setNotice(""); setFormOpen(true);
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    const payload = { name: draft.name.trim(), slug: draft.slug.trim(), description: draft.description.trim() || null, metaTitle: draft.metaTitle.trim() || null, metaDescription: draft.metaDescription.trim() || null, parentId: draft.parentId || null };
    try {
      const { data } = editing
        ? await api.patch<Category>(`/products/admin/categories/${editing.id}`, payload)
        : await api.post<Category>("/products/admin/categories", payload);
      setEditing(data); setFormOpen(true); setDraft({ ...draft, name: data.name, slug: data.slug }); setNotice(c.saved);
      await refresh();
    } catch (requestError) { setError(message(requestError, c.failed)); }
    finally { setBusy(false); }
  }

  async function upload(file: File) {
    if (!editing) return;
    setBusy(true); setError("");
    const body = new FormData(); body.append("file", file);
    try {
      const { data } = await api.post<Category>(`/products/admin/categories/${editing.id}/image`, body);
      setEditing(data); await refresh(); setNotice(c.saved);
    } catch (requestError) { setError(message(requestError, c.failed)); }
    finally { setBusy(false); }
  }

  async function removeImage() {
    if (!editing) return;
    setBusy(true); setError("");
    try { const { data } = await api.delete<Category>(`/products/admin/categories/${editing.id}/image`); setEditing(data); await refresh(); }
    catch (requestError) { setError(message(requestError, c.failed)); }
    finally { setBusy(false); }
  }

  async function removeCategory() {
    if (!editing) return;
    if (productAction === "move" && !replacementId) { setError(c.chooseReplacement); return; }
    setBusy(true); setError("");
    try {
      await api.delete(`/products/admin/categories/${editing.id}`, { data: { productAction, ...(productAction === "move" ? { replacementCategoryId: replacementId } : {}) } });
      setFormOpen(false); setEditing(null); setNotice(c.deleted); await refresh();
    } catch (requestError) { setError(message(requestError, c.failed)); }
    finally { setBusy(false); }
  }

  const available = choices.filter((category) => category.id !== editing?.id);
  const selectedParent = draft.parentId && !available.some((category) => category.id === draft.parentId) ? editing?.parentId === draft.parentId ? editing.parentName : null : null;
  const selectedReplacement = replacementId && !available.some((category) => category.id === replacementId) ? items.find((category) => category.id === replacementId)?.name : null;

  return <section className={styles.workspace} aria-labelledby="product-categories-title">
    <header className={styles.header}><h1 id="product-categories-title">{c.title}</h1><button className={styles.primary} type="button" onClick={() => open(null)}>{c.add}</button></header>
    <div className={styles.layout}>
      <div className={styles.listPane}>
        <label className={styles.search}><span>{c.search}</span><input type="search" maxLength={100} value={search} onChange={(event) => setSearch(event.target.value)} /></label>
        {error && !formOpen ? <p className={styles.error} role="alert">{error}</p> : null}
        {notice && !formOpen ? <p className={styles.notice} role="status">{notice}</p> : null}
        {loading ? <p className={styles.muted}>{c.loading}</p> : null}
        {!loading && !items.length ? <p className={styles.muted}>{c.empty}</p> : null}
        {items.length ? <div className={styles.rows}>
          {items.map((category) => <div className={styles.row} key={category.id}>
            {category.imageUrl ? <Image unoptimized className={styles.thumb} src={`${API_BASE}${category.imageUrl}`} width={44} height={44} alt="" /> : <span className={styles.thumbPlaceholder} aria-hidden="true" />}
            <div className={styles.rowName}><strong>{category.name}</strong><span>{category.parentName ? `${category.parentName} / ` : ""}{category.slug}</span></div>
            <span className={styles.count}>{category.productCount} {c.products}</span>
            <span className={styles.count}>{category.childCount} {c.children}</span>
            <button type="button" onClick={() => open(category)}>{c.edit}</button>
          </div>)}
        </div> : null}
        {nextCursor ? <button className={styles.more} type="button" disabled={loading} onClick={() => {
          setLoading(true);
          void api.get<Page>("/products/admin/categories", { params: { search, cursor: nextCursor, limit: 50 } })
            .then(({ data }) => { setItems((current) => [...current, ...data.items]); setNextCursor(data.nextCursor); })
            .catch((requestError: unknown) => setError(message(requestError, c.failed))).finally(() => setLoading(false));
        }}>{c.more}</button> : null}
      </div>

      {formOpen ? <div className={styles.editor}>
        <div className={styles.editorHeader}><h2>{editing ? c.edit : c.add}</h2><button type="button" onClick={() => { setFormOpen(false); setError(""); }}>{c.cancel}</button></div>
        {error ? <p className={styles.error} role="alert">{error}</p> : null}
        {notice ? <p className={styles.notice} role="status">{notice}</p> : null}
        <form onSubmit={(event) => void save(event)} className={styles.form}>
          <div className={styles.pair}>
            <label><span>{c.name}</span><input required maxLength={100} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value, slug: !editing && (!draft.slug || draft.slug === slugify(draft.name)) ? slugify(event.target.value) : draft.slug })} /></label>
            <label><span>{c.slug}</span><input required maxLength={160} dir="ltr" value={draft.slug} onChange={(event) => setDraft({ ...draft, slug: event.target.value })} /></label>
          </div>
          <label><span>{c.description}</span><textarea rows={3} maxLength={4000} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label>
          <div className={styles.pair}>
            <label><span>{c.metaTitle}</span><input maxLength={160} value={draft.metaTitle} onChange={(event) => setDraft({ ...draft, metaTitle: event.target.value })} /></label>
            <label><span>{c.metaDescription}</span><input maxLength={320} value={draft.metaDescription} onChange={(event) => setDraft({ ...draft, metaDescription: event.target.value })} /></label>
          </div>
          <div className={styles.pair}>
            <label><span>{c.parentSearch}</span><input type="search" maxLength={100} value={choiceSearch} onChange={(event) => setChoiceSearch(event.target.value)} /></label>
            <label><span>{c.parent}</span><select value={draft.parentId} onChange={(event) => setDraft({ ...draft, parentId: event.target.value })}>
              <option value="">{c.root}</option>
              {selectedParent ? <option value={draft.parentId}>{selectedParent}</option> : null}
              {available.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select></label>
          </div>
          <div className={styles.actions}><button className={styles.primary} type="submit" disabled={busy}>{c.save}</button></div>
        </form>
        {editing ? <>
          <div className={styles.imageSection}><strong>{c.image}</strong><span className={styles.muted}>{c.imageHint}</span><div className={styles.imageActions}>
            {editing.imageUrl ? <Image unoptimized src={`${API_BASE}${editing.imageUrl}`} width={88} height={88} alt={editing.name} /> : null}
            <label className={styles.fileButton}>{c.upload}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); event.currentTarget.value = ""; }} /></label>
            {editing.imageUrl ? <button type="button" disabled={busy} onClick={() => void removeImage()}>{c.removeImage}</button> : null}
          </div></div>
          <div className={styles.deleteSection}><button type="button" disabled={busy} onClick={() => setDeleting((value) => !value)}>{c.delete}</button>
            {deleting ? <div className={styles.deleteForm}><p>{c.deleteHint}</p>
              <label><input type="radio" name="productAction" checked={productAction === "uncategorize"} onChange={() => setProductAction("uncategorize")} />{c.uncategorize}</label>
              <label><input type="radio" name="productAction" checked={productAction === "move"} onChange={() => setProductAction("move")} />{c.move}</label>
              {productAction === "move" ? <select value={replacementId} onChange={(event) => setReplacementId(event.target.value)} aria-label={c.move}>
                <option value="">{c.chooseReplacement}</option>
                {selectedReplacement ? <option value={replacementId}>{selectedReplacement}</option> : null}
                {available.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select> : null}
              <button className={styles.danger} type="button" disabled={busy || editing.childCount > 0} onClick={() => void removeCategory()}>{c.confirmDelete}</button>
            </div> : null}
          </div>
        </> : null}
      </div> : null}
    </div>
  </section>;
}
