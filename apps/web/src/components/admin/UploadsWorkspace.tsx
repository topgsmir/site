"use client";

import type {
  AdminUploadBulkResult,
  AdminUploadDetail,
  AdminUploadListItem,
  AdminUploadPage,
  AdminUploadSource,
  AdminUploadSummary
} from "@topgsm/shared-types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { api } from "@/lib/api/client";
import type { Locale } from "@/lib/i18n";
import styles from "./UploadsWorkspace.module.css";

const copy = {
  en: {
    title: "Uploads", intro: "Inspect local blog and product images, trace ownership, and recover removals before permanent purge.",
    assets: "Assets", storage: "Generated storage", unlinked: "Unlinked", trash: "Trash", purgingSoon: "Purge in 7 days",
    search: "Search filename, checksum, owner, or content", source: "Source", state: "State", link: "Reference", sort: "Sort",
    from: "From date", to: "To date",
    all: "All", blog: "Blog", product: "Product", active: "Active", trashed: "Trash", linked: "Linked", unlinkedState: "Unlinked",
    newest: "Newest", oldest: "Oldest", largest: "Largest", apply: "Apply", clear: "Clear", selected: "selected",
    moveTrash: "Move to trash", restore: "Restore", loadMore: "Load more", details: "Upload details", close: "Close",
    noResults: "No uploads match these filters.", noResultsHint: "Clear a filter or search for another owner, filename, or checksum.",
    loadError: "Uploads could not be loaded. Try again.", retry: "Retry", filenameUnavailable: "Original filename unavailable",
    generated: "generated", sourceSize: "source", uploaded: "Uploaded", owner: "Owner", seller: "Seller", linkedTo: "Linked to", checksum: "Checksum",
    copyLink: "Copy link", openLink: "Open preview", variants: "Variants", references: "Revision references", history: "Audit history", noHistory: "No lifecycle events yet.", system: "System", days: "days",
    eventTrashed: "Moved to trash", eventAutoTrashed: "Automatically moved to trash", eventRestored: "Restored", eventPurged: "Permanently purged", eventPurgeFailed: "Purge failed",
    reason: "Audit reason", reasonHint: "Explain why these uploads are being removed.", cancel: "Cancel", confirmTrash: "Move to 30-day trash",
    trashDone: "Moved to trash.", undo: "Undo", undoFailed: "Some uploads could not be restored.", copied: "Link copied.",
    conflictReplacement: "The product already has a replacement image.", conflictMissing: "The original product no longer exists.",
    conflictPurge: "Permanent purge has already started.", purgeIn: "Purges", unavailable: "Unavailable", refresh: "Refresh"
  },
  fa: {
    title: "بارگذاری‌ها", intro: "تصاویر محلی وبلاگ و محصول را بررسی کنید، مالک و ارجاع‌ها را ببینید و حذف‌ها را پیش از پاک‌سازی نهایی بازیابی کنید.",
    assets: "فایل‌ها", storage: "فضای نسخه‌ها", unlinked: "بدون ارجاع", trash: "زباله‌دان", purgingSoon: "پاک‌سازی تا ۷ روز",
    search: "جست‌وجوی نام فایل، checksum، مالک یا محتوا", source: "منبع", state: "وضعیت", link: "ارجاع", sort: "مرتب‌سازی",
    from: "از تاریخ", to: "تا تاریخ",
    all: "همه", blog: "وبلاگ", product: "محصول", active: "فعال", trashed: "زباله‌دان", linked: "دارای ارجاع", unlinkedState: "بدون ارجاع",
    newest: "جدیدترین", oldest: "قدیمی‌ترین", largest: "بزرگ‌ترین", apply: "اعمال", clear: "پاک کردن", selected: "انتخاب‌شده",
    moveTrash: "انتقال به زباله‌دان", restore: "بازیابی", loadMore: "نمایش بیشتر", details: "جزئیات فایل", close: "بستن",
    noResults: "فایلی با این فیلترها پیدا نشد.", noResultsHint: "فیلترها را پاک کنید یا نام فایل، مالک یا checksum دیگری را جست‌وجو کنید.",
    loadError: "بارگذاری فایل‌ها ممکن نبود. دوباره تلاش کنید.", retry: "تلاش دوباره", filenameUnavailable: "نام فایل اصلی موجود نیست",
    generated: "نسخه‌ها", sourceSize: "اصلی", uploaded: "بارگذاری", owner: "مالک", seller: "فروشنده", linkedTo: "متصل به", checksum: "Checksum",
    copyLink: "کپی پیوند", openLink: "باز کردن پیش‌نمایش", variants: "نسخه‌ها", references: "ارجاع‌های نسخه", history: "تاریخچه ممیزی", noHistory: "هنوز رویدادی ثبت نشده است.", system: "سامانه", days: "روز",
    eventTrashed: "انتقال به زباله‌دان", eventAutoTrashed: "انتقال خودکار به زباله‌دان", eventRestored: "بازیابی", eventPurged: "پاک‌سازی نهایی", eventPurgeFailed: "خطا در پاک‌سازی",
    reason: "دلیل ممیزی", reasonHint: "دلیل حذف این فایل‌ها را توضیح دهید.", cancel: "انصراف", confirmTrash: "انتقال به زباله‌دان ۳۰ روزه",
    trashDone: "به زباله‌دان منتقل شد.", undo: "بازگردانی", undoFailed: "بعضی فایل‌ها بازیابی نشدند.", copied: "پیوند کپی شد.",
    conflictReplacement: "محصول اکنون تصویر جایگزین دارد.", conflictMissing: "محصول اصلی دیگر وجود ندارد.", conflictPurge: "پاک‌سازی نهایی شروع شده است.", purgeIn: "پاک‌سازی", unavailable: "ناموجود", refresh: "تازه‌سازی"
  },
  ar: {
    title: "الملفات المرفوعة", intro: "افحص صور المدونة والمنتجات المحلية وتتبع الملكية والمراجع واستعد المحذوفات قبل الإزالة النهائية.",
    assets: "الملفات", storage: "مساحة النسخ", unlinked: "غير مرتبطة", trash: "سلة المهملات", purgingSoon: "إزالة خلال 7 أيام",
    search: "ابحث بالاسم أو checksum أو المالك أو المحتوى", source: "المصدر", state: "الحالة", link: "المرجع", sort: "الترتيب",
    from: "من تاريخ", to: "إلى تاريخ",
    all: "الكل", blog: "المدونة", product: "المنتج", active: "نشط", trashed: "المهملات", linked: "مرتبط", unlinkedState: "غير مرتبط",
    newest: "الأحدث", oldest: "الأقدم", largest: "الأكبر", apply: "تطبيق", clear: "مسح", selected: "محدد",
    moveTrash: "نقل إلى المهملات", restore: "استعادة", loadMore: "عرض المزيد", details: "تفاصيل الملف", close: "إغلاق",
    noResults: "لا توجد ملفات تطابق هذه المرشحات.", noResultsHint: "امسح مرشحاً أو ابحث عن مالك أو اسم أو checksum آخر.",
    loadError: "تعذر تحميل الملفات. حاول مجدداً.", retry: "إعادة المحاولة", filenameUnavailable: "اسم الملف الأصلي غير متاح",
    generated: "النسخ", sourceSize: "الأصل", uploaded: "رُفع", owner: "المالك", seller: "البائع", linkedTo: "مرتبط بـ", checksum: "Checksum",
    copyLink: "نسخ الرابط", openLink: "فتح المعاينة", variants: "النسخ", references: "مراجع النسخ", history: "سجل التدقيق", noHistory: "لا توجد أحداث بعد.", system: "النظام", days: "يوم",
    eventTrashed: "نُقل إلى المهملات", eventAutoTrashed: "نُقل تلقائياً إلى المهملات", eventRestored: "استُعيد", eventPurged: "أُزيل نهائياً", eventPurgeFailed: "فشلت الإزالة",
    reason: "سبب التدقيق", reasonHint: "اشرح سبب إزالة هذه الملفات.", cancel: "إلغاء", confirmTrash: "نقل إلى مهملات 30 يوماً",
    trashDone: "نُقل إلى المهملات.", undo: "تراجع", undoFailed: "تعذرت استعادة بعض الملفات.", copied: "نُسخ الرابط.",
    conflictReplacement: "للمنتج صورة بديلة بالفعل.", conflictMissing: "المنتج الأصلي لم يعد موجوداً.", conflictPurge: "بدأت الإزالة النهائية بالفعل.", purgeIn: "الإزالة", unavailable: "غير متاح", refresh: "تحديث"
  }
} as const;

