"use client";

import type { Route } from "next";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import type { AdminComment, CommentPage, CommentPublicationPolicy, CommentSettings, CommentStatus, CommentPostingPolicy, CommentTargetType } from "@topgsm/shared-types";
import type { Locale } from "@/lib/i18n";
import { api } from "@/lib/api/client";
import { CollapsibleFilters } from "@/components/dashboard/CollapsibleFilters";
import styles from "./AdminCommentsWorkspace.module.css";

const copy = {
  en: { title: "Comments", intro: "Set the posting rules, review comments, and resolve spam reports.", lock: "Require seller replies", lockHint: "Only unanswered product comments lock a seller; article comments never do.", posting: "Who may comment", purchasers: "Verified purchasers", buyers: "Signed-in buyers", guests: "Guests too", publication: "Signed-in comment publication", approval: "Admin approval", immediate: "Immediately", guestHint: "Guest comments always require approval.", blogPolicy: "On articles, both verified-purchaser and signed-in-buyer modes allow any signed-in buyer.", risk: "Immediate publication can let one signed-in buyer lock every product seller. Use approval or verified purchasers if that risk is unacceptable.", save: "Save settings", saved: "Settings saved.", all: "All comments", product: "Products", blog: "Articles", spamQueue: "Spam review", search: "Search comment, target, or author", searchButton: "Search", allStatuses: "All statuses", pending: "Pending", approved: "Published", rejected: "Rejected", spam_review: "Spam review", spam: "Spam", approve: "Approve", reject: "Reject / hide", confirmSpam: "Confirm spam", restore: "Restore", reply: "Reply", replying: "Sending…", flag: "Flag as spam", answer: "Editorial reply", viewTarget: "View post", previous: "Previous", next: "Next", page: "Page", empty: "No comments match this view.", error: "Comments could not be loaded.", actionError: "Action failed. Refresh and try again.", loading: "Loading…" },
  fa: { title: "دیدگاه‌ها", intro: "قانون ثبت دیدگاه را تنظیم کنید، دیدگاه‌ها را بررسی کنید و درباره گزارش‌های هرزنامه تصمیم بگیرید.", lock: "پاسخ‌گویی فروشنده الزامی باشد", lockHint: "فقط دیدگاه بی‌پاسخ محصول فروشنده را محدود می‌کند؛ دیدگاه مقاله چنین اثری ندارد.", posting: "چه کسانی دیدگاه بگذارند", purchasers: "خریداران تأییدشده", buyers: "خریداران واردشده", guests: "مهمانان هم مجاز باشند", publication: "انتشار دیدگاه کاربران واردشده", approval: "پس از تأیید مدیر", immediate: "بلافاصله", guestHint: "دیدگاه مهمان همیشه به تأیید مدیر نیاز دارد.", blogPolicy: "در مقاله‌ها، هر دو حالت خریدار تأییدشده و خریدار واردشده به همه خریداران واردشده اجازه ثبت دیدگاه می‌دهد.", risk: "با انتشار فوری، یک خریدار واردشده می‌تواند فروشنده‌های محصول را محدود کند. اگر این خطر پذیرفتنی نیست، تأیید مدیر یا فقط خریداران تأییدشده را انتخاب کنید.", save: "ذخیره تنظیمات", saved: "تنظیمات ذخیره شد.", all: "همه دیدگاه‌ها", product: "محصولات", blog: "مقاله‌ها", spamQueue: "بررسی هرزنامه", search: "جست‌وجوی متن، محتوا یا نویسنده", searchButton: "جست‌وجو", allStatuses: "همه وضعیت‌ها", pending: "در انتظار", approved: "منتشرشده", rejected: "ردشده", spam_review: "بررسی هرزنامه", spam: "هرزنامه", approve: "تأیید", reject: "رد / پنهان‌کردن", confirmSpam: "تأیید هرزنامه", restore: "بازگردانی", reply: "ارسال پاسخ", replying: "در حال ارسال…", flag: "گزارش هرزنامه", answer: "پاسخ تحریریه", viewTarget: "مشاهده محتوا", previous: "قبلی", next: "بعدی", page: "صفحه", empty: "دیدگاهی با این فیلتر پیدا نشد.", error: "دیدگاه‌ها دریافت نشدند.", actionError: "انجام این کار ممکن نبود. دوباره تلاش کنید.", loading: "در حال بارگذاری…" },
  ar: { title: "التعليقات", intro: "اضبط قواعد التعليقات وراجعها واحسم بلاغات الرسائل المزعجة.", lock: "إلزام البائعين بالرد", lockHint: "تعليقات المنتجات غير المجابة فقط تقيد البائع؛ تعليقات المقالات لا تفعل ذلك.", posting: "من يمكنه التعليق", purchasers: "المشترون المؤكدون", buyers: "المشترون المسجلون", guests: "الضيوف أيضًا", publication: "نشر تعليقات المسجلين", approval: "بعد موافقة المدير", immediate: "فورًا", guestHint: "تعليقات الضيوف تحتاج دائمًا إلى الموافقة.", blogPolicy: "في المقالات يسمح وضعا المشتري المؤكد والمشتري المسجل لأي مشترٍ مسجل بالتعليق.", risk: "النشر الفوري قد يتيح لمشترٍ مسجل تقييد بائعي المنتجات. اختر موافقة المدير أو المشترين المؤكدين إذا كان ذلك غير مقبول.", save: "حفظ الإعدادات", saved: "حُفظت الإعدادات.", all: "كل التعليقات", product: "المنتجات", blog: "المقالات", spamQueue: "مراجعة الرسائل المزعجة", search: "ابحث في التعليق أو المحتوى أو الكاتب", searchButton: "بحث", allStatuses: "كل الحالات", pending: "قيد الانتظار", approved: "منشور", rejected: "مرفوض", spam_review: "مراجعة الإزعاج", spam: "مزعج", approve: "موافقة", reject: "رفض / إخفاء", confirmSpam: "تأكيد الإزعاج", restore: "استعادة", reply: "إرسال الرد", replying: "جار الإرسال…", flag: "الإبلاغ كرسالة مزعجة", answer: "رد هيئة التحرير", viewTarget: "عرض المحتوى", previous: "السابق", next: "التالي", page: "الصفحة", empty: "لا توجد تعليقات مطابقة.", error: "تعذر تحميل التعليقات.", actionError: "تعذر إكمال الإجراء. حاول مجددًا.", loading: "جار التحميل…" }
} as const;

