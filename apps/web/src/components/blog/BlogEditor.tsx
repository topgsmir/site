"use client";

import TiptapImage from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import type {
  BlogLocale,
  BlogMediaAsset,
  BlogTaxonomyTerm,
  BlogTranslationDraft,
  ManagedBlogPost,
  RelatedProductSummary,
  RichTextDocument,
  RichTextNode
} from "@topgsm/shared-types";
import NextLink from "next/link";
import NextImage from "next/image";
import type { Route } from "next";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api/client";
import type { Locale } from "@/lib/i18n";
import { DesignIcon } from "@/components/DesignIcon";
import { BLOG_EDITOR_COPY } from "./BlogEditorCopy";
import styles from "./BlogEditor.module.css";

const LABELS: Record<BlogLocale, string> = { fa: "فارسی", en: "English", ar: "العربية" };
const EMPTY: RichTextDocument = { type: "doc", content: [] };

function hasArticleContent(node: RichTextNode): boolean {
  return node.type === "image" || Boolean(node.type === "text" && node.text?.trim()) || Boolean(node.content?.some(hasArticleContent));
}

type ProductOption = { id: string; title: string; slug: string };
type TaxonomyResponse = { categories: BlogTaxonomyTerm[]; tags: BlogTaxonomyTerm[] };