type Filters = { search: string; source: "all" | AdminUploadSource; state: "all" | "active" | "trashed"; linked: "all" | "linked" | "unlinked"; sort: "newest" | "oldest" | "size"; from: string; to: string };
const initialFilters: Filters = { search: "", source: "all", state: "all", linked: "all", sort: "newest", from: "", to: "" };

export function UploadsWorkspace({ locale }: { locale: Locale }) {
  const c = copy[locale];
  const [summary, setSummary] = useState<AdminUploadSummary | null>(null);
  const [items, setItems] = useState<AdminUploadListItem[]>([]);
  const [draft, setDraft] = useState(initialFilters);
  const [filters, setFilters] = useState(initialFilters);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detail, setDetail] = useState<AdminUploadDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [trashOpen, setTrashOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [mutating, setMutating] = useState(false);
  const [message, setMessage] = useState("");
  const [undoItems, setUndoItems] = useState<Array<{ source: AdminUploadSource; id: string }>>([]);
  const undoTimer = useRef<number | null>(null);
  const trashDialog = useRef<HTMLDialogElement>(null);

  const load = useCallback(async (nextCursor?: string) => {
    if (nextCursor) setLoadingMore(true);
    else setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ limit: "25", source: filters.source, state: filters.state, linked: filters.linked, sort: filters.sort });
      if (filters.search.trim()) params.set("search", filters.search.trim());
      if (filters.from) params.set("from", new Date(`${filters.from}T00:00:00`).toISOString());
      if (filters.to) params.set("to", new Date(`${filters.to}T23:59:59.999`).toISOString());
      if (nextCursor) params.set("cursor", nextCursor);
      const [page, totals] = await Promise.all([
        api.get<AdminUploadPage>(`/admin/uploads?${params.toString()}`),
        nextCursor ? Promise.resolve(null) : api.get<AdminUploadSummary>("/admin/uploads/summary")
      ]);
      setItems((current) => nextCursor ? [...current, ...page.data.items] : page.data.items);
      setCursor(page.data.nextCursor);
      if (totals) setSummary(totals.data);
      if (!nextCursor) setSelected(new Set());
    } catch { setError(c.loadError); }
    finally { setLoading(false); setLoadingMore(false); }
  }, [c.loadError, filters]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => () => { if (undoTimer.current) window.clearTimeout(undoTimer.current); }, []);
  useEffect(() => {
    const dialog = trashDialog.current;
    if (!dialog) return;
    if (trashOpen && !dialog.open) dialog.showModal();
    if (!trashOpen && dialog.open) dialog.close();
  }, [trashOpen]);

  const selectedItems = useMemo(() => items.filter((item) => selected.has(keyOf(item))), [items, selected]);
  const selectionState = selectedItems.length ? (selectedItems.every((item) => item.state === "active") ? "active" : selectedItems.every((item) => item.state === "trashed") ? "trashed" : "mixed") : "none";

  function toggle(item: AdminUploadListItem) {
    setSelected((current) => { const next = new Set(current); const key = keyOf(item); if (next.has(key)) next.delete(key); else next.add(key); return next; });
  }

  async function openDetail(item: AdminUploadListItem) {
    setDetailLoading(true); setDetail(null);
    try { setDetail((await api.get<AdminUploadDetail>(`/admin/uploads/${item.source}/${item.id}`)).data); }
    catch { setMessage(c.loadError); }
    finally { setDetailLoading(false); }
  }

  async function trashSelected() {
    if (reason.trim().length < 3) return;
    setMutating(true);
    const refs = selectedItems.map(({ source, id }) => ({ source, id }));
    try {
      const response = await api.post<AdminUploadBulkResult>("/admin/uploads/trash", { items: refs, reason: reason.trim() });
      const successful = response.data.results.filter((result) => result.ok).map(({ source, id }) => ({ source, id }));
      const failures = response.data.results.filter((result) => !result.ok);
      setMessage(failures.length ? failures.map((item) => item.message).join(" · ") : c.trashDone);
      setUndoItems(successful); setTrashOpen(false); setReason(""); setSelected(new Set());
      if (undoTimer.current) window.clearTimeout(undoTimer.current);
      undoTimer.current = window.setTimeout(() => setUndoItems([]), 8000);
      await load();
    } catch { setMessage(c.loadError); }
    finally { setMutating(false); }
  }

  async function restore(refs = selectedItems.map(({ source, id }) => ({ source, id }))) {
    setMutating(true);
    try {
      const response = await api.post<AdminUploadBulkResult>("/admin/uploads/restore", { items: refs });
      const failures = response.data.results.filter((result) => !result.ok);
      setMessage(failures.length ? failures.map((item) => conflictMessage(item.message, c)).join(" · ") : "");
      setUndoItems([]); setSelected(new Set()); await load();
    } catch { setMessage(c.undoFailed); }
    finally { setMutating(false); }
  }

  const metrics = summary ? [
    [c.assets, formatNumber(summary.assetCount, locale)], [c.storage, formatBytes(summary.generatedStorageBytes, locale)],
    [c.unlinked, formatNumber(summary.unlinkedCount, locale)], [c.trash, formatNumber(summary.trashCount, locale)],
    [c.purgingSoon, formatNumber(summary.upcomingPurgeCount, locale)]
  ] : [];

  return (
    <section className={styles.workspace} aria-labelledby="uploads-title">
      <header className={styles.header}>
        <div><h1 id="uploads-title">{c.title}</h1><p>{c.intro}</p></div>
        <button className={styles.secondaryButton} type="button" onClick={() => void load()} disabled={loading}>{c.refresh}</button>
      </header>

      <dl className={styles.metrics} aria-busy={!summary}>
        {summary ? metrics.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>) : Array.from({ length: 5 }, (_, index) => <div className={styles.metricSkeleton} key={index} aria-hidden="true" />)}
      </dl>

      <form className={styles.filters} onSubmit={(event) => { event.preventDefault(); setFilters(draft); }}>
        <label className={styles.search}><span>{c.search}</span><input type="search" value={draft.search} onChange={(event) => setDraft({ ...draft, search: event.target.value })} /></label>
        <Filter label={c.source} value={draft.source} onChange={(source) => setDraft({ ...draft, source: source as Filters["source"] })} options={[["all", c.all], ["blog", c.blog], ["product", c.product]]} />
        <Filter label={c.state} value={draft.state} onChange={(state) => setDraft({ ...draft, state: state as Filters["state"] })} options={[["all", c.all], ["active", c.active], ["trashed", c.trashed]]} />
        <Filter label={c.link} value={draft.linked} onChange={(linked) => setDraft({ ...draft, linked: linked as Filters["linked"] })} options={[["all", c.all], ["linked", c.linked], ["unlinked", c.unlinkedState]]} />
        <Filter label={c.sort} value={draft.sort} onChange={(sort) => setDraft({ ...draft, sort: sort as Filters["sort"] })} options={[["newest", c.newest], ["oldest", c.oldest], ["size", c.largest]]} />
        <label><span>{c.from}</span><input type="date" value={draft.from} onChange={(event) => setDraft({ ...draft, from: event.target.value })} /></label>
        <label><span>{c.to}</span><input type="date" min={draft.from || undefined} value={draft.to} onChange={(event) => setDraft({ ...draft, to: event.target.value })} /></label>
        <div className={styles.filterActions}><button className={styles.primaryButton} type="submit">{c.apply}</button><button className={styles.secondaryButton} type="button" onClick={() => { setDraft(initialFilters); setFilters(initialFilters); }}>{c.clear}</button></div>
      </form>

      {message ? <p className={styles.notice} role="status">{message}</p> : null}
      {selectedItems.length ? <div className={styles.selection} role="toolbar" aria-label={`${selectedItems.length} ${c.selected}`}><strong>{formatNumber(selectedItems.length, locale)} {c.selected}</strong><div>{selectionState === "active" ? <button className={styles.dangerButton} type="button" onClick={() => setTrashOpen(true)}>{c.moveTrash}</button> : null}{selectionState === "trashed" ? <button className={styles.primaryButton} type="button" onClick={() => void restore()} disabled={mutating}>{c.restore}</button> : null}</div></div> : null}

      <div className={styles.inventory} aria-busy={loading}>
        {error ? <div className={styles.empty} role="alert"><strong>{error}</strong><button className={styles.secondaryButton} type="button" onClick={() => void load()}>{c.retry}</button></div> : null}
        {loading ? <InventorySkeleton /> : null}
        {!loading && !error && !items.length ? <div className={styles.empty}><UploadMark /><strong>{c.noResults}</strong><p>{c.noResultsHint}</p><button className={styles.secondaryButton} type="button" onClick={() => { setDraft(initialFilters); setFilters(initialFilters); }}>{c.clear}</button></div> : null}
        {!loading && items.map((item) => <UploadRow key={keyOf(item)} item={item} locale={locale} c={c} selected={selected.has(keyOf(item))} onToggle={() => toggle(item)} onOpen={() => void openDetail(item)} />)}
      </div>
      {cursor ? <button className={styles.loadMore} type="button" disabled={loadingMore} onClick={() => void load(cursor)}>{loadingMore ? "…" : c.loadMore}</button> : null}

      {(detail || detailLoading) ? <aside className={styles.inspector} aria-labelledby="upload-detail-title">
        <header><h2 id="upload-detail-title">{c.details}</h2><button className={styles.iconButton} type="button" aria-label={c.close} onClick={() => setDetail(null)}>×</button></header>
        {detailLoading ? <InventorySkeleton /> : detail ? <Detail detail={detail} locale={locale} c={c} onRestore={() => void restore([{ source: detail.source, id: detail.id }])} onTrash={() => { setSelected(new Set([keyOf(detail)])); setTrashOpen(true); }} onMessage={setMessage} /> : null}
      </aside> : null}

      <dialog ref={trashDialog} className={styles.dialog} aria-labelledby="trash-dialog-title" onCancel={() => setTrashOpen(false)} onClick={(event) => { if (event.target === event.currentTarget) setTrashOpen(false); }}><form method="dialog" onSubmit={(event) => { event.preventDefault(); void trashSelected(); }}><h2 id="trash-dialog-title">{c.confirmTrash}</h2><label><span>{c.reason}</span><textarea required minLength={3} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} aria-describedby="trash-reason-hint" autoFocus /></label><p id="trash-reason-hint">{c.reasonHint}</p><footer><button className={styles.secondaryButton} type="button" onClick={() => setTrashOpen(false)}>{c.cancel}</button><button className={styles.dangerButton} type="submit" disabled={mutating || reason.trim().length < 3}>{c.confirmTrash}</button></footer></form></dialog>
      {undoItems.length ? <div className={styles.toast} role="status"><span>{c.trashDone}</span><button type="button" onClick={() => void restore(undoItems)} disabled={mutating}>{c.undo}</button></div> : null}
    </section>
  );
}

