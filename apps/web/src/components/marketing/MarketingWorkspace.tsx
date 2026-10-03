"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api } from "@/lib/api/client";
import type { Locale } from "@/lib/i18n";
import styles from "./MarketingWorkspace.module.css";

type Link = { id: string; code: string; sellerId: string; sellerName: string; productId: string; productTitle: string; recipientName: string; recipientContact: string | null; percentage: string; fundingSource: string; active: boolean; expiresAt: string | null; createdAt: string; visits: number; purchases: number; earned: string };
type Option = { sellerId: string; productId: string; sellerName: string; title: string };
type Earning = { id: string; orderId: string; baseAmount: string; amount: string; status: string; fundingSource: string; createdAt: string; paidAt: string | null };
type Event = { id: string; action: string; detail: string | null; actorName: string; createdAt: string };
type Page<T> = { items: T[]; nextCursor: string | null };

const copy = {
  fa: { title: "بازاریابی", hint: "لینک اختصاصی بسازید و بازدید، خرید و پورسانت هر معرف را دنبال کنید.", create: "ساخت لینک", product: "محصول و فروشنده", recipient: "نام معرف", contact: "راه ارتباطی (اختیاری)", percentage: "درصد پورسانت", funding: "پرداخت از", seller: "سهم فروشنده", platform: "سهم تاپ‌جی‌اس‌ام", expiry: "انقضا (اختیاری)", search: "جستجوی محصول", refresh: "جستجو", link: "لینک", copy: "کپی لینک", copied: "کپی شد", visits: "بازدید", purchases: "خرید", earned: "پورسانت", status: "وضعیت", active: "فعال", inactive: "غیرفعال", deactivate: "غیرفعال کردن", activate: "فعال کردن", details: "جزئیات", close: "بستن", earnings: "خریدها و پورسانت‌ها", events: "رویدادها", empty: "هنوز لینکی ثبت نشده است.", noSales: "هنوز خریدی برای این لینک ثبت نشده است.", more: "بیشتر", pay: "ثبت پرداخت", reference: "شماره پیگیری پرداخت", loading: "در حال بارگیری…", failed: "انجام عملیات ممکن نشد. دوباره تلاش کنید.", pending: "در انتظار پرداخت خریدار", payable: "قابل پرداخت", paid: "پرداخت شده", reversed: "لغو شده" },
  en: { title: "Marketing", hint: "Create referral links and track visits, purchases, and commissions.", create: "Create link", product: "Product and seller", recipient: "Referrer name", contact: "Contact (optional)", percentage: "Commission %", funding: "Funded by", seller: "Seller share", platform: "TopGSM share", expiry: "Expiry (optional)", search: "Search products", refresh: "Search", link: "Link", copy: "Copy link", copied: "Copied", visits: "Visits", purchases: "Purchases", earned: "Earned", status: "Status", active: "Active", inactive: "Inactive", deactivate: "Deactivate", activate: "Activate", details: "Details", close: "Close", earnings: "Purchases and commissions", events: "Events", empty: "No referral links yet.", noSales: "No purchases for this link yet.", more: "More", pay: "Record payout", reference: "Payout reference", loading: "Loading…", failed: "The action failed. Try again.", pending: "Awaiting buyer payment", payable: "Payable", paid: "Paid", reversed: "Reversed" },
  ar: { title: "التسويق", hint: "أنشئ روابط إحالة وتابع الزيارات والمشتريات والعمولات.", create: "إنشاء رابط", product: "المنتج والبائع", recipient: "اسم المحيل", contact: "وسيلة التواصل (اختياري)", percentage: "نسبة العمولة", funding: "مصدر العمولة", seller: "حصة البائع", platform: "حصة TopGSM", expiry: "انتهاء الصلاحية (اختياري)", search: "بحث عن منتج", refresh: "بحث", link: "الرابط", copy: "نسخ الرابط", copied: "تم النسخ", visits: "الزيارات", purchases: "المشتريات", earned: "العمولة", status: "الحالة", active: "نشط", inactive: "غير نشط", deactivate: "تعطيل", activate: "تفعيل", details: "التفاصيل", close: "إغلاق", earnings: "المشتريات والعمولات", events: "الأحداث", empty: "لا توجد روابط إحالة بعد.", noSales: "لا توجد مشتريات لهذا الرابط بعد.", more: "المزيد", pay: "تسجيل الدفع", reference: "مرجع الدفع", loading: "جار التحميل…", failed: "تعذر إكمال العملية. حاول مجددًا.", pending: "بانتظار دفع المشتري", payable: "قابل للدفع", paid: "مدفوع", reversed: "ملغى" }
} as const;

