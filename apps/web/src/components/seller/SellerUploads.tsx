"use client";

import { scheduleEffectTask } from "@/lib/effect-task";
import type { AdminUploadSummary, SellerUploadListItem, SellerUploadPage } from "@topgsm/shared-types";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api/client";
import type { Locale } from "@/lib/i18n";
import { JalaliDatePicker } from "@/components/dashboard/JalaliDatePicker";
import styles from "./SellerUploads.module.css";

const copy = {
  en: { title: "Uploads", intro: "Images uploaded for your products and blog. Deletion requires admin approval.", search: "Search uploads", apply: "Search", source: "Source", state: "Status", link: "Reference", sort: "Sort", moreFilters: "Date filters", from: "From", to: "To", details: "Details", copyLink: "Copy preview link", copied: "Link copied.", newest: "Newest", oldest: "Oldest", largest: "Largest", linked: "Linked", unlinked: "Unlinked", all: "All", blog: "Blog", product: "Product", active: "Active", trashed: "Trash", pending: "Awaiting admin approval", inUse: "Remove from blog content first", request: "Request deletion", reason: "Reason for deletion", submit: "Send request", cancel: "Cancel", refresh: "Refresh", more: "Load more", empty: "No uploads found.", error: "Uploads could not be loaded.", requested: "Deletion request sent. The image remains available until approval.", requestError: "Deletion request could not be sent.", size: "Size", date: "Uploaded", assets: "Files", storage: "Storage", unlinkedCount: "Unlinked", trashCount: "Trash" },
  fa: { title: "بارگذاری‌ها", intro: "تصاویر محصولات و وبلاگ شما. حذف با تأیید مدیر انجام می‌شود.", search: "جست‌وجوی فایل‌ها", apply: "جست‌وجو", source: "منبع", state: "وضعیت", link: "ارجاع", sort: "مرتب‌سازی", moreFilters: "فیلتر تاریخ", from: "از", to: "تا", details: "جزئیات", copyLink: "کپی پیوند پیش‌نمایش", copied: "پیوند کپی شد.", newest: "جدیدترین", oldest: "قدیمی‌ترین", largest: "بزرگ‌ترین", linked: "دارای ارجاع", unlinked: "بدون ارجاع", all: "همه", blog: "وبلاگ", product: "محصول", active: "فعال", trashed: "زباله‌دان", pending: "در انتظار تأیید مدیر", inUse: "ابتدا از محتوای وبلاگ بردارید", request: "درخواست حذف", reason: "دلیل حذف", submit: "ارسال درخواست", cancel: "انصراف", refresh: "تازه‌سازی", more: "نمایش بیشتر", empty: "فایلی پیدا نشد.", error: "بارگذاری فایل‌ها ممکن نبود.", requested: "درخواست حذف ارسال شد. تصویر تا زمان تأیید در دسترس می‌ماند.", requestError: "درخواست حذف ارسال نشد.", size: "حجم", date: "بارگذاری", assets: "فایل‌ها", storage: "فضای نسخه‌ها", unlinkedCount: "بدون ارجاع", trashCount: "زباله‌دان" },
  ar: { title: "الملفات المرفوعة", intro: "صور منتجاتك ومدونتك. تتطلب الإزالة موافقة الإدارة.", search: "البحث في الملفات", apply: "بحث", source: "المصدر", state: "الحالة", link: "المرجع", sort: "الترتيب", moreFilters: "مرشحات التاريخ", from: "من", to: "إلى", details: "التفاصيل", copyLink: "نسخ رابط المعاينة", copied: "نُسخ الرابط.", newest: "الأحدث", oldest: "الأقدم", largest: "الأكبر", linked: "مرتبط", unlinked: "غير مرتبط", all: "الكل", blog: "المدونة", product: "المنتج", active: "نشط", trashed: "المهملات", pending: "بانتظار موافقة الإدارة", inUse: "أزلها من محتوى المدونة أولاً", request: "طلب الحذف", reason: "سبب الحذف", submit: "إرسال الطلب", cancel: "إلغاء", refresh: "تحديث", more: "عرض المزيد", empty: "لا توجد ملفات.", error: "تعذر تحميل الملفات.", requested: "أُرسل طلب الحذف. تبقى الصورة متاحة حتى الموافقة.", requestError: "تعذر إرسال طلب الحذف.", size: "الحجم", date: "تاريخ الرفع", assets: "الملفات", storage: "مساحة النسخ", unlinkedCount: "غير مرتبط", trashCount: "المهملات" }
} as const;