function Filter({ label, value, onChange, options }: { label: string; value: string; onChange(value: string): void; options: Array<[string, string]> }) {
  return <label><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}>{options.map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select></label>;
}

function UploadRow({ item, locale, c, selected, onToggle, onOpen }: { item: AdminUploadListItem; locale: Locale; c: typeof copy[Locale]; selected: boolean; onToggle(): void; onOpen(): void }) {
  return <article className={styles.row} data-state={item.state}>
    <label className={styles.check}><input type="checkbox" checked={selected} onChange={onToggle} aria-label={item.originalFilename ?? item.id} /></label>
    <button className={styles.preview} type="button" onClick={onOpen}>{item.previewUrl ? <Image src={item.previewUrl} alt="" width={72} height={72} unoptimized /> : <UploadMark />}</button>
    <button className={styles.identity} type="button" onClick={onOpen}><strong>{item.originalFilename ?? c.filenameUnavailable}</strong><span dir="ltr">{item.id}</span></button>
    <div className={styles.badges}><span>{item.source === "blog" ? c.blog : c.product}</span><span data-tone={item.state}>{item.state === "active" ? c.active : c.trashed}</span><span>{item.linkState === "linked" ? c.linked : c.unlinkedState}</span></div>
    <dl className={styles.rowStats}><div><dt>{c.generated}</dt><dd>{formatBytes(item.generatedBytes, locale)}</dd></div><div><dt>{c.uploaded}</dt><dd><time dateTime={item.createdAt}>{new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(item.createdAt))}</time></dd></div></dl>
    {item.purgeAfter ? <span className={styles.purge}>{c.purgeIn} <Countdown date={item.purgeAfter} locale={locale} unit={c.days} /></span> : null}
  </article>;
}

