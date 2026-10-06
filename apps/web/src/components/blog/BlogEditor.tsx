"use client";

import { useEditor } from "@tiptap/react";
import type {
  BlogLocale,
  BlogChangeEvent,
  BlogChangesPage,
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
import { DesignIcon } from "@/components/DesignIcon";
import { BLOG_EDITOR_COPY } from "./BlogEditorCopy";
import styles from "./BlogEditor.module.css";
import { ContentAiPanel } from "@/components/ai/ContentAiPanel";
import { applyBlogAiTranslation, articleText, taxonomyMatch } from "@/components/ai/blog-ai-draft";
import { safeExternalHref } from "@/lib/safe-navigation";
import { RichTextVisualEditor, richTextExtensions } from "./RichTextVisualEditor";
import { LiveSeoPanel } from "@/components/seo/LiveSeoPanel";
import { BlogPublicUrl, blogPublicUrl } from "./BlogPublicUrl";

const LABELS: Record<BlogLocale, string> = { fa: "فارسی", en: "English", ar: "العربية" };
const AUTHORING_LOCALE: BlogLocale = "fa";
const EMPTY: RichTextDocument = { type: "doc", content: [] };
const COPY = {
  ...BLOG_EDITOR_COPY[AUTHORING_LOCALE],
  format: "JPEG، PNG یا WebP · حداکثر ۸ مگابایت",
  uploadError: "بارگذاری انجام نشد. از تصویر ثابت JPEG، PNG یا WebP با حجم کمتر از ۸ مگابایت و ابعاد کمتر از ۲۴ مگاپیکسل استفاده کنید.",
  visual: "نوشتن",
  html: "HTML",
  htmlHint: "از HTML مقاله مانند پاراگراف، تیترهای H2 و H3، فهرست، جدول، تراز متن، نقل‌قول، پیوند، کد و تصاویر بارگذاری‌شده استفاده کنید. اسکریپت، embed، رویدادها و نشانی‌های ناامن ذخیره نمی‌شوند.",
  strike: "خط‌خورده",
  inlineCode: "کد درون‌خطی",
  subheading: "زیرتیتر",
  orderedList: "فهرست شماره‌دار",
  quote: "نقل‌قول",
  codeBlock: "بلوک کد",
  rule: "جداکننده",
  link: "پیوند",
  linkPrompt: "پیوند http، https، mailto یا tel را وارد کنید",
  publishedUrl: "نشانی نسخه منتشرشده",
  table: "جدول", addRow: "افزودن سطر", addColumn: "افزودن ستون", deleteTable: "حذف جدول",
  alignment: "تراز", alignStart: "ابتدای سطر", alignCenter: "وسط", alignEnd: "انتهای سطر", alignJustify: "دوطرفه",
  undo: "بازگشت", redo: "انجام مجدد"
};

const SAFE_INLINE_IMAGE = /^\/media\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/[a-z0-9-]{1,80}\.webp$/i;

function sanitizeHtmlNode(node: RichTextNode): RichTextNode | null {
  if (node.type === "image") {
    const src = typeof node.attrs?.src === "string" ? node.attrs.src : "";
    if (!SAFE_INLINE_IMAGE.test(src)) return null;
    const alt = typeof node.attrs?.alt === "string" ? node.attrs.alt.slice(0, 300) : "";
    return { type: "image", attrs: { src, alt } };
  }
  const marks = node.marks?.flatMap((mark) => {
    if (mark.type !== "link") return [mark];
    const href = safeExternalHref(mark.attrs?.href);
    return href ? [{ type: "link", attrs: { href } }] : [];
  });
  const content = node.content?.flatMap((child) => {
    const sanitized = sanitizeHtmlNode(child);
    return sanitized ? [sanitized] : [];
  });
  return {
    ...node,
    ...(marks ? { marks } : {}),
    ...(content ? { content } : {})
  };
}

function hasArticleContent(node: RichTextNode): boolean {
  return node.type === "image" || Boolean(node.type === "text" && node.text?.trim()) || Boolean(node.content?.some(hasArticleContent));
}

type ProductOption = { id: string; title: string; slug: string };
type TaxonomyResponse = { categories: BlogTaxonomyTerm[]; tags: BlogTaxonomyTerm[] };

export function BlogEditor({ postId, backHref, canRestoreHistory = false, newlyCreated = false }: { postId: string; backHref: string; canRestoreHistory?: boolean; newlyCreated?: boolean }) {
  const copy = COPY;
  const [post, setPost] = useState<ManagedBlogPost | null>(null);
  const [translations, setTranslations] = useState<BlogTranslationDraft[]>([]);
  const [active, setActive] = useState<BlogLocale>(AUTHORING_LOCALE);
  const activeRef = useRef<BlogLocale>(AUTHORING_LOCALE);
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
  const [uploadingInline, setUploadingInline] = useState(false);
  const [editorMode, setEditorMode] = useState<"visual" | "html">("visual");
  const [htmlSource, setHtmlSource] = useState("");
  const [seoKeywords, setSeoKeywords] = useState<Record<BlogLocale, string>>({ fa: "", en: "", ar: "" });
  const [changes, setChanges] = useState<BlogChangeEvent[]>([]);
  const [historyError, setHistoryError] = useState("");
  const [confirmRestoreKey, setConfirmRestoreKey] = useState<string | null>(null);

  const editor = useEditor({
    immediatelyRender: false,
    editorProps: { attributes: { role: "textbox", "aria-label": copy.body, "aria-multiline": "true" } },
    extensions: richTextExtensions(copy.bodyPlaceholder, true, true),
    content: translations.find((item) => item.locale === active)?.content ?? EMPTY,
    onUpdate: ({ editor: currentEditor }) => {
      const localeCode = activeRef.current;
      setTranslations((current) => current.map((translation) => translation.locale === localeCode
        ? { ...translation, content: currentEditor.getJSON() as RichTextDocument }
        : translation));
      setMessage(copy.unsaved);
    }
  }, [active, loadedContent]);

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
  const loadHistory = useCallback(async () => {
    try {
      const response = await api.get<BlogChangesPage>(`/blog/manage/posts/${postId}/changes`, { params: { limit: 12 } });
      setChanges(response.data.items);
      setHistoryError("");
    } catch {
      setHistoryError("دریافت تاریخچه ویرایش‌ها ممکن نبود.");
    }
  }, [postId]);
  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); void loadHistory(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load, loadHistory]);

  const translationsRef = useRef(translations);
  useEffect(() => {
    translationsRef.current = translations;
  }, [translations]);

  useEffect(() => { activeRef.current = active; }, [active]);

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

  function replaceActiveContent(content: RichTextDocument) {
    const nextTranslations = translationsRef.current.map((translation) => translation.locale === activeRef.current
      ? { ...translation, content }
      : translation);
    translationsRef.current = nextTranslations;
    setTranslations(nextTranslations);
    return nextTranslations;
  }

  function applyHtmlSource() {
    if (!editor) return translationsRef.current;
    editor.commands.setContent(htmlSource, { emitUpdate: false });
    const parsed = editor.getJSON() as RichTextDocument;
    const sanitized = sanitizeHtmlNode(parsed) as RichTextDocument;
    editor.commands.setContent(sanitized, { emitUpdate: false });
    return replaceActiveContent(sanitized);
  }

  function setMode(mode: "visual" | "html") {
    if (!editor || mode === editorMode) return;
    if (mode === "html") setHtmlSource(editor.getHTML());
    else applyHtmlSource();
    setEditorMode(mode);
  }

  function changeLanguage(locale: BlogLocale) {
    if (editorMode === "html") applyHtmlSource();
    setEditorMode("visual");
    activeRef.current = locale;
    setActive(locale);
  }

  async function save() {
    if (!post || saving || uploadingInline) return null;
    setSaving(true); setError(false); setMessage(copy.saving);
    try {
      const translationsToSave = editorMode === "html" ? applyHtmlSource() : translations;
      const response = await api.patch<ManagedBlogPost>(`/blog/manage/posts/${postId}`, {
        optimisticVersion: post.optimisticVersion,
        translations: translationsToSave,
        ...(cover ? { coverAssetId: cover.id } : {}),
        ...(categoryId ? { categoryId } : {}),
        tagIds,
        relatedProductIds: products.map((product) => product.id)
      });
      setPost(response.data);
      setMessage(copy.saved);
      void loadHistory();
      return response.data;
    } catch {
      setError(true);
      setMessage(copy.saveError);
      return null;
    } finally { setSaving(false); }
  }

  async function restoreChange(change: BlogChangeEvent, side: "before" | "after") {
    if (!post || saving || uploadingInline) return;
    const key = `${change.id}:${side}`;
    if (confirmRestoreKey !== key) {
      setConfirmRestoreKey(key);
      return;
    }
    setSaving(true);
    setError(false);
    setMessage("در حال بازگردانی نسخه…");
    try {
      await api.post(`/blog/manage/posts/${postId}/changes/${change.id}/restore`, {
        optimisticVersion: post.optimisticVersion,
        side
      });
      setConfirmRestoreKey(null);
      await Promise.all([load(), loadHistory()]);
      setMessage("نسخه انتخاب‌شده بازگردانی شد.");
    } catch {
      setError(true);
      setMessage("بازگردانی انجام نشد؛ مقاله را دوباره بارگذاری کنید.");
    } finally {
      setSaving(false);
    }
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
    if (kind === "inline") setUploadingInline(true);
    const body = new FormData();
    body.append("file", file); body.append("kind", kind); body.append("focalX", "0.5"); body.append("focalY", "0.5");
    setError(false); setMessage(copy.processing);
    try {
      const response = await api.post<BlogMediaAsset>("/blog/media", body);
      if (kind === "cover") setCover(response.data);
      else {
        const variant = response.data.variants.find((item) => item.name === "lg") ?? response.data.variants[0];
        if (variant) { setMessage(copy.imageReady); return { src: variant.url }; }
      }
      setMessage(copy.imageReady);
      return null;
    } catch { setError(true); setMessage(copy.uploadError); return null; }
    finally { if (kind === "inline") setUploadingInline(false); }
  }

  const current = translations.find((item) => item.locale === active);
  const complete = (translation?: BlogTranslationDraft) => Boolean(
    translation && translation.title.trim() && translation.slug.trim() && translation.excerpt.trim() &&
    translation.seoTitle.trim() && translation.seoDescription.trim() && translation.coverAltText.trim() &&
    hasArticleContent(translation.content)
  );
  const termName = (term: BlogTaxonomyTerm) => term.translations.find((item) => item.locale === AUTHORING_LOCALE)?.name ?? term.translations[0]?.name ?? "";

  if (!post || !current) return <div className={styles.loading} dir="rtl" lang={AUTHORING_LOCALE}><DesignIcon name="file" /><p role={error ? "alert" : "status"}>{message}</p>{error ? <button type="button" onClick={() => void load()}>{copy.retry}</button> : null}</div>;
  const coverVariant = cover?.variants.find((item) => item.name === "wide") ?? cover?.variants[0];
  const checks = [...translations.map((translation) => ({ label: LABELS[translation.locale], done: complete(translation) })), { label: copy.attached, done: Boolean(cover) }, { label: copy.selected, done: Boolean(categoryId) }];
  const selectedCategory = categories.find((category) => category.id === categoryId);
  return (
    <div className={styles.shell} dir="rtl" lang={AUTHORING_LOCALE}>
      <header className={styles.topbar}>
        <NextLink className={styles.backLink} href={backHref as Route}><DesignIcon name="arrow" /><span>{copy.back}</span></NextLink>
        <span className={styles.studio}><DesignIcon name="file" />{copy.studio}</span>
        <div className={styles.actions}>
          <button type="button" onClick={() => void save()} disabled={saving || uploadingInline}>{copy.save}</button>
          <button type="button" onClick={() => void submit()} disabled={saving || uploadingInline || post.state === "pending_review"}>{post.state === "pending_review" ? copy.review : copy.publish}<DesignIcon name="arrow" /></button>
        </div>
      </header>
      <div className={styles.pageHeading}><div><h1>{newlyCreated ? "افزودن مقاله" : "ویرایش مقاله"}</h1><p>{copy.intro}</p></div><div className={styles.headingMeta}><span className={styles.draftBadge}>{post.archivedAt ? "بایگانی‌شده" : post.state === "draft" ? copy.draft : post.state === "pending_review" ? copy.review : post.state === "published" ? copy.published : "نیازمند اصلاح"}</span><p className={styles.status} role={error ? "alert" : "status"} data-error={error}><span aria-hidden="true" />{message}</p></div></div>
      <div className={styles.workspace}>
        <main className={styles.main}>
          <section className={styles.identityCard} aria-labelledby="article-identity-title">
            <div className={styles.languageBar}><div><h2 id="article-identity-title">اطلاعات اصلی</h2><span>{copy.language}</span></div><div className={styles.languageTabs} role="group" aria-label={copy.language}>
              {(["fa", "en", "ar"] as const).map((code) => <button key={code} type="button" disabled={uploadingInline} aria-pressed={active === code} lang={code} onClick={() => changeLanguage(code)}>{LABELS[code]}</button>)}
            </div></div>
            <div className={styles.identityFields} dir={active === "en" ? "ltr" : "rtl"} lang={active}>
              <label className={styles.titleField}><span>{copy.headline}</span><textarea rows={1} value={current.title} maxLength={200} placeholder={copy.titleHint} onChange={(event) => updateTranslation("title", event.target.value)} /></label>
              <label className={styles.addressField}><span>{copy.slug}</span><div className={styles.slugInput}><span dir="ltr">{blogPublicUrl(active, "")}</span><input value={current.slug} maxLength={200} dir="auto" spellCheck={false} onChange={(event) => updateTranslation("slug", event.target.value)} /></div><small>{copy.slugHint}</small></label>
              {post.publicSlugs[active] && !post.archivedAt ? <div className={styles.publishedUrl}><span>{COPY.publishedUrl}</span><BlogPublicUrl locale={active} slug={post.publicSlugs[active]} label={COPY.publishedUrl} /></div> : null}
            </div>
          </section>
          {post.moderationNote ? <p className={styles.moderation}><strong>{copy.note}:</strong> {post.moderationNote}</p> : null}
          <section className={styles.writingCard} aria-labelledby="article-body-title">
            <header className={styles.cardHeader}><span className={styles.cardIcon}><DesignIcon name="file" /></span><div><h2 id="article-body-title">{copy.body}</h2><p>{copy.excerpt}</p></div></header>
            <div className={styles.writingFields} dir={active === "en" ? "ltr" : "rtl"} lang={active}>
              <label className={styles.excerptField}><span>{copy.excerpt}</span><textarea value={current.excerpt} maxLength={500} placeholder={copy.excerptHint} onChange={(event) => updateTranslation("excerpt", event.target.value)} /><small>{current.excerpt.length}/500</small></label>
            </div>
            <div className={styles.editorModes} role="group" aria-label={copy.body}>
              <button type="button" disabled={uploadingInline} aria-pressed={editorMode === "visual"} onClick={() => setMode("visual")}>{COPY.visual}</button>
              <button type="button" disabled={uploadingInline} aria-pressed={editorMode === "html"} onClick={() => setMode("html")}>{COPY.html}</button>
            </div>
            {editorMode === "visual" ? <RichTextVisualEditor key={active} editor={editor} compact language={active} locale={AUTHORING_LOCALE} articleTools labels={{
              body: copy.body, bold: copy.bold, italic: copy.italic, strike: COPY.strike, inlineCode: COPY.inlineCode,
              heading: copy.heading, subheading: COPY.subheading, list: copy.list, orderedList: COPY.orderedList,
              quote: COPY.quote, codeBlock: COPY.codeBlock, rule: COPY.rule, link: COPY.link, linkPrompt: COPY.linkPrompt, image: copy.image,
              table: COPY.table, addRow: COPY.addRow, addColumn: COPY.addColumn, deleteTable: COPY.deleteTable,
              alignment: COPY.alignment, alignStart: COPY.alignStart, alignCenter: COPY.alignCenter, alignEnd: COPY.alignEnd, alignJustify: COPY.alignJustify,
              undo: COPY.undo, redo: COPY.redo
            }} onUpload={(file) => upload(file, "inline")} /> : <div className={styles.htmlEditor}>
              <textarea dir="ltr" lang="en" spellCheck={false} aria-label={`${copy.body} HTML`} value={htmlSource} onChange={(event) => { setHtmlSource(event.target.value); setMessage(copy.unsaved); }} />
              <p>{COPY.htmlHint}</p>
            </div>}
          </section>
          <ContentAiPanel key={postId} locale={AUTHORING_LOCALE} kind="blog" disabled={saving || uploadingInline || !editor || editorMode === "html"}
            disabledHint={editorMode === "html" ? "برای استفاده از دستیار، ابتدا به حالت دیداری برگردید تا تغییرات HTML وارد ویرایشگر شوند." : undefined}
            fields={["title", "slug", "excerpt", "content", "seoTitle", "seoDescription", "coverAltText", "category", "tags"]}
            snapshot={JSON.stringify({ translations, categoryId, tagIds, editorMode, htmlSource })}
            categories={categories.flatMap((term) => term.translations.map((translation) => translation.name))}
            tags={tags.flatMap((term) => term.translations.map((translation) => translation.name))}
            getSource={() => [current.title, current.excerpt, articleText(current.content)].filter(Boolean).join("\n\n")}
            onApply={(drafts, fields) => {
              const nextTranslations = translations.map((translation) => drafts[translation.locale] ? applyBlogAiTranslation(translation, drafts[translation.locale]!, fields) : translation);
              const suggestions = drafts.fa ?? drafts.en ?? drafts.ar;
              const nextCategory = fields.includes("category") && suggestions ? taxonomyMatch(categories, suggestions.category) ?? categoryId : categoryId;
              const nextTags = fields.includes("tags") && suggestions ? [...new Set([...tagIds, ...suggestions.tags.flatMap((name) => { const id = taxonomyMatch(tags, name); return id ? [id] : []; })])].slice(0, 20) : tagIds;
              translationsRef.current = nextTranslations; setTranslations(nextTranslations); setCategoryId(nextCategory); setTagIds(nextTags);
              editor?.commands.setContent(nextTranslations.find((translation) => translation.locale === active)?.content ?? EMPTY, { emitUpdate: false });
              setMessage(copy.unsaved);
              return JSON.stringify({ translations: nextTranslations, categoryId: nextCategory, tagIds: nextTags, editorMode, htmlSource });
            }}
            onRestore={(snapshot) => {
              const previous = JSON.parse(snapshot) as { translations: BlogTranslationDraft[]; categoryId: string; tagIds: string[] };
              translationsRef.current = previous.translations; setTranslations(previous.translations); setCategoryId(previous.categoryId); setTagIds(previous.tagIds);
              editor?.commands.setContent(previous.translations.find((translation) => translation.locale === active)?.content ?? EMPTY, { emitUpdate: false }); setMessage(copy.unsaved);
            }} />
          <section className={styles.searchPanel} aria-labelledby="search-appearance">
            <header className={styles.sectionHeading}><span className={styles.sectionIcon}><DesignIcon name="search" /></span><div><h2 id="search-appearance">{copy.search}</h2><p>{copy.searchHint}</p></div></header>
            <div className={styles.fields}>
              <label className={`${styles.field} ${styles.fieldWide}`}><span>{copy.seoTitle}</span><input dir={active === "en" ? "ltr" : "rtl"} value={current.seoTitle} maxLength={70} onChange={(event) => updateTranslation("seoTitle", event.target.value)} /><small>{current.seoTitle.length}/70</small></label>
              <label className={`${styles.field} ${styles.fieldWide}`}><span>{copy.seoDescription}</span><textarea dir={active === "en" ? "ltr" : "rtl"} value={current.seoDescription} maxLength={170} onChange={(event) => updateTranslation("seoDescription", event.target.value)} /><small>{current.seoDescription.length}/170</small></label>
            </div>
          </section>
        </main>
        <aside className={styles.sidebar}>
          <section className={`${styles.panel} ${styles.previewPanel}`} aria-labelledby="article-preview-title"><span className={styles.previewEyebrow} id="article-preview-title">پیش‌نمایش مقاله</span><div className={styles.previewContent}>{coverVariant ? <NextImage unoptimized src={coverVariant.url} alt="" width={coverVariant.width} height={coverVariant.height} sizes="64px" /> : <span className={styles.previewIcon}><DesignIcon name="file" /></span>}<div><small>{selectedCategory ? termName(selectedCategory) : copy.choose}</small><h2 dir="auto">{current.title.trim() || copy.titleHint}</h2></div></div><p dir="auto">{current.excerpt.trim() || copy.excerptHint}</p></section>
          <section className={`${styles.panel} ${styles.publishPanel}`}><div className={styles.panelTitle}><h2>{copy.ready}</h2><span className={styles.progressCount}>{checks.filter((check) => check.done).length}/{checks.length}</span></div><p>{copy.readyHint}</p><ul className={styles.checks}>{checks.map((check) => <li key={check.label} data-complete={check.done}><span className={styles.checkIcon}>{check.done ? <DesignIcon name="check" /> : null}</span><span>{check.label}</span><small>{check.done ? copy.complete : copy.incomplete}</small></li>)}</ul></section>
          <section className={`${styles.panel} ${styles.coverPanel}`}>
            <h2>{copy.cover}</h2><p>{copy.coverHint}</p>
            <label className={styles.coverUpload}>
              {coverVariant ? <NextImage unoptimized src={coverVariant.url} alt={current.coverAltText} width={coverVariant.width} height={coverVariant.height} sizes="(max-width: 900px) 100vw, 320px" /> : <span className={styles.coverPlaceholder}><DesignIcon name="layers" /><strong>{copy.upload}</strong><small>{copy.format}</small></span>}
              {coverVariant ? <span className={styles.replaceLabel}>{copy.replace}</span> : null}
              <input aria-label={coverVariant ? copy.replace : copy.upload} type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file, "cover"); event.currentTarget.value = ""; }} />
            </label>
            <label className={styles.field}><span>{copy.alt}</span><input dir={active === "en" ? "ltr" : "rtl"} value={current.coverAltText} maxLength={300} onChange={(event) => updateTranslation("coverAltText", event.target.value)} /><small>{copy.altHint}</small></label>
          </section>
          <section className={`${styles.panel} ${styles.organizePanel}`}><h2>{copy.organize}</h2><label className={styles.field}><span>{copy.category}</span><select value={categoryId} onChange={(event) => { setCategoryId(event.target.value); setMessage(copy.unsaved); }}><option value="">{copy.choose}</option>{categories.map((category) => <option key={category.id} value={category.id}>{termName(category)}</option>)}</select></label><span className={styles.groupLabel}>{copy.tags}</span><div className={styles.tagList}>{tags.length ? tags.map((tag) => <label key={tag.id}><input type="checkbox" checked={tagIds.includes(tag.id)} onChange={(event) => { setTagIds((currentIds) => event.target.checked ? [...currentIds, tag.id] : currentIds.filter((id) => id !== tag.id)); setMessage(copy.unsaved); }} />{termName(tag)}</label>) : <p>{copy.noTags}</p>}</div></section>
          <details className={`${styles.panel} ${styles.disclosurePanel}`}><summary><span>{copy.related}</span><small>{products.length}/8</small></summary><div className={styles.disclosureContent}><input className={styles.searchInput} value={productQuery} onChange={(event) => setProductQuery(event.target.value)} placeholder={copy.productSearch} aria-label={copy.productSearch} /><div className={styles.productResults}>{productOptions.filter((option) => !products.some((product) => product.id === option.id)).map((option) => <button key={option.id} type="button" disabled={products.length >= 8} onClick={() => { setProducts((currentProducts) => [...currentProducts, { ...option, startingPrices: [] }]); setProductQuery(""); setMessage(copy.unsaved); }}>{option.title}</button>)}</div><div className={styles.selectedProducts}>{products.map((product) => <button key={product.id} type="button" aria-label={`${copy.remove} ${product.title}`} onClick={() => { setProducts((currentProducts) => currentProducts.filter((item) => item.id !== product.id)); setMessage(copy.unsaved); }}><span>{product.title}</span><span aria-hidden="true">×</span></button>)}</div></div></details>
          <LiveSeoPanel locale={AUTHORING_LOCALE} keyword={seoKeywords[active]} onKeywordChange={(value) => setSeoKeywords((current) => ({ ...current, [active]: value }))} input={{ kind: "blog", title: current.title, body: current.content, shortDescription: current.excerpt, metaTitle: current.seoTitle, metaDescription: current.seoDescription, hasCover: Boolean(cover), coverAlt: current.coverAltText }} htmlSource={editorMode === "html" ? htmlSource : undefined} />
          <details className={`${styles.panel} ${styles.disclosurePanel} ${styles.historyPanel}`}>
            <summary><span>تاریخچه ویرایش</span><small>{changes.length}</small></summary><div className={styles.disclosureContent}>
            <p>هر ذخیره با نام ویرایشگر و فیلدهای تغییرکرده ثبت می‌شود.</p>
            {historyError ? <p role="alert">{historyError}</p> : null}
            <ol className={styles.historyList}>
              {changes.map((change) => (
                <li key={change.id}>
                  <div><strong>{change.action === "create" ? "ایجاد" : change.action === "restore" ? "بازگردانی" : "ویرایش"}</strong><time dateTime={change.createdAt}>{new Intl.DateTimeFormat("fa", { dateStyle: "medium", timeStyle: "short" }).format(new Date(change.createdAt))}</time></div>
                  <small>{change.actor.name} · {change.changedFields.length} تغییر</small>
                  {canRestoreHistory ? <div className={styles.historyActions}>
                    <button type="button" disabled={saving || uploadingInline} onClick={() => void restoreChange(change, "after")}>{confirmRestoreKey === `${change.id}:after` ? "تأیید بازگردانی" : "بازگردانی این نسخه"}</button>
                    {change.before ? <button type="button" disabled={saving || uploadingInline} onClick={() => void restoreChange(change, "before")}>{confirmRestoreKey === `${change.id}:before` ? "تأیید بازگردانی" : "لغو این تغییر"}</button> : null}
                  </div> : null}
                </li>
              ))}
            </ol></div>
          </details>
        </aside>
      </div>
    </div>
  );
}
