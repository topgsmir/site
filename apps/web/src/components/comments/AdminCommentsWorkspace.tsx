"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import type { AdminComment, CommentPage, CommentSettings, CommentStatus, CommentPostingPolicy, CommentPublicationPolicy } from "@topgsm/shared-types";
import type { Locale } from "@/lib/i18n";
import { api } from "@/lib/api/client";
import styles from "./AdminCommentsWorkspace.module.css";

const copy = {
  en: { title: "Comments", intro: "Set the posting rules, review comments, and resolve spam reports.", lock: "Require seller replies", lockHint: "A seller with an unanswered approved comment can only use the comments workspace.", posting: "Who may comment", purchasers: "Verified purchasers", buyers: "Signed-in buyers", guests: "Guests too", publication: "Signed-in comment publication", approval: "Admin approval", immediate: "Immediately", guestHint: "Guest comments always require approval.", risk: "Immediate publication can let one signed-in buyer lock every seller. Use approval or verified purchasers if that risk is unacceptable.", save: "Save settings", saved: "Settings saved.", all: "All comments", spamQueue: "Spam review", search: "Search comment, product, or author", searchButton: "Search", allStatuses: "All statuses", pending: "Pending", approved: "Published", rejected: "Rejected", spam_review: "Spam review", spam: "Spam", approve: "Approve", reject: "Reject / hide", confirmSpam: "Confirm spam", restore: "Restore", more: "Load more", empty: "No comments match this view.", error: "Comments could not be loaded.", actionError: "Action failed. Refresh and try again.", loading: "Loading…" },
  fa: { title: "دیدگاه‌ها", intro: "قانون ثبت دیدگاه را تنظیم کنید، دیدگاه‌ها را بررسی کنید و درباره گزارش‌های هرزنامه تصمیم بگیرید.", lock: "پاسخ‌گویی فروشنده الزامی باشد", lockHint: "فروشنده‌ای که دیدگاه تأییدشده بی‌پاسخ دارد، فقط به بخش دیدگاه‌ها دسترسی دارد.", posting: "چه کسانی دیدگاه بگذارند", purchasers: "خریداران تأییدشده", buyers: "خریداران واردشده", guests: "مهمانان هم مجاز باشند", publication: "انتشار دیدگاه کاربران واردشده", approval: "پس از تأیید مدیر", immediate: "بلافاصله", guestHint: "دیدگاه مهمان همیشه به تأیید مدیر نیاز دارد.", risk: "با انتشار فوری، یک خریدار واردشده می‌تواند همه فروشنده‌ها را محدود کند. اگر این خطر پذیرفتنی نیست، تأیید مدیر یا فقط خریداران تأییدشده را انتخاب کنید.", save: "ذخیره تنظیمات", saved: "تنظیمات ذخیره شد.", all: "همه دیدگاه‌ها", spamQueue: "بررسی هرزنامه", search: "جست‌وجوی متن، محصول یا نویسنده", searchButton: "جست‌وجو", allStatuses: "همه وضعیت‌ها", pending: "در انتظار", approved: "منتشرشده", rejected: "ردشده", spam_review: "بررسی هرزنامه", spam: "هرزنامه", approve: "تأیید", reject: "رد / پنهان‌کردن", confirmSpam: "تأیید هرزنامه", restore: "بازگردانی", more: "نمایش بیشتر", empty: "دیدگاهی با این فیلتر پیدا نشد.", error: "دیدگاه‌ها دریافت نشدند.", actionError: "انجام این کار ممکن نبود. دوباره تلاش کنید.", loading: "در حال بارگذاری…" },
  ar: { title: "التعليقات", intro: "اضبط قواعد التعليقات وراجعها واحسم بلاغات الرسائل المزعجة.", lock: "إلزام البائعين بالرد", lockHint: "البائع الذي لديه تعليق منشور بلا رد لا يستطيع استخدام سوى مساحة التعليقات.", posting: "من يمكنه التعليق", purchasers: "المشترون المؤكدون", buyers: "المشترون المسجلون", guests: "الضيوف أيضًا", publication: "نشر تعليقات المسجلين", approval: "بعد موافقة المدير", immediate: "فورًا", guestHint: "تعليقات الضيوف تحتاج دائمًا إلى الموافقة.", risk: "النشر الفوري قد يتيح لمشترٍ مسجل تقييد كل البائعين بتعليق واحد. اختر موافقة المدير أو المشترين المؤكدين إذا كان ذلك غير مقبول.", save: "حفظ الإعدادات", saved: "حُفظت الإعدادات.", all: "كل التعليقات", spamQueue: "مراجعة الرسائل المزعجة", search: "ابحث في التعليق أو المنتج أو الكاتب", searchButton: "بحث", allStatuses: "كل الحالات", pending: "قيد الانتظار", approved: "منشور", rejected: "مرفوض", spam_review: "مراجعة الإزعاج", spam: "مزعج", approve: "موافقة", reject: "رفض / إخفاء", confirmSpam: "تأكيد الإزعاج", restore: "استعادة", more: "عرض المزيد", empty: "لا توجد تعليقات مطابقة.", error: "تعذر تحميل التعليقات.", actionError: "تعذر إكمال الإجراء. حاول مجددًا.", loading: "جار التحميل…" }
} as const;

