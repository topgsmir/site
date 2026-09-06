"use client";

import axios from "axios";
import type { BlogPostSummary, BlogPostsPage, SellerListing } from "@topgsm/shared-types";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import type { Locale } from "@/lib/i18n";
import { api } from "@/lib/api/client";
import styles from "./SellerDashboard.module.css";

type RequestState = "idle" | "loading" | "error" | "success";
type Copy = Record<string, string>;

const COPY: Record<Locale, Copy> = {
  en: {
    title: "Blog", description: "Publish useful guides and connect them to products your shop sells.", newPost: "New post", cancel: "Cancel",
    postTitle: "Post title", excerpt: "Short summary", excerptHint: "Optional. Used in blog lists and previews.", content: "Article",
    contentHint: "Write plain text or Markdown. Raw HTML is not rendered.", relatedProduct: "Related product", noRelatedProduct: "No related product",
    publishState: "Save as", draft: "Draft", published: "Published", archived: "Archived", saveDraft: "Save draft", publish: "Publish post",
    saving: "Saving…", loadMore: "Load more", loading: "Loading posts…", empty: "No blog posts yet",
    emptyHint: "Start with a guide, repair note, or product walkthrough.", loadError: "Posts could not be loaded. Check blog access and try again.",
    createError: "The post could not be saved. Review the fields and try again.", retry: "Try again", post: "Post", product: "Product",
    status: "Status", updated: "Updated", untitledError: "Add a title with at least two characters.", contentError: "Add article content before saving."
  },
  fa: {
    title: "وبلاگ", description: "راهنماهای کاربردی منتشر کنید و آن‌ها را به محصولات فروشگاه خود پیوند دهید.", newPost: "نوشته جدید", cancel: "انصراف",
    postTitle: "عنوان نوشته", excerpt: "خلاصه کوتاه", excerptHint: "اختیاری؛ در فهرست و پیش‌نمایش وبلاگ نمایش داده می‌شود.", content: "متن مقاله",
    contentHint: "متن ساده یا Markdown بنویسید. HTML خام نمایش داده نمی‌شود.", relatedProduct: "محصول مرتبط", noRelatedProduct: "بدون محصول مرتبط",
    publishState: "ذخیره به‌عنوان", draft: "پیش‌نویس", published: "منتشرشده", archived: "بایگانی‌شده", saveDraft: "ذخیره پیش‌نویس", publish: "انتشار نوشته",
    saving: "در حال ذخیره…", loadMore: "نمایش بیشتر", loading: "در حال بارگذاری نوشته‌ها…", empty: "هنوز نوشته‌ای ندارید",
    emptyHint: "با یک راهنما، نکته تعمیر یا معرفی محصول شروع کنید.", loadError: "نوشته‌ها بارگذاری نشدند. دسترسی وبلاگ را بررسی و دوباره تلاش کنید.",
    createError: "نوشته ذخیره نشد. فیلدها را بررسی و دوباره تلاش کنید.", retry: "تلاش دوباره", post: "نوشته", product: "محصول",
    status: "وضعیت", updated: "به‌روزرسانی", untitledError: "عنوانی با حداقل دو نویسه وارد کنید.", contentError: "پیش از ذخیره، متن مقاله را وارد کنید."
  },
  ar: {
    title: "المدونة", description: "انشر أدلة مفيدة واربطها بالمنتجات التي يبيعها متجرك.", newPost: "مقال جديد", cancel: "إلغاء",
    postTitle: "عنوان المقال", excerpt: "ملخص قصير", excerptHint: "اختياري. يظهر في قوائم المدونة والمعاينات.", content: "المقال",
    contentHint: "اكتب نصاً عادياً أو Markdown. لا يتم عرض HTML الخام.", relatedProduct: "المنتج المرتبط", noRelatedProduct: "بدون منتج مرتبط",
    publishState: "حفظ كـ", draft: "مسودة", published: "منشور", archived: "مؤرشف", saveDraft: "حفظ المسودة", publish: "نشر المقال",
    saving: "جارٍ الحفظ…", loadMore: "تحميل المزيد", loading: "جارٍ تحميل المقالات…", empty: "لا توجد مقالات بعد",
    emptyHint: "ابدأ بدليل أو ملاحظة صيانة أو شرح لمنتج.", loadError: "تعذر تحميل المقالات. تحقق من صلاحية المدونة وحاول مجدداً.",
    createError: "تعذر حفظ المقال. راجع الحقول وحاول مجدداً.", retry: "إعادة المحاولة", post: "المقال", product: "المنتج",
    status: "الحالة", updated: "آخر تحديث", untitledError: "أضف عنواناً من حرفين على الأقل.", contentError: "أضف محتوى المقال قبل الحفظ."
  }
};

function requestError(error: unknown, fallback: string) {
  if (!axios.isAxiosError(error)) return fallback;
  const message = error.response?.data?.message;
  if (Array.isArray(message)) return message.join(" ");
  return typeof message === "string" ? message : fallback;
}

