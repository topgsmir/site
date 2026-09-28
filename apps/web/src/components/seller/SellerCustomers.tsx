"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { SellerCustomer, SellerCustomerDetail, SellerCustomerOrder, SellerCustomersPage } from "@topgsm/shared-types";
import { api } from "@/lib/api/client";
import { currencyLabel, formatCurrencyAmount } from "@/lib/currency";
import type { Locale } from "@/lib/i18n";
import styles from "./SellerCustomers.module.css";

const copy = {
  en: { title: "User lookup", intro: "See all orders and admin notes shared with sellers.", search: "Search by name, email, username, phone, or support code", find: "Search", short: "Enter at least 3 characters.", empty: "No matching users found.", error: "Could not search users. Try again.", detailError: "Could not load user details.", notes: "Shared admin notes", orders: "Orders across all shops", noNotes: "No notes shared with sellers.", noOrders: "No orders found.", older: "Show older", back: "Back to results", orderCount: "orders", loading: "Loading…" },
  fa: { title: "جستجوی کاربر", intro: "همه سفارش‌ها و یادداشت‌های اشتراک‌گذاری‌شده مدیر را ببینید.", search: "جستجو با نام، ایمیل، نام کاربری، شماره تماس یا کد پشتیبانی", find: "جستجو", short: "حداقل ۳ نویسه وارد کنید.", empty: "کاربر منطبقی پیدا نشد.", error: "جستجوی کاربران انجام نشد. دوباره تلاش کنید.", detailError: "جزئیات کاربر بارگذاری نشد.", notes: "یادداشت‌های به‌اشتراک‌گذاشته‌شده مدیر", orders: "سفارش‌ها از همه فروشگاه‌ها", noNotes: "یادداشتی با فروشندگان به اشتراک گذاشته نشده است.", noOrders: "سفارشی پیدا نشد.", older: "نمایش موارد قدیمی‌تر", back: "بازگشت به نتایج", orderCount: "سفارش", loading: "در حال بارگذاری…" },
  ar: { title: "البحث عن مستخدم", intro: "اعرض جميع الطلبات وملاحظات الإدارة المشتركة مع البائعين.", search: "البحث بالاسم أو البريد أو اسم المستخدم أو الهاتف أو رمز الدعم", find: "بحث", short: "أدخل 3 أحرف على الأقل.", empty: "لم يتم العثور على مستخدم مطابق.", error: "تعذر البحث عن المستخدمين. حاول مجددًا.", detailError: "تعذر تحميل تفاصيل المستخدم.", notes: "ملاحظات الإدارة المشتركة", orders: "الطلبات من جميع المتاجر", noNotes: "لا توجد ملاحظات مشتركة مع البائعين.", noOrders: "لا توجد طلبات.", older: "عرض الأقدم", back: "العودة إلى النتائج", orderCount: "طلبات", loading: "جارٍ التحميل…" }
} as const;
const historyCopy = {
  en: { title: "User history", intro: "Orders across all shops and admin notes shared with sellers.", back: "Back to user lookup" },
  fa: { title: "سابقه کاربر", intro: "سفارش‌ها از همه فروشگاه‌ها و یادداشت‌های مدیر که با فروشندگان به اشتراک گذاشته شده‌اند.", back: "بازگشت به جستجوی کاربر" },
  ar: { title: "سجل المستخدم", intro: "الطلبات من جميع المتاجر وملاحظات الإدارة المشتركة مع البائعين.", back: "العودة إلى البحث عن مستخدم" }
} as const;