export function AdminCommentsWorkspace({ locale }: { locale: Locale }) {
  const c = copy[locale];
  const [settings, setSettings] = useState<CommentSettings | null>(null);
  const [lock, setLock] = useState(false);
  const [posting, setPosting] = useState<CommentPostingPolicy>("purchasers");
  const [publication, setPublication] = useState<CommentPublicationPolicy>("approval");
  const [items, setItems] = useState<AdminComment[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [filter, setFilter] = useState<CommentStatus | "">("");
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async (next?: string) => {
    setLoading(true); setError("");
    try {
      const response = await api.get<CommentPage<AdminComment>>("/admin/settings/comments", { params: { limit: 20, ...(filter ? { status: filter } : {}), ...(appliedSearch ? { search: appliedSearch } : {}), ...(next ? { cursor: next } : {}) } });
      setItems((current) => next ? [...current, ...response.data.items] : response.data.items);
      setCursor(response.data.nextCursor);
    } catch { setError(c.error); }
    finally { setLoading(false); }
  }, [filter, appliedSearch, c.error]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { void api.get<CommentSettings>("/admin/settings/comments/settings").then(({ data }) => { setSettings(data); setLock(data.sellerLockEnabled); setPosting(data.postingPolicy); setPublication(data.publicationPolicy); }).catch(() => setError(c.error)); }, [c.error]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(""); setMessage("");
    try {
      const { data } = await api.patch<CommentSettings>("/admin/settings/comments/settings", { sellerLockEnabled: lock, postingPolicy: posting, publicationPolicy: publication });
      setSettings(data); setMessage(c.saved);
    } catch { setError(c.actionError); }
    finally { setSaving(false); }
  }

  async function moderate(id: string, action: "approve" | "reject" | "spam" | "restore") {
    setBusy(id); setError("");
    try { await api.post(`/admin/settings/comments/${id}/${action}`); await load(); }
    catch { setError(c.actionError); }
    finally { setBusy(null); }
  }

  return <main className={styles.section} dir={locale === "en" ? "ltr" : "rtl"}>
    <header className={styles.header}><h1>{c.title}</h1><p>{c.intro}</p></header>
    {error ? <p className={styles.error} role="alert">{error}</p> : null}{message ? <p className={styles.success} role="status">{message}</p> : null}
    {settings ? <form className={styles.settings} onSubmit={save}>
      <div className={styles.settingRow}><div><strong>{c.lock}</strong><small>{c.lockHint}</small></div><label className={styles.toggle}><span className={styles.visuallyHidden}>{c.lock}</span><input type="checkbox" checked={lock} disabled={saving} onChange={(event) => setLock(event.target.checked)} /><span aria-hidden="true"><i /></span></label></div>
      <div className={styles.selectGrid}><label>{c.posting}<select value={posting} disabled={saving} onChange={(event) => setPosting(event.target.value as CommentPostingPolicy)}><option value="purchasers">{c.purchasers}</option><option value="buyers">{c.buyers}</option><option value="guests">{c.guests}</option></select></label>
      <label>{c.publication}<select value={publication} disabled={saving} onChange={(event) => setPublication(event.target.value as CommentPublicationPolicy)}><option value="approval">{c.approval}</option><option value="immediate">{c.immediate}</option></select><small>{c.guestHint}</small></label></div>
      {lock && posting !== "purchasers" && publication === "immediate" ? <p className={styles.notice} role="status">{c.risk}</p> : null}
      <div className={styles.settingsActions}><button className={styles.primary} type="submit" disabled={saving}>{c.save}</button></div>
    </form> : <p className={styles.loading}>{c.loading}</p>}
    <div className={styles.tabs}><button type="button" aria-pressed={filter === ""} onClick={() => setFilter("")}>{c.all}</button><button type="button" aria-pressed={filter === "spam_review"} onClick={() => setFilter("spam_review")}>{c.spamQueue}</button></div>
    <form className={styles.toolbar} onSubmit={(event) => { event.preventDefault(); setAppliedSearch(search.trim()); }}><input aria-label={c.search} placeholder={c.search} value={search} maxLength={100} onChange={(event) => setSearch(event.target.value)} /><button type="submit">{c.searchButton}</button><select aria-label={c.allStatuses} value={filter} onChange={(event) => setFilter(event.target.value as CommentStatus | "")}><option value="">{c.allStatuses}</option>{(["pending", "approved", "rejected", "spam_review", "spam"] as const).map((value) => <option key={value} value={value}>{c[value]}</option>)}</select></form>
    {loading && !items.length ? <p className={styles.loading} role="status">{c.loading}</p> : null}{!loading && !items.length && !error ? <p className={styles.empty}>{c.empty}</p> : null}
    <div className={styles.list}>{items.map((item) => <article className={styles.card} key={item.id}>
      <div className={styles.meta}><strong>{item.productTitle}</strong><span>{item.authorName}</span><time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleDateString(locale)}</time><span className={styles.status} data-status={item.status}>{c[item.status]}</span></div><p className={styles.body}>{item.body}</p>
      {item.replies.map((reply, index) => reply.body ? <div className={styles.reply} key={index}><strong>{reply.sellerName}</strong><p>{reply.body}</p></div> : null)}
      <div className={styles.actions}>{item.status === "pending" ? <><button type="button" disabled={busy === item.id} onClick={() => void moderate(item.id, "approve")}>{c.approve}</button><button className={styles.danger} type="button" disabled={busy === item.id} onClick={() => void moderate(item.id, "reject")}>{c.reject}</button></> : null}
      {item.status === "approved" ? <button className={styles.danger} type="button" disabled={busy === item.id} onClick={() => void moderate(item.id, "reject")}>{c.reject}</button> : null}
      {item.status === "spam_review" ? <><button className={styles.danger} type="button" disabled={busy === item.id} onClick={() => void moderate(item.id, "spam")}>{c.confirmSpam}</button><button type="button" disabled={busy === item.id} onClick={() => void moderate(item.id, "restore")}>{c.restore}</button></> : null}</div>
    </article>)}</div>
    {cursor && !loading ? <button className={styles.more} type="button" onClick={() => void load(cursor)}>{c.more}</button> : null}
  </main>;
}