export function SellerUploads({ locale }: { locale: Locale }) {
  const c = copy[locale];
  const [items, setItems] = useState<SellerUploadListItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [summary, setSummary] = useState<AdminUploadSummary | null>(null);
  const [search, setSearch] = useState("");
  const [searchDraft, setSearchDraft] = useState("");
  const [source, setSource] = useState("all");
  const [state, setState] = useState("all");
  const [linked, setLinked] = useState("all");
  const [sort, setSort] = useState("newest");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selected, setSelected] = useState<SellerUploadListItem | null>(null);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  const load = useCallback(async (after?: string) => {
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams({ limit: "25", source, state, linked, sort, search: search.trim() });
      if (from) params.set("from", new Date(`${from}T00:00:00`).toISOString());
      if (to) params.set("to", new Date(`${to}T23:59:59.999`).toISOString());
      if (after) params.set("cursor", after);
      const [response, totals] = await Promise.all([
        api.get<SellerUploadPage>(`/seller/uploads?${params}`),
        after ? Promise.resolve(null) : api.get<AdminUploadSummary>("/seller/uploads/summary")
      ]);
      setItems((previous) => after ? [...previous, ...response.data.items] : response.data.items);
      setCursor(response.data.nextCursor);
      if (totals) setSummary(totals.data);
    } catch { setError(c.error); }
    finally { setLoading(false); }
  }, [source, state, linked, sort, search, from, to, c.error]);

  useEffect(() => scheduleEffectTask(() => { void load(); }), [load]);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (selected && !dialog.open) dialog.showModal();
    if (!selected && dialog.open) dialog.close();
  }, [selected]);

  async function requestDeletion() {
    if (!selected || reason.trim().length < 3) return;
    setSubmitting(true); setNotice("");
    try {
      await api.post(`/seller/uploads/${selected.source}/${selected.id}/deletion-request`, { reason: reason.trim() });
      setSelected(null); setReason(""); setNotice(c.requested); await load();
    } catch { setNotice(c.requestError); }
    finally { setSubmitting(false); }
  }

  return <section className={styles.workspace} aria-labelledby="seller-uploads-title">
    <header className={styles.header}><div><h1 id="seller-uploads-title">{c.title}</h1><p>{c.intro}</p></div><button type="button" onClick={() => void load()} disabled={loading}>{c.refresh}</button></header>
    {summary ? <dl className={styles.metrics}><div><dt>{c.assets}</dt><dd>{summary.assetCount.toLocaleString(locale)}</dd></div><div><dt>{c.storage}</dt><dd>{(summary.generatedStorageBytes / 1024 / 1024).toLocaleString(locale, { maximumFractionDigits: 1 })} MiB</dd></div><div><dt>{c.unlinkedCount}</dt><dd>{summary.unlinkedCount.toLocaleString(locale)}</dd></div><div><dt>{c.trashCount}</dt><dd>{summary.trashCount.toLocaleString(locale)}</dd></div></dl> : null}
    <div className={styles.filters}>
      <label><span>{c.search}</span><input type="search" maxLength={100} value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") setSearch(searchDraft); }} /></label>
      <button type="button" onClick={() => setSearch(searchDraft)}>{c.apply}</button>
      <label><span>{c.source}</span><select value={source} onChange={(event) => setSource(event.target.value)}><option value="all">{c.all}</option><option value="blog">{c.blog}</option><option value="product">{c.product}</option></select></label>
      <label><span>{c.state}</span><select value={state} onChange={(event) => setState(event.target.value)}><option value="all">{c.all}</option><option value="active">{c.active}</option><option value="trashed">{c.trashed}</option></select></label>
      <label><span>{c.link}</span><select value={linked} onChange={(event) => setLinked(event.target.value)}><option value="all">{c.all}</option><option value="linked">{c.linked}</option><option value="unlinked">{c.unlinked}</option></select></label>
      <label><span>{c.sort}</span><select value={sort} onChange={(event) => setSort(event.target.value)}><option value="newest">{c.newest}</option><option value="oldest">{c.oldest}</option><option value="size">{c.largest}</option></select></label>
    </div>
    <details className={styles.advanced}><summary>{c.moreFilters}{from || to ? " · 1" : ""}</summary><div><label><span>{c.from}</span><JalaliDatePicker locale={locale} value={from} onChange={setFrom} /></label><label><span>{c.to}</span><JalaliDatePicker locale={locale} min={from || undefined} value={to} onChange={setTo} /></label></div></details>
    {notice ? <p className={styles.notice} role="status">{notice}</p> : null}
    {error ? <p className={styles.notice} role="alert">{error}</p> : null}
    <div className={styles.list} aria-busy={loading}>
      {!loading && !items.length && !error ? <p className={styles.empty}>{c.empty}</p> : null}
      {items.map((item) => <article className={styles.row} key={`${item.source}:${item.id}`}>
        <div className={styles.preview}>{item.previewUrl ? <Image src={item.previewUrl} width={48} height={48} alt="" unoptimized /> : null}</div>
        <div className={styles.identity}><strong>{item.originalFilename ?? item.id}</strong><span>{item.source === "blog" ? c.blog : c.product} · {item.linkedContent?.title ?? (item.state === "active" ? c.active : c.trashed)}</span></div>
        <div className={styles.meta}><span>{c.size}: {new Intl.NumberFormat(locale).format(item.sourceBytes)} B</span><time dateTime={item.createdAt}>{c.date}: {new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(item.createdAt))}</time></div>
        <div className={styles.action}>{item.lastDeletionStatus === "rejected" && item.lastRejectionReason ? <span className={styles.pending}>{item.lastRejectionReason}</span> : null}{item.pendingDeletionId ? <span className={styles.pending}>{c.pending}</span> : item.source === "blog" && item.linkState === "linked" && item.state === "active" ? <span className={styles.pending}>{c.inUse}</span> : item.state === "active" ? <button type="button" onClick={() => { setSelected(item); setReason(""); }}>{c.request}</button> : null}</div>
        <details className={styles.rowDetails}><summary>{c.details}</summary><dl><div><dt>ID</dt><dd dir="ltr">{item.id}</dd></div><div><dt>{c.size}</dt><dd>{item.width} × {item.height} · {item.sourceBytes.toLocaleString(locale)} B</dd></div><div><dt>Checksum</dt><dd dir="ltr">{item.checksum}</dd></div>{item.linkedContent ? <div><dt>{c.link}</dt><dd>{item.linkedContent.title}</dd></div> : null}</dl>{item.previewUrl ? <button type="button" onClick={() => { void navigator.clipboard.writeText(new URL(item.previewUrl!, window.location.origin).toString()).then(() => setNotice(c.copied)); }}>{c.copyLink}</button> : null}</details>
      </article>)}
    </div>
    {cursor ? <button className={styles.more} type="button" disabled={loading} onClick={() => void load(cursor)}>{c.more}</button> : null}
    <dialog ref={dialogRef} className={styles.dialog} aria-labelledby="seller-upload-request-title" onCancel={() => setSelected(null)}>{selected ? <><h2 id="seller-upload-request-title">{c.request}</h2><p>{selected.originalFilename ?? selected.id}</p><label><span>{c.reason}</span><textarea value={reason} minLength={3} maxLength={500} autoFocus onChange={(event) => setReason(event.target.value)} /></label><footer><button type="button" onClick={() => setSelected(null)}>{c.cancel}</button><button type="button" disabled={submitting || reason.trim().length < 3} onClick={() => void requestDeletion()}>{c.submit}</button></footer></> : null}</dialog>
  </section>;
}