export function SellerCustomers({ locale, initialCustomerId }: { locale: Locale; initialCustomerId?: string }) {
  const c = copy[locale];
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<SellerCustomer[] | null>(null);
  const [resultsCursor, setResultsCursor] = useState<string | null>(null);
  const [activeSearch, setActiveSearch] = useState("");
  const [selected, setSelected] = useState<SellerCustomer | null>(null);
  const [notes, setNotes] = useState<SellerCustomerDetail["notes"]["items"]>([]);
  const [orders, setOrders] = useState<SellerCustomerOrder[]>([]);
  const [notesCursor, setNotesCursor] = useState<string | null>(null);
  const [ordersCursor, setOrdersCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(initialCustomerId));
  const [error, setError] = useState("");
  const searchRequest = useRef(0);
  const detailRequest = useRef(0);

  useEffect(() => {
    if (!initialCustomerId) return;
    const requestId = ++detailRequest.current;
    let active = true;
    const frame = requestAnimationFrame(() => {
      setLoading(true);
      void api.get<SellerCustomerDetail>(`/seller/customers/${initialCustomerId}`)
        .then((response) => {
          if (!active || requestId !== detailRequest.current) return;
          setSelected(response.data.customer);
          setNotes(response.data.notes.items);
          setOrders(response.data.orders.items);
          setNotesCursor(response.data.notes.nextCursor);
          setOrdersCursor(response.data.orders.nextCursor);
        })
        .catch(() => { if (active && requestId === detailRequest.current) setError(c.detailError); })
        .finally(() => { if (active && requestId === detailRequest.current) setLoading(false); });
    });
    return () => { active = false; cancelAnimationFrame(frame); };
  }, [initialCustomerId, c.detailError]);

  async function find(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const term = search.trim();
    if (term.length < 3) { setError(c.short); return; }
    detailRequest.current++;
    setActiveSearch(term); setResults(null); setResultsCursor(null); setSelected(null);
    await searchCustomers(term);
  }

  async function searchCustomers(term: string, cursor?: string) {
    const requestId = ++searchRequest.current;
    setLoading(true); setError("");
    try {
      const response = await api.get<SellerCustomersPage>("/seller/customers", { params: { search: term, limit: 20, ...(cursor ? { cursor } : {}) } });
      if (requestId !== searchRequest.current) return;
      setResults((current) => cursor ? [...(current ?? []), ...response.data.items] : response.data.items);
      setResultsCursor(response.data.nextCursor);
    } catch { if (requestId === searchRequest.current) setError(c.error); }
    finally { if (requestId === searchRequest.current) setLoading(false); }
  }

  async function load(customer: SellerCustomer, kind?: "notes" | "orders", cursor?: string) {
    const requestId = ++detailRequest.current;
    if (!kind) { setSelected(null); setNotes([]); setOrders([]); setNotesCursor(null); setOrdersCursor(null); }
    setLoading(true); setError("");
    try {
      const response = await api.get<SellerCustomerDetail>(`/seller/customers/${customer.id}`, { params: kind === "notes" ? { notesCursor: cursor } : kind === "orders" ? { ordersCursor: cursor } : {} });
      if (requestId !== detailRequest.current) return;
      setSelected(response.data.customer);
      if (!kind || kind === "notes") { setNotes((current) => kind ? [...current, ...response.data.notes.items] : response.data.notes.items); setNotesCursor(response.data.notes.nextCursor); }
      if (!kind || kind === "orders") { setOrders((current) => kind ? [...current, ...response.data.orders.items] : response.data.orders.items); setOrdersCursor(response.data.orders.nextCursor); }
    } catch { if (requestId === detailRequest.current) setError(c.detailError); }
    finally { if (requestId === detailRequest.current) setLoading(false); }
  }

  return <section className={styles.workspace} aria-labelledby="seller-customers-title">
    <header><h1 id="seller-customers-title">{initialCustomerId ? historyCopy[locale].title : c.title}</h1><p>{initialCustomerId ? historyCopy[locale].intro : c.intro}</p></header>
    {!initialCustomerId ? <form className={styles.search} onSubmit={(event) => void find(event)}><label htmlFor="seller-customer-search">{c.search}</label><div><input id="seller-customer-search" type="search" maxLength={100} value={search} onChange={(event) => setSearch(event.target.value)} /><button disabled={loading || search.trim().length < 3}>{c.find}</button></div></form> : null}
    {error ? <p className={styles.error} role="alert">{error}</p> : null}
    {loading ? <p role="status">{c.loading}</p> : null}
    {initialCustomerId && !selected ? <button className={styles.back} type="button" onClick={() => router.push(`/${locale}/seller-dashboard?section=customers` as Route)}>{historyCopy[locale].back}</button> : null}
    {selected ? <div className={`${styles.detail} ${styles.history}`}>
      <button className={styles.back} type="button" onClick={() => { if (initialCustomerId) router.push(`/${locale}/seller-dashboard?section=customers` as Route); else { detailRequest.current++; setSelected(null); } }}>{initialCustomerId ? historyCopy[locale].back : c.back}</button>
      <div className={styles.identity}><h3>{selected.fullName}</h3><p dir="ltr">{selected.phoneNumber ?? selected.email ?? "—"}</p><small>{selected.orderCount.toLocaleString(locale)} {c.orderCount}</small></div>
      <section><h3>{c.notes}</h3>{notes.length ? <ol className={styles.list}>{notes.map((note) => <li key={note.id}><p>{note.body}</p><small><time dateTime={note.createdAt}>{new Date(note.createdAt).toLocaleString(locale)}</time></small></li>)}</ol> : <p className={styles.muted}>{c.noNotes}</p>}{notesCursor ? <button type="button" disabled={loading} onClick={() => void load(selected, "notes", notesCursor)}>{c.older}</button> : null}</section>
      <section><h3>{c.orders}</h3>{orders.length ? <ol className={styles.list}>{orders.map((order) => <li key={order.id}><div className={styles.orderHead}><strong><bdi>{order.shopName}</bdi> <span dir="ltr">#{order.id.slice(0, 8)}</span></strong><time dateTime={order.createdAt}>{new Date(order.createdAt).toLocaleString(locale)}</time></div><p>{order.items.map((item) => `${item.title} × ${item.quantity}`).join("، ")}</p><small>{order.status} · {formatCurrencyAmount(order.totalAmount, order.currency, locale)} {currencyLabel(order.currency)}</small></li>)}</ol> : <p className={styles.muted}>{c.noOrders}</p>}{ordersCursor ? <button type="button" disabled={loading} onClick={() => void load(selected, "orders", ordersCursor)}>{c.older}</button> : null}</section>
    </div> : results ? results.length ? <div className={styles.detail}><ul className={styles.results}>{results.map((customer) => <li key={customer.id}><button type="button" onClick={() => void load(customer)}><strong>{customer.fullName}</strong><span dir="ltr">{customer.phoneNumber ?? customer.email ?? "—"}</span><small>{customer.orderCount.toLocaleString(locale)} {c.orderCount}</small></button></li>)}</ul>{resultsCursor ? <button type="button" disabled={loading} onClick={() => void searchCustomers(activeSearch, resultsCursor)}>{c.older}</button> : null}</div> : <p className={styles.muted}>{c.empty}</p> : null}
  </section>;
}