export function BlogEditor({ locale, postId, backHref }: { locale: Locale; postId: string; backHref: string }) {
  const copy = BLOG_EDITOR_COPY[locale];
  const [post, setPost] = useState<ManagedBlogPost | null>(null);
  const [translations, setTranslations] = useState<BlogTranslationDraft[]>([]);
  const [active, setActive] = useState<BlogLocale>(locale);
  const activeRef = useRef<BlogLocale>(locale);
  const [categories, setCategories] = useState<BlogTaxonomyTerm[]>([]);
  const [tags, setTags] = useState<BlogTaxonomyTerm[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [products, setProducts] = useState<RelatedProductSummary[]>([]);
  const [productQuery, setProductQuery] = useState("");
  const [productOptions, setProductOptions] = useState<ProductOption[]>([]);
  const [cover, setCover] = useState<BlogMediaAsset | null>(null);
  const [message, setMessage] = useState<string>(copy.loading);
  const [loadedContent, setLoadedContent] = useState(0);
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);

  const editor = useEditor({
    immediatelyRender: false,
    editorProps: { attributes: { role: "textbox", "aria-label": copy.body, "aria-multiline": "true" } },
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] }, link: false }),
      Link.configure({ openOnClick: false, protocols: ["http", "https", "mailto", "tel"] }),
      TiptapImage.configure({ allowBase64: false }),
      Placeholder.configure({ placeholder: copy.bodyPlaceholder })
    ],
    content: EMPTY,
    onUpdate: ({ editor: currentEditor }) => {
      const localeCode = activeRef.current;
      setTranslations((current) => current.map((translation) => translation.locale === localeCode
        ? { ...translation, content: currentEditor.getJSON() as RichTextDocument }
        : translation));
      setMessage(copy.unsaved);
    }
  });
  const formatting = useEditorState({ editor, selector: ({ editor: currentEditor }) => ({
    bold: currentEditor?.isActive("bold") ?? false,
    italic: currentEditor?.isActive("italic") ?? false,
    heading: currentEditor?.isActive("heading", { level: 2 }) ?? false,
    list: currentEditor?.isActive("bulletList") ?? false
  }) });

  const load = useCallback(async () => {
    try {
      const [postResponse, taxonomyResponse] = await Promise.all([
        api.get<ManagedBlogPost>(`/blog/manage/posts/${postId}`),
        api.get<TaxonomyResponse>("/blog/manage/taxonomy")
      ]);
      const value = postResponse.data;
      setPost(value);
      setTranslations(value.translations);
      setLoadedContent((version) => version + 1);
      setCover(value.cover);
      setCategoryId(value.category?.id ?? "");
      setTagIds(value.tags.map((tag) => tag.id));
      setProducts(value.relatedProducts);
      setCategories(taxonomyResponse.data.categories);
      setTags(taxonomyResponse.data.tags);
      setMessage(copy.loaded);
      setError(false);
    } catch { setMessage(copy.loadError); setError(true); }
  }, [postId, copy]);
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
  }, [active, editor, loadedContent]);

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
    setMessage(copy.unsaved);
    setTranslations((current) => current.map((translation) => translation.locale === active ? { ...translation, [field]: value } : translation));
  }

  async function save() {
    if (!post || saving) return post;
    setSaving(true); setError(false); setMessage(copy.saving);
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
      setMessage(copy.saved);
      return response.data;
    } catch {
      setError(true);
      setMessage(copy.saveError);
      return null;
    } finally { setSaving(false); }
  }

  async function submit() {
    const saved = await save();
    if (!saved) return;
    setSaving(true); setMessage(copy.checking);
    try {
      const response = await api.post<ManagedBlogPost>(`/blog/manage/posts/${postId}/submit`);
      setPost(response.data);
      setMessage(response.data.state === "published" ? copy.published : copy.submitted);
    } catch { setError(true); setMessage(copy.submitError); }
    finally { setSaving(false); }
  }

  async function upload(file: File, kind: "cover" | "inline") {
    const body = new FormData();
    body.append("file", file); body.append("kind", kind); body.append("focalX", "0.5"); body.append("focalY", "0.5");
    setError(false); setMessage(copy.processing);
    try {
      const response = await api.post<BlogMediaAsset>("/blog/media", body);
      if (kind === "cover") setCover(response.data);
      else {
        const variant = response.data.variants.find((item) => item.name === "lg") ?? response.data.variants[0];
        if (variant) editor?.chain().focus().setImage({ src: variant.url }).run();
      }
      setMessage(copy.imageReady);
    } catch { setError(true); setMessage(copy.uploadError); }
  }

  const current = translations.find((item) => item.locale === active);
  const complete = (translation?: BlogTranslationDraft) => Boolean(
    translation && translation.title.trim() && translation.slug.trim() && translation.excerpt.trim() &&
    translation.seoTitle.trim() && translation.seoDescription.trim() && translation.coverAltText.trim() &&
    hasArticleContent(translation.content)
  );
  const termName = (term: BlogTaxonomyTerm) => term.translations.find((item) => item.locale === locale)?.name ?? term.translations[0]?.name ?? "";

  if (!post || !current) return <div className={styles.loading}><DesignIcon name="file" /><p role={error ? "alert" : "status"}>{message}</p>{error ? <button type="button" onClick={() => void load()}>{copy.retry}</button> : null}</div>;
  const coverVariant = cover?.variants.find((item) => item.name === "wide") ?? cover?.variants[0];
  const checks = [...translations.map((translation) => ({ label: LABELS[translation.locale], done: complete(translation) })), { label: copy.attached, done: Boolean(cover) }, { label: copy.selected, done: Boolean(categoryId) }];
  return (
    <div className={styles.shell} dir={locale === "en" ? "ltr" : "rtl"}>
      <header className={styles.topbar}>
        <NextLink className={styles.backLink} href={backHref as Route}><DesignIcon name="arrow" /><span>{copy.back}</span></NextLink>
        <span className={styles.studio}><DesignIcon name="file" />{copy.studio}</span>
        <div className={styles.actions}>
          <button type="button" onClick={() => void save()} disabled={saving}>{copy.save}</button>
          <button type="button" onClick={() => void submit()} disabled={saving || post.state === "pending_review"}>{post.state === "pending_review" ? copy.review : copy.publish}<DesignIcon name="arrow" /></button>
        </div>
      </header>
      <div className={styles.pageHeading}><div><h1>{copy.title}</h1><p>{copy.intro}</p></div><p className={styles.status} role={error ? "alert" : "status"} data-error={error}><span aria-hidden="true" />{message}</p></div>
      <div className={styles.workspace}>
        <main className={styles.main}>
          {post.moderationNote ? <p className={styles.moderation}><strong>{copy.note}:</strong> {post.moderationNote}</p> : null}
          <section className={styles.writingCard} aria-label={copy.body}>
            <div className={styles.languageBar}><span>{copy.language}</span><div className={styles.languageTabs} role="group" aria-label={copy.language}>
              {(["fa", "en", "ar"] as const).map((code) => <button key={code} type="button" aria-pressed={active === code} lang={code} onClick={() => setActive(code)}>{LABELS[code]}</button>)}
            </div></div>
            <div className={styles.writingFields} dir={active === "en" ? "ltr" : "rtl"} lang={active}>
              <label className={styles.titleField}><span>{copy.headline}</span><textarea rows={1} value={current.title} maxLength={200} placeholder={copy.titleHint} onChange={(event) => updateTranslation("title", event.target.value)} /></label>
              <label className={styles.excerptField}><span>{copy.excerpt}</span><textarea value={current.excerpt} maxLength={500} placeholder={copy.excerptHint} onChange={(event) => updateTranslation("excerpt", event.target.value)} /><small>{current.excerpt.length}/500</small></label>
            </div>
            <div className={styles.toolbar} role="group" aria-label={copy.body}>
              <button type="button" aria-pressed={formatting?.bold} aria-label={copy.bold} title={copy.bold} onClick={() => editor?.chain().focus().toggleBold().run()}><strong>B</strong></button>
              <button type="button" aria-pressed={formatting?.italic} aria-label={copy.italic} title={copy.italic} onClick={() => editor?.chain().focus().toggleItalic().run()}><em>I</em></button>
              <span className={styles.toolDivider} />
              <button type="button" aria-pressed={formatting?.heading} aria-label={copy.heading} title={copy.heading} onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}>H2</button>
              <button type="button" aria-pressed={formatting?.list} onClick={() => editor?.chain().focus().toggleBulletList().run()}>{copy.list}</button>
              <label className={styles.inlineUpload}><DesignIcon name="layers" />{copy.image}<input aria-label={copy.image} type="file" accept="image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file, "inline"); event.currentTarget.value = ""; }} /></label>
            </div>
            <div className={styles.editor} dir={active === "en" ? "ltr" : "rtl"} lang={active}><EditorContent editor={editor} /></div>
          </section>
          <section className={styles.searchPanel} aria-labelledby="search-appearance">
            <header className={styles.sectionHeading}><span className={styles.sectionIcon}><DesignIcon name="search" /></span><div><h2 id="search-appearance">{copy.search}</h2><p>{copy.searchHint}</p></div></header>
            <div className={styles.fields}>
              <label className={`${styles.field} ${styles.fieldWide}`}><span>{copy.slug}</span><div className={styles.slugInput}><span dir="ltr">/{active}/blog/</span><input value={current.slug} maxLength={200} dir="auto" onChange={(event) => updateTranslation("slug", event.target.value)} /></div><small>{copy.slugHint}</small></label>
              <label className={`${styles.field} ${styles.fieldWide}`}><span>{copy.seoTitle}</span><input dir={active === "en" ? "ltr" : "rtl"} value={current.seoTitle} maxLength={70} onChange={(event) => updateTranslation("seoTitle", event.target.value)} /><small>{current.seoTitle.length}/70</small></label>
              <label className={`${styles.field} ${styles.fieldWide}`}><span>{copy.seoDescription}</span><textarea dir={active === "en" ? "ltr" : "rtl"} value={current.seoDescription} maxLength={170} onChange={(event) => updateTranslation("seoDescription", event.target.value)} /><small>{current.seoDescription.length}/170</small></label>
            </div>
          </section>
        </main>
        <aside className={styles.sidebar}>
          <section className={`${styles.panel} ${styles.publishPanel}`}><div className={styles.panelTitle}><h2>{copy.ready}</h2><span className={styles.progressCount}>{checks.filter((check) => check.done).length}/{checks.length}</span></div><p>{copy.readyHint}</p><ul className={styles.checks}>{checks.map((check) => <li key={check.label} data-complete={check.done}><span className={styles.checkIcon}>{check.done ? <DesignIcon name="check" /> : null}</span><span>{check.label}</span><small>{check.done ? copy.complete : copy.incomplete}</small></li>)}</ul></section>
          <section className={styles.panel}>
            <h2>{copy.cover}</h2><p>{copy.coverHint}</p>
            <label className={styles.coverUpload}>
              {coverVariant ? <NextImage unoptimized src={coverVariant.url} alt={current.coverAltText} width={coverVariant.width} height={coverVariant.height} sizes="(max-width: 900px) 100vw, 320px" /> : <span className={styles.coverPlaceholder}><DesignIcon name="layers" /><strong>{copy.upload}</strong><small>{copy.format}</small></span>}
              {coverVariant ? <span className={styles.replaceLabel}>{copy.replace}</span> : null}
              <input aria-label={coverVariant ? copy.replace : copy.upload} type="file" accept="image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file, "cover"); event.currentTarget.value = ""; }} />
            </label>
            <label className={styles.field}><span>{copy.alt}</span><input dir={active === "en" ? "ltr" : "rtl"} value={current.coverAltText} maxLength={300} onChange={(event) => updateTranslation("coverAltText", event.target.value)} /><small>{copy.altHint}</small></label>
          </section>
          <section className={styles.panel}><h2>{copy.organize}</h2><label className={styles.field}><span>{copy.category}</span><select value={categoryId} onChange={(event) => { setCategoryId(event.target.value); setMessage(copy.unsaved); }}><option value="">{copy.choose}</option>{categories.map((category) => <option key={category.id} value={category.id}>{termName(category)}</option>)}</select></label><span className={styles.groupLabel}>{copy.tags}</span><div className={styles.tagList}>{tags.length ? tags.map((tag) => <label key={tag.id}><input type="checkbox" checked={tagIds.includes(tag.id)} onChange={(event) => { setTagIds((currentIds) => event.target.checked ? [...currentIds, tag.id] : currentIds.filter((id) => id !== tag.id)); setMessage(copy.unsaved); }} />{termName(tag)}</label>) : <p>{copy.noTags}</p>}</div></section>
          <section className={styles.panel}><div className={styles.panelTitle}><h2>{copy.related}</h2><span>{products.length}/8</span></div><input className={styles.searchInput} value={productQuery} onChange={(event) => setProductQuery(event.target.value)} placeholder={copy.productSearch} aria-label={copy.productSearch} /><div className={styles.productResults}>{productOptions.filter((option) => !products.some((product) => product.id === option.id)).map((option) => <button key={option.id} type="button" disabled={products.length >= 8} onClick={() => { setProducts((currentProducts) => [...currentProducts, { ...option, startingPrices: [] }]); setProductQuery(""); setMessage(copy.unsaved); }}>{option.title}</button>)}</div><div className={styles.selectedProducts}>{products.map((product) => <button key={product.id} type="button" aria-label={`${copy.remove} ${product.title}`} onClick={() => { setProducts((currentProducts) => currentProducts.filter((item) => item.id !== product.id)); setMessage(copy.unsaved); }}><span>{product.title}</span><span aria-hidden="true">×</span></button>)}</div></section>
        </aside>
      </div>
    </div>
  );
}
