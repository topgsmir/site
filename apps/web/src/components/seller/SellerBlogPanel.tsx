"use client";

import axios from "axios";
import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import type { ManagedBlogPost, SellerListing } from "@topgsm/shared-types";
import { useCallback, useEffect, useState } from "react";
import type { Locale } from "@/lib/i18n";
import { api } from "@/lib/api/client";
import styles from "./SellerDashboard.module.css";

const COPY = {
  en: { title: "Editorial workspace", description: "Draft in Persian, English, and Arabic. Published articles keep their previous URL live while a revision is reviewed.", newPost: "New article", load: "Loading articles…", empty: "No articles yet", emptyHint: "Create a draft, add all three translations, then submit it for publication.", retry: "Try again", error: "Articles could not be loaded.", open: "Open editor", updated: "Updated", draft: "Draft", pending_review: "In review", published: "Published", rejected: "Changes requested" },
  fa: { title: "فضای تحریریه", description: "نسخه‌های فارسی، انگلیسی و عربی را بنویسید. هنگام بررسی ویرایش جدید، نشانی نسخه منتشرشده همچنان فعال می‌ماند.", newPost: "مقاله جدید", load: "در حال بارگذاری مقاله‌ها…", empty: "هنوز مقاله‌ای ندارید", emptyHint: "یک پیش‌نویس بسازید، هر سه زبان را کامل کنید و برای انتشار بفرستید.", retry: "تلاش دوباره", error: "مقاله‌ها بارگذاری نشدند.", open: "بازکردن ویرایشگر", updated: "به‌روزرسانی", draft: "پیش‌نویس", pending_review: "در حال بررسی", published: "منتشرشده", rejected: "نیازمند اصلاح" },
  ar: { title: "مساحة التحرير", description: "اكتب النسخ الفارسية والإنجليزية والعربية. يبقى رابط النسخة المنشورة فعالاً أثناء مراجعة التعديل.", newPost: "مقال جديد", load: "جارٍ تحميل المقالات…", empty: "لا توجد مقالات بعد", emptyHint: "أنشئ مسودة وأكمل اللغات الثلاث ثم أرسلها للنشر.", retry: "إعادة المحاولة", error: "تعذر تحميل المقالات.", open: "فتح المحرر", updated: "آخر تحديث", draft: "مسودة", pending_review: "قيد المراجعة", published: "منشور", rejected: "بحاجة إلى تعديل" }
} as const;

export function SellerBlogPanel({
  locale,
  editBase = "seller-dashboard/blog"
}: {
  locale: Locale;
  listings?: SellerListing[];
  editBase?: string;
}) {
  const copy = COPY[locale];
  const router = useRouter();
  const [posts, setPosts] = useState<ManagedBlogPost[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setState("loading");
    try {
      const response = await api.get<{ items: ManagedBlogPost[] }>("/blog/manage/posts", { params: { limit: 30 } });
      setPosts(response.data.items);
      setState("ready");
    } catch { setState("error"); }
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function create() {
    setCreating(true);
    try {
      const response = await api.post<ManagedBlogPost>("/blog/manage/posts", {});
      router.push(`/${locale}/${editBase}/${response.data.id}` as Route);
    } catch (error) {
      setState("error");
      if (axios.isAxiosError(error)) console.error(error.response?.data?.message);
    } finally { setCreating(false); }
  }

  const format = (value: string) => new Intl.DateTimeFormat(locale === "fa" ? "fa-IR" : locale, { dateStyle: "medium" }).format(new Date(value));
  return (
    <section aria-labelledby="blog-title">
      <div className={styles.blogHeading}>
        <div><h2 id="blog-title" className={styles.sectionTitle}>{copy.title}</h2><p>{copy.description}</p></div>
        <button className={styles.primaryButton} type="button" onClick={() => void create()} disabled={creating}>{creating ? "…" : copy.newPost}</button>
      </div>
      {state === "loading" ? <div className={styles.skeleton} aria-label={copy.load}><i /><i /><i /></div> : null}
      {state === "error" ? <div className={styles.notice} role="alert"><p>{copy.error}</p><button className={styles.secondaryButton} type="button" onClick={() => void load()}>{copy.retry}</button></div> : null}
      {state === "ready" && posts.length === 0 ? <div className={styles.emptyState}><h3>{copy.empty}</h3><p>{copy.emptyHint}</p><button className={styles.secondaryButton} type="button" onClick={() => void create()}>{copy.newPost}</button></div> : null}
      {posts.length ? <div className={styles.tableWrap}><table className={styles.productTable}><thead><tr><th>{copy.title}</th><th>Status</th><th>{copy.updated}</th><th /></tr></thead><tbody>{posts.map((post) => {
        const translation = post.translations.find((item) => item.locale === locale) ?? post.translations[0];
        return <tr key={post.id}><td data-label={copy.title}><strong>{translation?.title || copy.empty}</strong><small>r{post.revision} · v{post.optimisticVersion}</small></td><td data-label="Status"><span className={styles.statusBadge} data-status={post.state}>{copy[post.state]}</span>{post.moderationNote ? <small>{post.moderationNote}</small> : null}</td><td data-label={copy.updated}>{format(post.updatedAt)}</td><td><Link className={styles.secondaryButton} href={`/${locale}/${editBase}/${post.id}` as Route}>{copy.open}</Link></td></tr>;
      })}</tbody></table></div> : null}
    </section>
  );
}