function Detail({ detail, locale, c, onRestore, onTrash, onMessage }: { detail: AdminUploadDetail; locale: Locale; c: typeof copy[Locale]; onRestore(): void; onTrash(): void; onMessage(value: string): void }) {
  const restoration = detail.restoration.reason === "replacement_exists" ? c.conflictReplacement : detail.restoration.reason === "product_missing" ? c.conflictMissing : detail.restoration.reason === "purge_started" ? c.conflictPurge : null;
  async function copyLink() { if (!detail.previewUrl) return; await navigator.clipboard.writeText(new URL(detail.previewUrl, window.location.origin).toString()); onMessage(c.copied); }
  return <div className={styles.detailBody}>
    {detail.previewUrl ? <Image className={styles.detailImage} src={detail.previewUrl} alt="" width={640} height={420} unoptimized /> : null}
    <div className={styles.detailTitle}><div><strong>{detail.originalFilename ?? c.filenameUnavailable}</strong><span>{detail.originalMimeType ?? c.unavailable}</span></div><span data-tone={detail.state}>{detail.state === "active" ? c.active : c.trashed}</span></div>
    <dl className={styles.detailGrid}><div><dt>{c.sourceSize}</dt><dd>{formatBytes(detail.sourceBytes, locale)}</dd></div><div><dt>{c.generated}</dt><dd>{formatBytes(detail.generatedBytes, locale)}</dd></div><div><dt>{c.owner}</dt><dd>{detail.owner.name}</dd></div><div><dt>{c.seller}</dt><dd>{detail.seller?.shopName ?? c.unavailable}</dd></div><div><dt>{c.linkedTo}</dt><dd>{detail.linkedContent?.title ?? c.unlinkedState}</dd></div><div className={styles.full}><dt>{c.checksum}</dt><dd dir="ltr">{detail.checksum}</dd></div></dl>
    <div className={styles.detailActions}><button className={styles.secondaryButton} type="button" onClick={() => void copyLink()} disabled={!detail.previewUrl}>{c.copyLink}</button>{detail.previewUrl ? <a className={styles.secondaryButton} href={detail.previewUrl} target="_blank" rel="noreferrer">{c.openLink}</a> : null}{detail.state === "active" ? <button className={styles.dangerButton} type="button" disabled={detail.linkState === "linked" && detail.source === "blog"} onClick={onTrash}>{c.moveTrash}</button> : <button className={styles.primaryButton} type="button" disabled={!detail.restoration.eligible} onClick={onRestore}>{c.restore}</button>}</div>
    {restoration ? <p className={styles.conflict} role="note">{restoration}</p> : null}
    <section><h3>{c.variants}</h3><ul className={styles.variantList}>{detail.variants.map((variant) => <li key={variant.name}><span>{variant.name}</span><span dir="ltr">{variant.width}×{variant.height}</span><span>{formatBytes(variant.bytes, locale)}</span></li>)}</ul></section>
    {detail.references.length ? <section><h3>{c.references}</h3><ul className={styles.variantList}>{detail.references.map((reference) => <li key={`${reference.id}:${reference.usage}`}><span>{reference.title}</span><span>{reference.usage}</span></li>)}</ul></section> : null}
    <section><h3>{c.history}</h3>{detail.events.length ? <ol className={styles.history}>{detail.events.map((event) => <li key={event.id}><strong>{eventLabel(event.action, c)}</strong><span>{event.actor?.name ?? c.system} · {new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(event.createdAt))}</span>{event.reason ? <p>{event.reason}</p> : null}</li>)}</ol> : <p>{c.noHistory}</p>}</section>
  </div>;
}