export function AdminCommentsWorkspace({ locale }: { locale: Locale }) {
  const c = copy[locale];
  const [settings, setSettings] = useState<CommentSettings | null>(null);
  const [lock, setLock] = useState(false);
  const [posting, setPosting] = useState<CommentPostingPolicy>("purchasers");
  const [publication, setPublication] = useState<CommentPublicationPolicy>("approval");
  const [items, setItems] = useState<AdminComment[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageCursors, setPageCursors] = useState<Array<string | undefined>>([undefined]);
  const [filter, setFilter] = useState<CommentStatus | "">("");
  const [target, setTarget] = useState<CommentTargetType | "">("");
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async (pageCursor?: string) => {
    setLoading(true); setError("");
    try {
      const response = await api.get<CommentPage<AdminComment>>("/admin/settings/comments", { params: { limit: 10, locale, ...(filter ? { status: filter } : {}), ...(target ? { target } : {}), ...(appliedSearch ? { search: appliedSearch } : {}), ...(pageCursor ? { cursor: pageCursor } : {}) } });
      setItems(response.data.items);
      setCursor(response.data.nextCursor);
    } catch { setError(c.error); }
    finally { setLoading(false); }
  }, [filter, target, appliedSearch, locale, c.error]);

  useEffect(() => { setPage(1); setPageCursors([undefined]); void load(); }, [load]);
  useEffect(() => { void api.get<CommentSettings>("/admin/settings/comments/settings").then(({ data }) => { setSettings(data); setLock(data.sellerLockEnabled); setPosting(data.postingPolicy); setPublication(data.publicationPolicy); }).catch(() => setError(c.error)); }, [c.error]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(""); setMessage("");
    try {
      const { data } = await api.patch<CommentSettings>("/admin/settings/comments/settings", { sellerLockEnabled: lock, postingPolicy: posting, publicationPolicy: publication });
      setSettings(data); setMessage(c.saved);
    } catch { setError(c.actionError); }
    finally { setSaving(false); }
  }

  async function act(id: string, action: "approve" | "reject" | "spam" | "restore" | "reply" | "flag") {
    setBusy(id); setError("");
    try {
      await api.post(`/admin/settings/comments/${id}/${action}`, action === "reply" ? { body: drafts[id]?.trim() } : undefined);
      await load(pageCursors[page - 1]);
    } catch { setError(c.actionError); }
    finally { setBusy(null); }
  }

  function nextPage() {
    if (!cursor || loading) return;
    const nextPage = page + 1;
    setPageCursors((current) => [...current.slice(0, page), cursor]);
    setPage(nextPage);
    void load(cursor);
  }

  function previousPage() {
    if (page === 1 || loading) return;
    const previousPage = page - 1;
    setPage(previousPage);
    void load(pageCursors[previousPage - 1]);
  }

  return <main className={styles.section} dir={locale === "en" ? "ltr" : "rtl"}>
    <header className={styles.header}><h1>{c.title}</h1><p>{c.intro}</p></header>
    {error ? <p className={styles.error} role="alert">{error}</p> : null}{message ? <p className={styles.success} role="status">{message}</p> : null}
    {settings ? <form className={styles.settings} onSubmit={save}>
      <div className={styles.settingRow}><div><strong>{c.lock}</strong><small>{c.lockHint}</small></div><label className={styles.toggle}><span className={styles.visuallyHidden}>{c.lock}</span><input type="checkbox" checked={lock} disabled={saving} onChange={(event) => setLock(event.target.checked)} /><span aria-hidden="true"><i /></span></label></div>
      <div className={styles.selectGrid}><label>{c.posting}<select value={posting} disabled={saving} onChange={(event) => setPosting(event.target.value as CommentPostingPolicy)}><option value="purchasers">{c.purchasers}</option><option value="buyers">{c.buyers}</option><option value="guests">{c.guests}</option></select><small>{c.blogPolicy}</small></label>
      <label>{c.publication}<select value={publication} disabled={saving} onChange={(event) => setPublication(event.target.value as CommentPublicationPolicy)}><option value="approval">{c.approval}</option><option value="immediate">{c.immediate}</option></select><small>{c.guestHint}</small></label></div>
      {lock && posting !== "purchasers" && publication === "immediate" ? <p className={styles.notice} role="status">{c.risk}</p> : null}
      <div className={styles.settingsActions}><button className={styles.primary} type="submit" disabled={saving}>{c.save}</button></div>
    </form> : <p className={styles.loading}>{c.loading}</p>}
    <CollapsibleFilters locale={locale} title={c.search} activeCount={[filter, target, appliedSearch].filter(Boolean).length}>
      <div className={styles.tabs}><button type="button" aria-pressed={target === ""} onClick={() => setTarget("")}>{c.all}</button><button type="button" aria-pressed={target === "product"} onClick={() => setTarget("product")}>{c.product}</button><button type="button" aria-pressed={target === "blog"} onClick={() => setTarget("blog")}>{c.blog}</button><button type="button" aria-pressed={filter === "spam_review"} onClick={() => setFilter("spam_review")}>{c.spamQueue}</button></div>
      <form className={styles.toolbar} onSubmit={(event) => { event.preventDefault(); setAppliedSearch(search.trim()); }}><input type="search" aria-label={c.search} placeholder={c.search} value={search} maxLength={100} onChange={(event) => setSearch(event.target.value)} /><button type="submit">{c.searchButton}</button><select aria-label={c.allStatuses} value={filter} onChange={(event) => setFilter(event.target.value as CommentStatus | "")}><option value="">{c.allStatuses}</option>{(["pending", "approved", "rejected", "spam_review", "spam"] as const).map((value) => <option key={value} value={value}>{c[value]}</option>)}</select></form>
    </CollapsibleFilters>
    {loading && !items.length ? <p className={styles.loading} role="status">{c.loading}</p> : null}{!loading && !items.length && !error ? <p className={styles.empty}>{c.empty}</p> : null}
    <div className={styles.list}>{items.map((item) => <article className={styles.card} key={item.id}>
      <header className={styles.cardHeader}>
        <div className={styles.targetDetails}>
          <span className={styles.targetType}>{c[item.target.type]}</span>
          <Link className={styles.postLink} href={`/${locale}/${item.target.type === "product" ? "products" : "blog"}/${item.target.slug}` as Route} aria-label={`${c.viewTarget}: ${item.target.title}`}>
            <span>{item.target.title}</span>
            <span className={styles.linkAction}>{c.viewTarget}<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 16 16 8M9 8h7v7" /></svg></span>
          </Link>
        </div>
        <div className={styles.meta}><strong>{item.authorName}</strong><span aria-hidden="true">·</span><time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleDateString(locale)}</time></div>
        <span className={styles.status} data-status={item.status}>{c[item.status]}</span>
      </header>
      <p className={styles.body}>{item.body}</p>
      {item.replies.map((reply, index) => reply.body ? <div className={styles.reply} key={index}><strong>{reply.authorName}</strong><p>{reply.body}</p></div> : null)}
      {item.canReply ? <form onSubmit={(event) => { event.preventDefault(); void act(item.id, "reply"); }}><label htmlFor={`editorial-reply-${item.id}`}>{c.answer}</label><textarea id={`editorial-reply-${item.id}`} maxLength={2000} required value={drafts[item.id] ?? ""} onChange={(event) => setDrafts((current) => ({ ...current, [item.id]: event.target.value }))} /><button className={styles.primary} type="submit" disabled={busy === item.id || !drafts[item.id]?.trim()}>{busy === item.id ? c.replying : c.reply}</button></form> : null}
      <div className={styles.actions}>{item.status === "pending" ? <><button type="button" disabled={busy === item.id} onClick={() => void act(item.id, "approve")}>{c.approve}</button><button className={styles.danger} type="button" disabled={busy === item.id} onClick={() => void act(item.id, "reject")}>{c.reject}</button></> : null}
      {item.status === "approved" ? <><button className={styles.danger} type="button" disabled={busy === item.id} onClick={() => void act(item.id, "reject")}>{c.reject}</button>{item.canFlag ? <button className={styles.danger} type="button" disabled={busy === item.id} onClick={() => void act(item.id, "flag")}>{c.flag}</button> : null}</> : null}
      {item.status === "spam_review" ? <><button className={styles.danger} type="button" disabled={busy === item.id} onClick={() => void act(item.id, "spam")}>{c.confirmSpam}</button><button type="button" disabled={busy === item.id} onClick={() => void act(item.id, "restore")}>{c.restore}</button></> : null}</div>
    </article>)}</div>
    {items.length || page > 1 ? <nav className={styles.pagination} aria-label={c.page}>
      <button type="button" disabled={page === 1 || loading} onClick={previousPage}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
        <span>{c.previous}</span>
      </button>
      <span className={styles.pageNumber}>{c.page} {page.toLocaleString(locale)}</span>
      <button type="button" disabled={!cursor || loading} onClick={nextPage}>
        <span>{c.next}</span>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
      </button>
    </nav> : null}
  </main>;
}
