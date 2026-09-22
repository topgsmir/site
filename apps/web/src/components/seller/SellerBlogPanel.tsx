"use client";

import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import type { ManagedBlogPost, BlogTaxonomyTerm } from "@topgsm/shared-types";
import { useEffect, useRef, useState } from "react";
import { BlogPublicUrl } from "@/components/blog/BlogPublicUrl";
import type { Locale } from "@/lib/i18n";
import { api } from "@/lib/api/client";
import styles from "./SellerBlogPanel.module.css";
const COPY = {
  en: { title: "Editorial workspace", description: "Draft in Persian, English, and Arabic. Published articles keep their previous URL live while a revision is reviewed.", newPost: "New article", load: "Loading articles…", empty: "No articles yet", emptyHint: "Create a draft, add all three translations, then submit it for publication.", retry: "Try again", error: "Articles could not be loaded.", edit: "Edit", publicUrl: "Public URL", notPublished: "Not published", updated: "Updated", draft: "Draft", pending_review: "In review", published: "Published", rejected: "Changes requested", archived: "Archived" },
  fa: { title: "فضای بلاگ", description: "نسخه‌های فارسی، انگلیسی و عربی را بنویسید. هنگام بررسی ویرایش جدید، نشانی نسخه منتشرشده همچنان فعال می‌ماند.", newPost: "مقاله جدید", load: "در حال بارگذاری مقاله‌ها…", empty: "هنوز مقاله‌ای ندارید", emptyHint: "یک پیش‌نویس بسازید، هر سه زبان را کامل کنید و برای انتشار بفرستید.", retry: "تلاش دوباره", error: "مقاله‌ها بارگذاری نشدند.", edit: "ویرایش", publicUrl: "نشانی عمومی", notPublished: "منتشر نشده", updated: "به‌روزرسانی", draft: "پیش‌نویس", pending_review: "در حال بررسی", published: "منتشرشده", rejected: "نیازمند اصلاح", archived: "بایگانی‌شده" },
  ar: { title: "مساحة التحرير", description: "اكتب النسخ الفارسية والإنجليزية والعربية. يبقى رابط النسخة المنشورة فعالاً أثناء مراجعة التعديل.", newPost: "مقال جديد", load: "جارٍ تحميل المقالات…", empty: "لا توجد مقالات بعد", emptyHint: "أنشئ مسودة وأكمل اللغات الثلاث ثم أرسلها للنشر.", retry: "إعادة المحاولة", error: "تعذر تحميل المقالات.", edit: "تعديل", publicUrl: "الرابط العام", notPublished: "غير منشور", updated: "آخر تحديث", draft: "مسودة", pending_review: "قيد المراجعة", published: "منشور", rejected: "بحاجة إلى تعديل", archived: "مؤرشف" }
} as const;

const FILTER_COPY = {
  en: { creating: "Creating…", search: "Search articles", placeholder: "Title, slug, or excerpt…", status: "Status", all: "All statuses", category: "Category", categories: "All categories", reset: "Clear filters", noResults: "No matching articles", noResultsHint: "Try another search or clear your filters.", more: "Load more", results: "articles shown", untitled: "Untitled article", uncategorized: "Uncategorized", languages: "Languages", createError: "The draft could not be created. Please try again.", taxonomyError: "Categories could not be loaded.", journal: "View journal" },
  fa: { creating: "در حال ساخت…", search: "جستجوی مقاله", placeholder: "عنوان، نامک یا خلاصه…", status: "وضعیت", all: "همه وضعیت‌ها", category: "دسته‌بندی", categories: "همه دسته‌بندی‌ها", reset: "پاک کردن فیلترها", noResults: "مقاله‌ای پیدا نشد", noResultsHint: "عبارت دیگری جستجو کنید یا فیلترها را پاک کنید.", more: "نمایش بیشتر", results: "مقاله نمایش داده شده", untitled: "مقاله بدون عنوان", uncategorized: "بدون دسته‌بندی", languages: "زبان‌ها", createError: "پیش‌نویس ساخته نشد. دوباره تلاش کنید.", taxonomyError: "دسته‌بندی‌ها بارگذاری نشدند.", journal: "مشاهده مجله" },
  ar: { creating: "جارٍ الإنشاء…", search: "البحث في المقالات", placeholder: "العنوان أو المعرّف أو الملخص…", status: "الحالة", all: "كل الحالات", category: "التصنيف", categories: "كل التصنيفات", reset: "مسح الفلاتر", noResults: "لا توجد مقالات مطابقة", noResultsHint: "جرّب بحثاً آخر أو امسح الفلاتر.", more: "عرض المزيد", results: "مقالات معروضة", untitled: "مقال بلا عنوان", uncategorized: "بلا تصنيف", languages: "اللغات", createError: "تعذر إنشاء المسودة. حاول مجدداً.", taxonomyError: "تعذر تحميل التصنيفات.", journal: "عرض المجلة" }
} as const;
const STATUSES = ["draft", "pending_review", "published", "rejected", "archived"] as const;
type Page = { items: ManagedBlogPost[]; nextCursor: string | null };