function Countdown({ date, locale, unit }: { date: string; locale: Locale; unit: string }) { const days = Math.max(0, Math.ceil((new Date(date).getTime() - Date.now()) / 86400_000)); return <b>{new Intl.NumberFormat(locale).format(days)} {unit}</b>; }
function keyOf(item: Pick<AdminUploadListItem, "source" | "id">) { return `${item.source}:${item.id}`; }
function formatBytes(value: number, locale: Locale) { const units = ["B", "KB", "MB", "GB"]; let size = value; let index = 0; while (size >= 1024 && index < units.length - 1) { size /= 1024; index++; } return `${new Intl.NumberFormat(locale, { maximumFractionDigits: index ? 1 : 0 }).format(size)} ${units[index]}`; }
function formatNumber(value: number, locale: Locale) { return new Intl.NumberFormat(locale).format(value); }
function conflictMessage(message: string, c: typeof copy[Locale]) { if (message.includes("replacement")) return c.conflictReplacement; if (message.includes("no longer exists")) return c.conflictMissing; if (message.includes("Purge")) return c.conflictPurge; return message; }
function eventLabel(action: AdminUploadDetail["events"][number]["action"], c: typeof copy[Locale]) {
  if (action === "trashed") return c.eventTrashed;
  if (action === "auto_trashed") return c.eventAutoTrashed;
  if (action === "restored") return c.eventRestored;
  if (action === "purged") return c.eventPurged;
  return c.eventPurgeFailed;
}
function UploadMark() { return <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M5 7h22v18H5z" /><path d="m8 22 6-7 4 4 3-4 4 7M10 12h.01" /></svg>; }
function InventorySkeleton() { return <div className={styles.skeleton} aria-hidden="true"><i /><i /><i /><i /></div>; }