export function MarketingWorkspace({ locale, admin }: { locale: Locale; admin: boolean }) {
  const c = copy[locale];
  const endpoint = `/marketing/${admin ? "admin" : "seller"}`;
  const [links, setLinks] = useState<Link[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [options, setOptions] = useState<Option[]>([]);
  const [search, setSearch] = useState("");
  const [choice, setChoice] = useState("");
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [percentage, setPercentage] = useState("10");
  const [funding, setFunding] = useState<"seller" | "platform">("seller");
  const [expiry, setExpiry] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [earnings, setEarnings] = useState<Earning[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [earningsCursor, setEarningsCursor] = useState<string | null>(null);
  const [eventsCursor, setEventsCursor] = useState<string | null>(null);
  const [reference, setReference] = useState("");
  const [payingId, setPayingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadLinks = useCallback(async (cursor?: string) => {
    const { data } = await api.get<Page<Link>>(endpoint, { params: cursor ? { cursor } : {} });
    setLinks((current) => cursor ? [...current, ...data.items] : data.items);
    setNextCursor(data.nextCursor);
  }, [endpoint]);
  const loadOptions = useCallback(async (term = "") => {
    const { data } = await api.get<Option[]>(`${endpoint}/options`, { params: term ? { search: term } : {} });
    setOptions(data);
  }, [endpoint]);
  const loadDetail = useCallback(async (id: string, kind: "earnings" | "events", cursor?: string) => {
    if (kind === "earnings") {
      const { data } = await api.get<Page<Earning>>(`${endpoint}/${id}/earnings`, { params: cursor ? { cursor } : {} });
      setEarnings((current) => cursor ? [...current, ...data.items] : data.items);
      setEarningsCursor(data.nextCursor);
    } else {
      const { data } = await api.get<Page<Event>>(`${endpoint}/${id}/events`, { params: cursor ? { cursor } : {} });
      setEvents((current) => cursor ? [...current, ...data.items] : data.items);
      setEventsCursor(data.nextCursor);
    }
  }, [endpoint]);
  useEffect(() => {
    let mounted = true;
    const timer = window.setTimeout(() => {
      Promise.all([loadLinks(), loadOptions()]).catch(() => { if (mounted) setError(c.failed); }).finally(() => { if (mounted) setLoading(false); });
    }, 0);
    return () => { mounted = false; window.clearTimeout(timer); };
  }, [loadLinks, loadOptions, c.failed]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const selectedOption = options.find((item) => `${item.sellerId}:${item.productId}` === choice);
    if (!selectedOption || busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await api.post(endpoint, { productId: selectedOption.productId, ...(admin ? { sellerId: selectedOption.sellerId, fundingSource: funding } : {}), recipientName: name, ...(contact ? { recipientContact: contact } : {}), percentage, ...(expiry ? { expiresAt: new Date(expiry).toISOString() } : {}) });
      setName(""); setContact(""); setExpiry(""); setChoice("");
      await loadLinks();
    } catch { setError(c.failed); } finally { setBusy(false); }
  }

  async function toggle(link: Link) {
    setBusy(true); setError("");
    try { await api.patch(`${endpoint}/${link.id}`, { active: !link.active }); await loadLinks(); }
    catch { setError(c.failed); } finally { setBusy(false); }
  }
  async function showDetails(id: string) {
    if (selected === id) { setSelected(null); return; }
    setSelected(id); setEarnings([]); setEvents([]); setError("");
    try { await Promise.all([loadDetail(id, "earnings"), loadDetail(id, "events")]); }
    catch { setError(c.failed); }
  }
  async function markPaid(id: string) {
    if (!reference.trim() || busy) return;
    setBusy(true); setError("");
    try { await api.post(`/marketing/admin/earnings/${id}/pay`, { reference: reference.trim() }); setReference(""); setPayingId(null); if (selected) await Promise.all([loadLinks(), loadDetail(selected, "earnings"), loadDetail(selected, "events")]); }
    catch { setError(c.failed); } finally { setBusy(false); }
  }
  function shareUrl(link: Link) { return `${window.location.origin}/${locale}/r/${link.code}`; }

  return <section className={styles.workspace} aria-label={c.title}>
    <header className={styles.header}><div><h1>{c.title}</h1><p>{c.hint}</p></div></header>
    {error ? <p className={styles.error} role="alert">{error}</p> : null}
    {notice ? <p className={styles.notice} role="status">{notice}</p> : null}
    <form className={styles.form} onSubmit={create}>
      <div className={styles.search}><label>{c.search}<input value={search} onChange={(event) => setSearch(event.target.value)} maxLength={80} /></label><button type="button" onClick={() => loadOptions(search).catch(() => setError(c.failed))}>{c.refresh}</button></div>
      <label>{c.product}<select required value={choice} onChange={(event) => setChoice(event.target.value)}><option value="">—</option>{options.map((item) => <option key={`${item.sellerId}:${item.productId}`} value={`${item.sellerId}:${item.productId}`}>{item.title} · {item.sellerName}</option>)}</select></label>
      <label>{c.recipient}<input required minLength={2} maxLength={120} value={name} onChange={(event) => setName(event.target.value)} /></label>
      <label>{c.contact}<input maxLength={160} value={contact} onChange={(event) => setContact(event.target.value)} /></label>
      <label>{c.percentage}<input required type="number" min="1" max="30" step="0.01" dir="ltr" value={percentage} onChange={(event) => setPercentage(event.target.value)} /></label>
      {admin ? <label>{c.funding}<select value={funding} onChange={(event) => setFunding(event.target.value as "seller" | "platform")}><option value="seller">{c.seller}</option><option value="platform">{c.platform}</option></select></label> : null}
      <label>{c.expiry}<input type="datetime-local" value={expiry} onChange={(event) => setExpiry(event.target.value)} /></label>
      <button className={styles.primary} type="submit" disabled={busy || !choice}>{c.create}</button>
    </form>
    <div className={styles.list} aria-busy={loading}>
      {loading ? <p>{c.loading}</p> : links.length === 0 ? <p>{c.empty}</p> : links.map((link) => <article key={link.id} className={styles.row}>
        <div className={styles.rowHead}><div><strong>{link.recipientName}</strong><span>{link.productTitle} · {link.sellerName} · {link.percentage}% · {link.fundingSource === "platform" ? c.platform : c.seller}</span></div><span className={link.active ? styles.active : styles.inactive}>{link.active ? c.active : c.inactive}</span></div>
        <div className={styles.metrics}><span>{c.visits} <strong>{link.visits.toLocaleString(locale)}</strong></span><span>{c.purchases} <strong>{link.purchases.toLocaleString(locale)}</strong></span><span>{c.earned} <strong>{link.earned}</strong></span></div>
        <div className={styles.actions}><input aria-label={c.link} readOnly dir="ltr" value={`/${locale}/r/${link.code}`} onFocus={(event) => event.target.select()} /><button type="button" onClick={() => navigator.clipboard.writeText(shareUrl(link)).then(() => setNotice(c.copied)).catch(() => setError(c.failed))}>{c.copy}</button><button type="button" disabled={busy} onClick={() => toggle(link)}>{link.active ? c.deactivate : c.activate}</button><button type="button" onClick={() => showDetails(link.id)}>{selected === link.id ? c.close : c.details}</button></div>
        {selected === link.id ? <div className={styles.detail}>
          <h2>{c.earnings}</h2>
          {earnings.length === 0 ? <p>{c.noSales}</p> : <div className={styles.tableWrap}><table><thead><tr><th>{c.link}</th><th>{c.earned}</th><th>{c.status}</th>{admin ? <th>{c.pay}</th> : null}</tr></thead><tbody>{earnings.map((earning) => <tr key={earning.id}><td dir="ltr">{earning.orderId.slice(0, 8)}…</td><td dir="ltr">{earning.amount}</td><td>{c[earning.status as "pending" | "payable" | "paid" | "reversed"] ?? earning.status}</td>{admin ? <td>{earning.status === "payable" ? payingId === earning.id ? <span className={styles.payForm}><input aria-label={c.reference} placeholder={c.reference} value={reference} maxLength={100} onChange={(event) => setReference(event.target.value)} /><button type="button" disabled={!reference.trim() || busy} onClick={() => markPaid(earning.id)}>{c.pay}</button></span> : <button type="button" onClick={() => setPayingId(earning.id)}>{c.pay}</button> : null}</td> : null}</tr>)}</tbody></table></div>}
          {earningsCursor ? <button type="button" onClick={() => loadDetail(link.id, "earnings", earningsCursor).catch(() => setError(c.failed))}>{c.more}</button> : null}
          <h2>{c.events}</h2><ul className={styles.events}>{events.map((event) => <li key={event.id}><time dateTime={event.createdAt}>{new Date(event.createdAt).toLocaleString(locale)}</time><span>{event.action}</span><span>{event.actorName}</span>{event.detail ? <span>{event.detail}</span> : null}</li>)}</ul>
          {eventsCursor ? <button type="button" onClick={() => loadDetail(link.id, "events", eventsCursor).catch(() => setError(c.failed))}>{c.more}</button> : null}
        </div> : null}
      </article>)}
      {nextCursor ? <button type="button" onClick={() => loadLinks(nextCursor).catch(() => setError(c.failed))}>{c.more}</button> : null}
    </div>
  </section>;
}
