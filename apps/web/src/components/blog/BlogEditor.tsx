"use client";

import TiptapImage from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import type {
  BlogLocale,
  BlogMediaAsset,
  BlogTaxonomyTerm,
  BlogTranslationDraft,
  ManagedBlogPost,
  RelatedProductSummary,
  RichTextDocument
} from "@topgsm/shared-types";
import NextLink from "next/link";
import NextImage from "next/image";
import type { Route } from "next";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api/client";
import type { Locale } from "@/lib/i18n";
import styles from "./BlogEditor.module.css";

const LABELS: Record<BlogLocale, string> = { fa: "فارسی", en: "English", ar: "العربية" };
const EMPTY: RichTextDocument = { type: "doc", content: [] };

type ProductOption = { id: string; title: string; slug: string };
type TaxonomyResponse = { categories: BlogTaxonomyTerm[]; tags: BlogTaxonomyTerm[] };

export function BlogEditor({ locale, postId, backHref }: { locale: Locale; postId: string; backHref: string }) {
  const [post, setPost] = useState<ManagedBlogPost | null>(null);
  const [translations, setTranslations] = useState<BlogTranslationDraft[]>([]);
  const [active, setActive] = useState<BlogLocale>("fa");
  const activeRef = useRef<BlogLocale>("fa");
  const [categories, setCategories] = useState<BlogTaxonomyTerm[]>([]);
  const [tags, setTags] = useState<BlogTaxonomyTerm[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [products, setProducts] = useState<RelatedProductSummary[]>([]);
  const [productQuery, setProductQuery] = useState("");
  const [productOptions, setProductOptions] = useState<ProductOption[]>([]);
  const [cover, setCover] = useState<BlogMediaAsset | null>(null);
  const [message, setMessage] = useState("Loading…");
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Link.configure({ openOnClick: false, protocols: ["http", "https", "mailto", "tel"] }),
      TiptapImage.configure({ allowBase64: false }),
      Placeholder.configure({ placeholder: "Write the article body…" })
    ],
    content: EMPTY,
    onUpdate: ({ editor: currentEditor }) => {
      const localeCode = activeRef.current;
      setTranslations((current) => current.map((translation) => translation.locale === localeCode
        ? { ...translation, content: currentEditor.getJSON() as RichTextDocument }
        : translation));
    }
  });

  const load = useCallback(async () => {
    try {
      const [postResponse, taxonomyResponse] = await Promise.all([
        api.get<ManagedBlogPost>(`/blog/manage/posts/${postId}`),
        api.get<TaxonomyResponse>("/blog/manage/taxonomy")
      ]);
      const value = postResponse.data;
      setPost(value);
      setTranslations(value.translations);
      setCover(value.cover);
      setCategoryId(value.category?.id ?? "");
      setTagIds(value.tags.map((tag) => tag.id));
      setProducts(value.relatedProducts);
      setCategories(taxonomyResponse.data.categories);
      setTags(taxonomyResponse.data.tags);
      setMessage("All changes saved");
      setError(false);
    } catch { setMessage("The article could not be loaded."); setError(true); }
  }, [postId]);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const translationsRef = useRef(translations);
  useEffect(() => {
    translationsRef.current = translations;
  }, [translations]);

  useEffect(() => {
    activeRef.current = active;
    const content = translationsRef.current.find((item) => item.locale === active)?.content ?? EMPTY;
    editor?.commands.setContent(content, { emitUpdate: false });
  }, [active, editor]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!productQuery.trim()) { setProductOptions([]); return; }
      try {
        const response = await api.get<{ items: ProductOption[] }>("/blog/manage/product-options", { params: { search: productQuery, limit: 8 } });
        setProductOptions(response.data.items);
      } catch { setProductOptions([]); }
    }, 300);
    return () => clearTimeout(timer);
  }, [productQuery]);

  function updateTranslation(field: keyof Omit<BlogTranslationDraft, "locale" | "content">, value: string) {
    setTranslations((current) => current.map((translation) => translation.locale === active ? { ...translation, [field]: value } : translation));
  }

  async function save() {
    if (!post || saving) return post;
    setSaving(true); setError(false); setMessage("Saving…");
    try {
      const response = await api.patch<ManagedBlogPost>(`/blog/manage/posts/${postId}`, {
        optimisticVersion: post.optimisticVersion,
        translations,
        ...(cover ? { coverAssetId: cover.id } : {}),
        ...(categoryId ? { categoryId } : {}),
        tagIds,
        relatedProductIds: products.map((product) => product.id)
      });
      setPost(response.data);
      setMessage("All changes saved");
      return response.data;
    } catch {
      setError(true);
      setMessage("Save failed. Reload before editing if another session changed this revision.");
      return null;
    } finally { setSaving(false); }
  }

  async function submit() {
    const saved = await save();
    if (!saved) return;
    setSaving(true); setMessage("Checking all three translations…");
    try {
      const response = await api.post<ManagedBlogPost>(`/blog/manage/posts/${postId}/submit`);
      setPost(response.data);
      setMessage(response.data.state === "published" ? "Article published" : "Submitted for review");
    } catch { setError(true); setMessage("Submission failed. Complete every language, SEO field, category, and cover image."); }
    finally { setSaving(false); }
  }

  async function upload(file: File, kind: "cover" | "inline") {
    const body = new FormData();
    body.append("file", file); body.append("kind", kind); body.append("focalX", "0.5"); body.append("focalY", "0.5");
    setMessage("Processing WebP image…");
    try {
      const response = await api.post<BlogMediaAsset>("/blog/media", body);
      if (kind === "cover") setCover(response.data);
      else {
        const variant = response.data.variants.find((item) => item.name === "lg") ?? response.data.variants[0];
        if (variant) editor?.chain().focus().setImage({ src: variant.url }).run();
      }
      setMessage("Image ready; save the article to attach it.");
    } catch { setError(true); setMessage("Upload failed. Use a static WebP under 8 MiB and 24 megapixels."); }
  }

  const current = translations.find((item) => item.locale === active);
  const complete = (translation: BlogTranslationDraft) => Boolean(
    translation.title.trim() && translation.slug.trim() && translation.excerpt.trim() &&
    translation.seoTitle.trim() && translation.seoDescription.trim() && translation.coverAltText.trim() &&
    translation.content.content?.length
  );
  const termName = (term: BlogTaxonomyTerm) => term.translations.find((item) => item.locale === locale)?.name ?? term.translations[0]?.name ?? "";

  if (!post || !current) return <div className={styles.shell}><p className={styles.status} data-error={error}>{message}</p></div>;
  const coverVariant = cover?.variants.find((item) => item.name === "wide") ?? cover?.variants[0];
  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <NextLink href={backHref as Route}>← TOP GSM / EDITOR</NextLink>
        <div className={styles.actions}>
          <button type="button" onClick={() => void save()} disabled={saving}>Save draft</button>
          <button type="button" onClick={() => void submit()} disabled={saving || post.state === "pending_review"}>{post.state === "pending_review" ? "In review" : "Submit / publish"}</button>
        </div>
      </header>
      <div className={styles.workspace}>
        <main className={styles.main}>
          <p className={styles.status} role={error ? "alert" : "status"} data-error={error}>{message} · Revision {post.revision}, version {post.optimisticVersion}</p>
          {post.moderationNote ? <p className={styles.moderation}><strong>Moderation note:</strong> {post.moderationNote}</p> : null}
          <div className={styles.languageTabs} role="tablist" aria-label="Article language">
            {(["fa", "en", "ar"] as const).map((code) => <button key={code} type="button" role="tab" aria-selected={active === code} data-complete={complete(translations.find((item) => item.locale === code)!)} onClick={() => setActive(code)}>{LABELS[code]}<i aria-hidden="true" /></button>)}
          </div>
          <div className={styles.fields} dir={active === "en" ? "ltr" : "rtl"}>
            <label className={styles.field}><span>Title</span><input value={current.title} maxLength={200} onChange={(event) => updateTranslation("title", event.target.value)} /><small>Public headline · 2–200 characters</small></label>
            <label className={styles.field}><span>Slug</span><input value={current.slug} maxLength={200} dir="ltr" onChange={(event) => updateTranslation("slug", event.target.value)} /><small>Letters, numbers, and hyphens</small></label>
            <label className={`${styles.field} ${styles.fieldWide}`}><span>Excerpt</span><textarea value={current.excerpt} maxLength={500} onChange={(event) => updateTranslation("excerpt", event.target.value)} /><small>{current.excerpt.length}/500 · Visible on index pages</small></label>
            <label className={styles.field}><span>SEO title</span><input value={current.seoTitle} maxLength={70} onChange={(event) => updateTranslation("seoTitle", event.target.value)} /><small>{current.seoTitle.length}/70</small></label>
            <label className={styles.field}><span>Cover alt text</span><input value={current.coverAltText} maxLength={300} onChange={(event) => updateTranslation("coverAltText", event.target.value)} /><small>Describe the actual cover image</small></label>
            <label className={`${styles.field} ${styles.fieldWide}`}><span>SEO description</span><textarea value={current.seoDescription} maxLength={170} onChange={(event) => updateTranslation("seoDescription", event.target.value)} /><small>{current.seoDescription.length}/170</small></label>
          </div>
          <div className={styles.toolbar} aria-label="Rich text tools">
            <button type="button" data-active={editor?.isActive("bold")} onClick={() => editor?.chain().focus().toggleBold().run()}>B</button>
            <button type="button" data-active={editor?.isActive("italic")} onClick={() => editor?.chain().focus().toggleItalic().run()}><em>I</em></button>
            <button type="button" data-active={editor?.isActive("heading", { level: 2 })} onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}>H2</button>
            <button type="button" data-active={editor?.isActive("bulletList")} onClick={() => editor?.chain().focus().toggleBulletList().run()}>List</button>
            <label>Image<input type="file" accept="image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file, "inline"); event.currentTarget.value = ""; }} /></label>
          </div>
          <div className={styles.editor} dir={active === "en" ? "ltr" : "rtl"}><EditorContent editor={editor} /></div>
        </main>
        <aside className={styles.sidebar}>
          <section className={styles.panel}><h2>Publication checks</h2><ul className={styles.checks}>{translations.map((translation) => <li key={translation.locale} data-complete={complete(translation)}>{LABELS[translation.locale]} complete</li>)}<li data-complete={Boolean(cover)}>Cover attached</li><li data-complete={Boolean(categoryId)}>Category selected</li></ul></section>
          <section className={styles.panel}><h2>Cover</h2>{coverVariant ? <div className={styles.cover}><NextImage unoptimized src={coverVariant.url} alt="" width={coverVariant.width} height={coverVariant.height} sizes="(max-width: 900px) 100vw, 320px" /></div> : <div className={styles.cover} />}<label className={styles.uploadButton}>Upload WebP<input type="file" accept="image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file, "cover"); event.currentTarget.value = ""; }} /></label></section>
          <section className={styles.panel}><h2>Taxonomy</h2><label className={styles.field}><span>Category</span><select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}><option value="">Choose category</option>{categories.map((category) => <option key={category.id} value={category.id}>{termName(category)}</option>)}</select><small>Required to publish</small></label><span className={styles.groupLabel}>Tags</span><div className={styles.tagList}>{tags.map((tag) => <label key={tag.id}><input type="checkbox" checked={tagIds.includes(tag.id)} onChange={(event) => setTagIds((currentIds) => event.target.checked ? [...currentIds, tag.id] : currentIds.filter((id) => id !== tag.id))} />{termName(tag)}</label>)}</div></section>
          <section className={styles.panel}><h2>Related products ({products.length}/8)</h2><input className={styles.searchInput} value={productQuery} onChange={(event) => setProductQuery(event.target.value)} placeholder="Search title or slug" aria-label="Search products" /><div className={styles.productResults}>{productOptions.filter((option) => !products.some((product) => product.id === option.id)).map((option) => <button key={option.id} type="button" disabled={products.length >= 8} onClick={() => { setProducts((currentProducts) => [...currentProducts, { ...option, startingPrices: [] }]); setProductQuery(""); }}>{option.title}</button>)}</div><div className={styles.selectedProducts}>{products.map((product) => <button key={product.id} type="button" onClick={() => setProducts((currentProducts) => currentProducts.filter((item) => item.id !== product.id))}><span>{product.title}</span><span aria-label="Remove">×</span></button>)}</div></section>
        </aside>
      </div>
    </div>
  );
}