export function SellerBlogPanel({ locale, listings }: { locale: Locale; listings: SellerListing[] }) {
  const copy = COPY[locale];
  const titleRef = useRef<HTMLInputElement>(null);
  const [posts, setPosts] = useState<BlogPostSummary[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [listState, setListState] = useState<RequestState>("loading");
  const [formState, setFormState] = useState<RequestState>("idle");
  const [message, setMessage] = useState("");
  const [isComposing, setIsComposing] = useState(false);
  const [title, setTitle] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [content, setContent] = useState("");
  const [relatedProductId, setRelatedProductId] = useState("");
  const [status, setStatus] = useState<"draft" | "published">("draft");

  const loadPosts = useCallback(async (cursor?: string, append = false) => {
    setListState("loading");
    setMessage("");
    try {
      const response = await api.get<BlogPostsPage>("/blog/posts/mine", { params: { limit: 20, ...(cursor ? { cursor } : {}) } });
      setPosts((current) => append ? [...current, ...response.data.items] : response.data.items);
      setNextCursor(response.data.nextCursor);
      setListState("success");
    } catch (error) {
      setMessage(requestError(error, copy.loadError));
      setListState("error");
    }
  }, [copy.loadError]);

  useEffect(() => { void loadPosts(); }, [loadPosts]);
  useEffect(() => { if (isComposing) titleRef.current?.focus(); }, [isComposing]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (title.trim().length < 2) {
      setFormState("error"); setMessage(copy.untitledError); titleRef.current?.focus(); return;
    }
    if (!content.trim()) { setFormState("error"); setMessage(copy.contentError); return; }

    setFormState("loading"); setMessage("");
    try {
      const response = await api.post<BlogPostSummary>("/blog/posts", {
        title: title.trim(), ...(excerpt.trim() ? { excerpt: excerpt.trim() } : {}), content: content.trim(), status,
        ...(relatedProductId ? { relatedProductId } : {})
      });
      setPosts((current) => [response.data, ...current]);
      setTitle(""); setExcerpt(""); setContent(""); setRelatedProductId(""); setStatus("draft");
      setFormState("success"); setIsComposing(false);
    } catch (error) {
      setFormState("error"); setMessage(requestError(error, copy.createError));
    }
  }

  const formatDate = (value: string) => new Intl.DateTimeFormat(locale === "fa" ? "fa-IR" : locale === "ar" ? "ar" : "en", { dateStyle: "medium" }).format(new Date(value));

  return (
    <section aria-labelledby="blog-title">
      <div className={styles.blogHeading}>
        <div><h2 id="blog-title" className={styles.sectionTitle}>{copy.title}</h2><p>{copy.description}</p></div>
        <button className={`${styles.primaryButton} ${styles.blogAction}`} type="button" onClick={() => { setMessage(""); setFormState("idle"); setIsComposing((current) => !current); }} data-state={formState} aria-expanded={isComposing}>
          {isComposing ? copy.cancel : copy.newPost}
        </button>
      </div>

      {isComposing ? (
        <form className={styles.blogComposer} onSubmit={submit} noValidate>
          <div className={styles.blogComposerLead}>
            <label className={styles.field}><span>{copy.postTitle}</span><input ref={titleRef} required minLength={2} maxLength={200} value={title} onChange={(event) => setTitle(event.target.value)} aria-invalid={formState === "error" && title.trim().length < 2} data-state={formState} /><small>{formState === "error" && title.trim().length < 2 ? copy.untitledError : " "}</small></label>
            <label className={styles.field}><span>{copy.excerpt}</span><textarea maxLength={500} value={excerpt} onChange={(event) => setExcerpt(event.target.value)} data-state={formState} /><small>{copy.excerptHint}</small></label>
          </div>
          <label className={styles.field}><span>{copy.content}</span><textarea className={styles.articleField} required maxLength={50_000} value={content} onChange={(event) => setContent(event.target.value)} aria-invalid={formState === "error" && !content.trim()} data-state={formState} /><small>{formState === "error" && !content.trim() ? copy.contentError : copy.contentHint}</small></label>
          <div className={styles.blogComposerMeta}>
            <label className={styles.field}><span>{copy.relatedProduct}</span><select value={relatedProductId} onChange={(event) => setRelatedProductId(event.target.value)} data-state={formState}><option value="">{copy.noRelatedProduct}</option>{listings.map((listing) => <option key={listing.product.id} value={listing.product.id}>{listing.product.title}</option>)}</select><small> </small></label>
            <label className={styles.field}><span>{copy.publishState}</span><select value={status} onChange={(event) => setStatus(event.target.value as "draft" | "published")} data-state={formState}><option value="draft">{copy.draft}</option><option value="published">{copy.published}</option></select><small> </small></label>
            <button className={`${styles.primaryButton} ${styles.blogAction}`} type="submit" disabled={formState === "loading"} data-state={formState}>{formState === "loading" ? copy.saving : status === "published" ? copy.publish : copy.saveDraft}</button>
          </div>
        </form>
      ) : null}

      {message ? <div className={styles.notice} role="alert"><p>{message}</p>{listState === "error" ? <button className={styles.secondaryButton} type="button" onClick={() => void loadPosts()}>{copy.retry}</button> : null}</div> : null}
      {listState === "loading" && posts.length === 0 ? <div className={styles.skeleton} aria-label={copy.loading}><i /><i /><i /></div> : posts.length === 0 && listState === "success" ? <div className={styles.emptyState}><h3>{copy.empty}</h3><p>{copy.emptyHint}</p><button className={styles.secondaryButton} type="button" onClick={() => setIsComposing(true)}>{copy.newPost}</button></div> : posts.length ? (
        <div className={styles.tableWrap}><table className={styles.productTable}><thead><tr><th>{copy.post}</th><th>{copy.product}</th><th>{copy.status}</th><th>{copy.updated}</th></tr></thead><tbody>{posts.map((post) => <tr key={post.id}><td data-label={copy.post}><strong>{post.title}</strong><small>/{post.slug}</small></td><td data-label={copy.product}>{post.relatedProduct?.title ?? "—"}</td><td data-label={copy.status}><span className={styles.statusBadge} data-status={post.status}>{copy[post.status]}</span></td><td data-label={copy.updated}>{formatDate(post.updatedAt)}</td></tr>)}</tbody></table></div>
      ) : null}
      {nextCursor && listState !== "loading" ? <button className={styles.loadMoreButton} type="button" onClick={() => void loadPosts(nextCursor, true)}>{copy.loadMore}</button> : null}
    </section>
  );
}
