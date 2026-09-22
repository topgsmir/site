"use client";

import type { Route } from "next";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { CommentPage, SellerComment } from "@topgsm/shared-types";
import type { Locale } from "@/lib/i18n";
import { api } from "@/lib/api/client";
import { LogoutButton } from "@/components/auth/LogoutButton";
import styles from "./Comments.module.css";

const copy = {
  en: { title: "Comments", locked: "Answer unanswered product comments or flag spam to return to your workspace.", normal: "Reply to comments about your products and articles.", product: "Product", blog: "Article", loading: "Loading comments…", empty: "No comments need your attention.", reply: "Reply", replying: "Sending…", flag: "Flag as spam", answer: "Your answer", more: "Load more", error: "Comments could not be loaded. Try again.", actionError: "The action failed. Refresh and try again.", back: "Back to dashboard", outstanding: "unanswered", refresh: "Refresh" },
  fa: { title: "دیدگاه‌ها", locked: "برای بازگشت به پنل، به دیدگاه‌های بی‌پاسخ محصول جواب دهید یا موارد هرزنامه را گزارش کنید.", normal: "به دیدگاه‌های محصولات و مقاله‌های خود پاسخ دهید.", product: "محصول", blog: "مقاله", loading: "در حال دریافت دیدگاه‌ها…", empty: "دیدگاهی در انتظار پاسخ نیست.", reply: "ارسال پاسخ", replying: "در حال ارسال…", flag: "گزارش هرزنامه", answer: "پاسخ شما", more: "نمایش بیشتر", error: "دیدگاه‌ها دریافت نشدند. دوباره تلاش کنید.", actionError: "انجام این کار ممکن نبود. صفحه را تازه کنید.", back: "بازگشت به پنل", outstanding: "بی‌پاسخ", refresh: "تازه‌سازی" },
  ar: { title: "التعليقات", locked: "أجب عن تعليقات المنتجات أو أبلغ عن الرسائل المزعجة للعودة إلى لوحة البائع.", normal: "أجب عن التعليقات على منتجاتك ومقالاتك.", product: "منتج", blog: "مقال", loading: "جار تحميل التعليقات…", empty: "لا توجد تعليقات تنتظر ردك.", reply: "إرسال الرد", replying: "جار الإرسال…", flag: "الإبلاغ كرسالة مزعجة", answer: "ردك", more: "عرض المزيد", error: "تعذر تحميل التعليقات. حاول مجددًا.", actionError: "تعذر إكمال الإجراء. حدّث الصفحة.", back: "العودة إلى اللوحة", outstanding: "بلا رد", refresh: "تحديث" }
} as const;

export function SellerCommentsWorkspace({ locale, locked = false }: { locale: Locale; locked?: boolean }) {
  const c = copy[locale];
  const [items, setItems] = useState<SellerComment[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const load = useCallback(async (next?: string) => {
    setLoading(true); setError("");
    try {
      const response = await api.get<CommentPage<SellerComment>>("/comments/seller", { params: { limit: 20, locale, ...(next ? { cursor: next } : {}) } });
      setItems((current) => next ? [...current, ...response.data.items] : response.data.items);
      setCursor(response.data.nextCursor);
    } catch { setError(c.error); }
    finally { setLoading(false); }
  }, [c.error, locale]);
  useEffect(() => { void load(); }, [load]);

  async function act(id: string, action: "reply" | "flag") {
    setBusy(id); setError("");
    try {
      await api.post(`/comments/seller/${id}/${action}`, action === "reply" ? { body: drafts[id]?.trim() } : undefined);
      await load();
      if (locked) {
        const result = await api.get<{ locked: boolean }>("/comments/seller/status");
        if (!result.data.locked) window.location.reload();
      }
    } catch { setError(c.actionError); }
    finally { setBusy(null); }
  }

  return <main className={styles.section} dir={locale === "en" ? "ltr" : "rtl"}>
    <header className={styles.header}><span>{locked ? c.outstanding : c.title}</span><h1>{c.title}</h1><p>{locked ? c.locked : c.normal}</p></header>
    <div className={styles.toolbar}>{!locked ? <Link href={`/${locale}/seller-dashboard` as Route}>{c.back}</Link> : null}<button type="button" onClick={() => void load()}>{c.refresh}</button><LogoutButton locale={locale} /></div>
    {error ? <p className={styles.error} role="alert">{error}</p> : null}
    {loading && !items.length ? <p>{c.loading}</p> : null}
    {!loading && !items.length ? <p className={styles.empty}>{c.empty}</p> : null}
    <div className={styles.list}>{items.map((item) => <article className={styles.card} key={item.id}>
      <div className={styles.meta}><strong><Link href={`/${locale}/${item.target.type === "product" ? "products" : "blog"}/${item.target.slug}` as Route}>{item.target.title}</Link></strong><span>{c[item.target.type]}</span><span>· {item.authorName}</span><time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleDateString(locale)}</time></div>
      <p>{item.body}</p>
      {item.reply ? <div className={styles.reply}><strong>{c.reply}</strong><p>{item.reply}</p></div> : <form onSubmit={(event) => { event.preventDefault(); void act(item.id, "reply"); }}>
        <label htmlFor={`reply-${item.id}`}>{c.answer}</label><textarea id={`reply-${item.id}`} maxLength={2000} required value={drafts[item.id] ?? ""} onChange={(event) => setDrafts((current) => ({ ...current, [item.id]: event.target.value }))} />
        <div className={styles.actions}><button className={styles.primary} type="submit" disabled={busy === item.id || !drafts[item.id]?.trim()}>{busy === item.id ? c.replying : c.reply}</button><button className={styles.danger} type="button" disabled={busy === item.id} onClick={() => void act(item.id, "flag")}>{c.flag}</button></div>
      </form>}
    </article>)}</div>
    {cursor && !loading ? <button className={styles.more} type="button" onClick={() => void load(cursor)}>{c.more}</button> : null}
  </main>;
}