export function SellerBlogPanel({ locale, editBase = "seller-dashboard/blog", categoryOptions }: { locale: Locale; editBase?: string; categoryOptions?: BlogTaxonomyTerm[] }) {
  const copy = COPY[locale];
  const c = FILTER_COPY[locale];
  const router = useRouter();
  const [posts, setPosts] = useState<ManagedBlogPost[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [loadedCategories, setCategories] = useState<BlogTaxonomyTerm[]>([]);
  const [taxonomyError, setTaxonomyError] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState(false);
  const [retry, setRetry] = useState(0);
  const generation = useRef(0);
  const morePending = useRef(false);
  const categories = categoryOptions ?? loadedCategories;
  const filtered = Boolean(search.trim() || status || categoryId);
  const params = { search: search.trim() || undefined, status: status || undefined, categoryId: categoryId || undefined, limit: 20 };

  useEffect(() => {
    const controller = new AbortController();
    if (categoryOptions) return;
    api.get<{ categories: BlogTaxonomyTerm[] }>("/blog/manage/taxonomy", { signal: controller.signal })
      .then((response) => { setCategories(response.data.categories); setTaxonomyError(false); })
      .catch(() => { if (!controller.signal.aborted) setTaxonomyError(true); });
    return () => controller.abort();
  }, [retry, categoryOptions]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setState("loading"); setMoreError(false); setLoadingMore(false); morePending.current = false;
      try {
        const response = await api.get<Page>("/blog/manage/posts", {
          params: { search: search.trim() || undefined, status: status || undefined, categoryId: categoryId || undefined, limit: 20 },
          signal: controller.signal
        });
        if (controller.signal.aborted) return;
        setPosts(response.data.items); setNextCursor(response.data.nextCursor); setState("ready");
      } catch { if (!controller.signal.aborted) setState("error"); }
    }, 300);
    return () => { window.clearTimeout(timer); controller.abort(); generation.current += 1; };
  }, [search, status, categoryId, retry]);

  function changeFilter(setter: (value: string) => void, value: string) {
    generation.current += 1; setState("loading"); setter(value);
  }
  function reset() { generation.current += 1; setState("loading"); setSearch(""); setStatus(""); setCategoryId(""); }
  async function loadMore() {
    if (!nextCursor || morePending.current) return;
    morePending.current = true;
    const current = generation.current;
    setLoadingMore(true); setMoreError(false);
    try {
      const response = await api.get<Page>("/blog/manage/posts", { params: { ...params, cursor: nextCursor } });
      if (current !== generation.current) return;
      setPosts((previous) => [...previous, ...response.data.items.filter((post) => !previous.some((item) => item.id === post.id))]);
      setNextCursor(response.data.nextCursor);
    } catch { if (current === generation.current) setMoreError(true); }
    finally { if (current === generation.current) { setLoadingMore(false); morePending.current = false; } }
  }
  async function create() {
    if (creating) return;
    setCreating(true); setCreateError(false);
    try {
      const response = await api.post<ManagedBlogPost>("/blog/manage/posts", {});
      router.push(`/${locale}/${editBase}/${response.data.id}` as Route);
    } catch { setCreateError(true); setCreating(false); }
  }
  const format = (value: string) => new Intl.DateTimeFormat(locale === "fa" ? "fa-IR" : locale, { dateStyle: "medium" }).format(new Date(value));
  return <section className={styles.panel} aria-labelledby="blog-title">
    <header className={styles.heading}>
      <div><h2 id="blog-title">{copy.title}</h2><p>{copy.description}</p><Link className={styles.journal} href={`/${locale}/blog` as Route}>{c.journal} ↗</Link></div>
      <button className={styles.primary} type="button" onClick={() => void create()} disabled={creating}>{creating ? c.creating : `+ ${copy.newPost}`}</button>
    </header>
    {createError ? <p className={styles.error} role="alert">{c.createError}</p> : null}
    <div className={styles.library}>
      <div className={styles.filters}>
        <label className={styles.search}>{c.search}<input type="search" maxLength={100} value={search} placeholder={c.placeholder} onChange={(event) => changeFilter(setSearch, event.target.value)} /></label>
        <label>{c.status}<select value={status} onChange={(event) => changeFilter(setStatus, event.target.value)}><option value="">{c.all}</option>{STATUSES.map((value) => <option key={value} value={value}>{copy[value]}</option>)}</select></label>
        <label>{c.category}<select value={categoryId} onChange={(event) => changeFilter(setCategoryId, event.target.value)}><option value="">{c.categories}</option>{categories.map((term) => <option key={term.id} value={term.id}>{term.translations.find((item) => item.locale === locale)?.name ?? term.translations[0]?.name}</option>)}</select></label>
      </div>
      {taxonomyError ? <p className={styles.error} role="alert">{c.taxonomyError} <button className={styles.secondary} onClick={() => setRetry((value) => value + 1)}>{copy.retry}</button></p> : null}
      <div className={styles.resultBar}><span role="status">{state === "loading" ? copy.load : state === "ready" ? `${posts.length.toLocaleString(locale)} ${c.results}` : copy.error}</span>{filtered ? <button type="button" onClick={reset}>{c.reset}</button> : null}</div>
      {state === "loading" ? <div className={styles.skeleton} aria-label={copy.load}><i /><i /><i /></div> : null}
      {state === "error" ? <div className={styles.empty} role="alert"><p>{copy.error}</p><button className={styles.secondary} onClick={() => setRetry((value) => value + 1)}>{copy.retry}</button></div> : null}
      {state === "ready" && posts.length === 0 ? <div className={styles.empty}><h3>{filtered ? c.noResults : copy.empty}</h3><p>{filtered ? c.noResultsHint : copy.emptyHint}</p>{filtered ? <button className={styles.secondary} onClick={reset}>{c.reset}</button> : null}</div> : null}
      {state === "ready" ? <div className={styles.articles}>{posts.map((post) => {
        const translation = post.translations.find((item) => item.locale === locale) ?? post.translations[0];
        const publicSlug = post.archivedAt ? undefined : post.publicSlugs[locale];
        const displayState = post.archivedAt ? "archived" : post.state;
        const category = post.category?.translations.find((item) => item.locale === locale) ?? post.category?.translations[0];
        return <article key={post.id} className={styles.article}>
          <div className={styles.articleMain}>
            <div className={styles.meta}><span className={styles.badge} data-status={displayState}>{copy[displayState]}</span><span>{category?.name ?? c.uncategorized}</span>{post.seller && editBase === "admin/blog" ? <span>{post.seller.shopName}</span> : null}</div>
            <h3><Link href={`/${locale}/${editBase}/${post.id}` as Route}>{translation?.title || c.untitled}</Link></h3>
            {translation?.excerpt ? <p className={styles.excerpt}>{translation.excerpt}</p> : null}
            <div className={styles.details}><time dateTime={post.updatedAt}>{copy.updated} {format(post.updatedAt)}</time><span aria-label={c.languages} className={styles.languages}>{post.translations.filter((item) => item.title.trim()).map((item) => <span key={item.locale}>{item.locale.toUpperCase()}</span>)}</span></div>
            {post.moderationNote ? <p className={styles.note}>{post.moderationNote}</p> : null}
          </div>
          <div className={styles.actions}><Link className={styles.secondary} href={`/${locale}/${editBase}/${post.id}` as Route} aria-label={`${copy.edit}: ${translation?.title || c.untitled}`}>{copy.edit}</Link>{publicSlug ? <BlogPublicUrl className={styles.publicUrl} locale={locale} slug={publicSlug} label={`${copy.publicUrl} — ${translation?.title || c.untitled}`} /> : <span>{copy.notPublished}</span>}</div>
        </article>;
      })}</div> : null}
      {state === "ready" && nextCursor ? <footer className={styles.footer}>{moreError ? <p role="alert">{copy.error}</p> : null}<button className={styles.secondary} type="button" disabled={loadingMore} onClick={() => void loadMore()}>{loadingMore ? copy.load : moreError ? copy.retry : c.more}</button></footer> : null}
    </div>
  </section>;
}
