"use client";

import type { Route } from "next";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import type { AppUser, CommentPage, CommentPostingPolicy, ProductComment } from "@topgsm/shared-types";
import type { Locale } from "@/lib/i18n";
import { api } from "@/lib/api/client";
import { captchaTokenFor } from "@/lib/security-captcha";
import styles from "./Comments.module.css";

const copy = {
  en: { title: "Customer comments", intro: "Questions and experiences from customers, with answers from sellers.", empty: "No comments yet.", name: "Your name", body: "Your comment", submit: "Send comment", sending: "Sending…", signIn: "Sign in to comment", purchase: "Only customers who bought this product can comment.", pending: "Your comment was sent for review.", approved: "Your comment is now visible.", error: "Comments could not be loaded.", submitError: "Your comment could not be sent. Check your eligibility and try again.", more: "Load more", seller: "Seller reply" },
  fa: { title: "دیدگاه‌های مشتریان", intro: "نظرها و پرسش‌های مشتریان، همراه با پاسخ فروشنده‌ها.", empty: "هنوز دیدگاهی ثبت نشده است.", name: "نام شما", body: "دیدگاه شما", submit: "ثبت دیدگاه", sending: "در حال ارسال…", signIn: "برای ثبت دیدگاه وارد شوید", purchase: "فقط خریداران این محصول می‌توانند دیدگاه بگذارند.", pending: "دیدگاه شما برای بررسی فرستاده شد.", approved: "دیدگاه شما منتشر شد.", error: "دیدگاه‌ها دریافت نشدند.", submitError: "دیدگاه ثبت نشد. شرایط ثبت را بررسی کنید و دوباره تلاش کنید.", more: "نمایش بیشتر", seller: "پاسخ فروشنده" },
  ar: { title: "تعليقات العملاء", intro: "آراء العملاء وأسئلتهم مع ردود البائعين.", empty: "لا توجد تعليقات بعد.", name: "اسمك", body: "تعليقك", submit: "إرسال التعليق", sending: "جار الإرسال…", signIn: "سجّل الدخول للتعليق", purchase: "يمكن لمن اشتروا هذا المنتج فقط التعليق.", pending: "أُرسل تعليقك للمراجعة.", approved: "تعليقك ظاهر الآن.", error: "تعذر تحميل التعليقات.", submitError: "تعذر إرسال تعليقك. تحقق من أهليتك وحاول مجددًا.", more: "عرض المزيد", seller: "رد البائع" }
} as const;

export function ProductComments({ productId, locale }: { productId: string; locale: Locale }) {
  const c = copy[locale];
  const [items, setItems] = useState<ProductComment[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [policy, setPolicy] = useState<CommentPostingPolicy>("purchasers");
  const [user, setUser] = useState<AppUser | null>(null);
  const [ready, setReady] = useState(false);
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async (next?: string) => {
    setLoading(true);
    try {
      const response = await api.get<CommentPage<ProductComment>>(`/comments/products/${productId}`, { params: { limit: 20, ...(next ? { cursor: next } : {}) } });
      setItems((current) => next ? [...current, ...response.data.items] : response.data.items);
      setCursor(response.data.nextCursor);
    } catch { setError(c.error); }
    finally { setLoading(false); }
  }, [productId, c.error]);

  useEffect(() => {
    void load();
    void Promise.allSettled([api.get<{ postingPolicy: CommentPostingPolicy }>("/comments/settings"), api.get<AppUser>("/auth/me")]).then(([settings, account]) => {
      if (settings.status === "fulfilled") setPolicy(settings.value.data.postingPolicy);
      if (account.status === "fulfilled") setUser(account.value.data);
      setReady(true);
    });
  }, [load]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSending(true); setError(""); setMessage("");
    try {
      const captchaToken = user ? undefined : await captchaTokenFor("comment_submit_guest");
      const response = await api.post<{ status: string }>(`/comments/products/${productId}`, { body: body.trim(), ...(user ? {} : { guestName: name.trim(), ...(captchaToken ? { captchaToken } : {}) }) });
      setBody(""); setName(""); setMessage(response.data.status === "approved" ? c.approved : c.pending);
      if (response.data.status === "approved") await load();
    } catch { setError(c.submitError); }
    finally { setSending(false); }
  }

  const canPost = user?.role === "buyer" || (!user && policy === "guests");
  return <section className={styles.section} dir={locale === "en" ? "ltr" : "rtl"} aria-labelledby="product-comments-title">
    <header className={styles.header}><h2 id="product-comments-title">{c.title}</h2><p>{c.intro}</p></header>
    {ready && canPost ? <form className={styles.card} onSubmit={submit}>
      {!user ? <div className={styles.guest}><label htmlFor="comment-guest-name">{c.name}</label><input id="comment-guest-name" required maxLength={100} value={name} onChange={(event) => setName(event.target.value)} /></div> : null}
      <label htmlFor="product-comment-body">{c.body}</label><textarea id="product-comment-body" required maxLength={2000} value={body} onChange={(event) => setBody(event.target.value)} />
      <div><button className={styles.primary} type="submit" disabled={sending || !body.trim()}>{sending ? c.sending : c.submit}</button></div>
    </form> : ready && !user ? <p><Link href={`/${locale}/login` as Route}>{c.signIn}</Link></p> : ready && policy === "purchasers" && user?.role === "buyer" ? <p>{c.purchase}</p> : null}
    {error ? <p className={styles.error} role="alert">{error}</p> : null}{message ? <p className={styles.success} role="status">{message}</p> : null}
    {!loading && !items.length ? <p className={styles.empty}>{c.empty}</p> : <div className={styles.list}>{items.map((item) => <article className={styles.card} key={item.id}><div className={styles.meta}><strong>{item.authorName}</strong><time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleDateString(locale)}</time></div><p>{item.body}</p>{item.replies.map((reply, index) => <div className={styles.reply} key={index}><strong>{c.seller} · {reply.sellerName}</strong><p>{reply.body}</p></div>)}</article>)}</div>}
    {cursor && !loading ? <button className={styles.more} type="button" onClick={() => void load(cursor)}>{c.more}</button> : null}
  </section>;
}
