"use client";

import { scheduleEffectTask } from "@/lib/effect-task";
import type { AdminUploadDetail, UploadDeletionRequest, UploadDeletionRequestPage } from "@topgsm/shared-types";
import type { Route } from "next";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api/client";
import type { Locale } from "@/lib/i18n";
import styles from "./UploadDeletionQueue.module.css";

const copy = {
  en: { title: "Seller deletion requests", empty: "No requests awaiting review.", error: "Requests could not be loaded.", approve: "Approve and move to trash", reject: "Reject", reason: "Reason for rejection", cancel: "Cancel", more: "Load more", reviewError: "The request could not be reviewed.", reviewed: "Request reviewed.", confirm: "Approve this deletion request? The upload will move to the 30 day trash.", from: "Requested by", former: "Former seller member", preview: "Preview image", previewError: "Image preview could not be loaded.", linked: "Used by", unlinked: "No linked content", asset: "Asset ID", loading: "Loading image…", retry: "Retry" },
  fa: { title: "درخواست‌های حذف فروشندگان", empty: "درخواستی در انتظار بررسی نیست.", error: "بارگذاری درخواست‌ها ممکن نبود.", approve: "تأیید و انتقال به زباله‌دان", reject: "رد درخواست", reason: "دلیل رد", cancel: "انصراف", more: "نمایش بیشتر", reviewError: "بررسی درخواست انجام نشد.", reviewed: "درخواست بررسی شد.", confirm: "درخواست حذف تأیید شود؟ فایل به زباله‌دان ۳۰ روزه منتقل می‌شود.", from: "درخواست‌کننده", former: "عضو سابق فروشنده", preview: "پیش‌نمایش تصویر", previewError: "پیش‌نمایش تصویر بارگذاری نشد.", linked: "استفاده‌شده در", unlinked: "بدون محتوای پیوندی", asset: "شناسه تصویر", loading: "در حال بارگذاری تصویر…", retry: "تلاش دوباره" },
  ar: { title: "طلبات حذف البائعين", empty: "لا توجد طلبات بانتظار المراجعة.", error: "تعذر تحميل الطلبات.", approve: "الموافقة والنقل إلى المهملات", reject: "رفض", reason: "سبب الرفض", cancel: "إلغاء", more: "عرض المزيد", reviewError: "تعذرت مراجعة الطلب.", reviewed: "تمت مراجعة الطلب.", confirm: "هل توافق على طلب الحذف؟ سينتقل الملف إلى المهملات لمدة 30 يوماً.", from: "مقدم الطلب", former: "عضو بائع سابق", preview: "معاينة الصورة", previewError: "تعذر تحميل معاينة الصورة.", linked: "مستخدمة في", unlinked: "لا يوجد محتوى مرتبط", asset: "معرّف الصورة", loading: "جار تحميل الصورة…", retry: "إعادة المحاولة" }
} as const;

export function UploadDeletionQueue({ locale, onReviewed, refreshKey = 0 }: { locale: Locale; onReviewed?: () => void; refreshKey?: number }) {
  const c = copy[locale];
  const [items, setItems] = useState<UploadDeletionRequest[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [rejecting, setRejecting] = useState<UploadDeletionRequest | null>(null);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [failedCursor, setFailedCursor] = useState<string | null>(null);
  const [preview, setPreview] = useState<AdminUploadDetail | null>(null);
  const [previewing, setPreviewing] = useState<string | null>(null);
  const [previewFailure, setPreviewFailure] = useState<string | null>(null);
  const [imageState, setImageState] = useState<"loading" | "ready" | "error">("loading");
  const [imageRetry, setImageRetry] = useState(0);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const loadRequest = useRef(0);

  const load = useCallback(async (after?: string) => {
    const request = ++loadRequest.current;
    setLoading(true); setError(""); setFailedCursor(null);
    try {
      const response = await api.get<UploadDeletionRequestPage>(`/admin/uploads/deletion-requests${after ? `?cursor=${encodeURIComponent(after)}` : ""}`);
      if (request !== loadRequest.current) return;
      setItems((previous) => after ? [...previous, ...response.data.items] : response.data.items);
      setCursor(response.data.nextCursor);
    } catch { if (request === loadRequest.current) { setError(c.error); setFailedCursor(after ?? null); } }
    finally { if (request === loadRequest.current) setLoading(false); }
  }, [c.error]);

  useEffect(() => scheduleEffectTask(() => { void load(); }), [load, refreshKey]);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (rejecting && !dialog.open) dialog.showModal();
    if (!rejecting && dialog.open) dialog.close();
  }, [rejecting]);

  async function showPreview(item: UploadDeletionRequest) {
    if (preview?.id === item.assetId && preview.source === item.source) { setPreview(null); return; }
    setPreviewing(item.id); setPreviewFailure(null); setImageState("loading");
    try { setPreview((await api.get<AdminUploadDetail>(`/admin/uploads/${item.source}/${item.assetId}`)).data); }
    catch { setPreviewFailure(item.id); }
    finally { setPreviewing(null); }
  }

  async function review(item: UploadDeletionRequest, decision: "approve" | "reject") {
    if (decision === "approve" && !window.confirm(c.confirm)) return;
    setReviewing(true); setMessage("");
    try {
      await api.post(`/admin/uploads/deletion-requests/${item.id}/${decision}`, decision === "reject" ? { reason: reason.trim() } : {});
      setRejecting(null); setPreview(null); setReason(""); setMessage(c.reviewed); await load(); onReviewed?.();
    } catch { setMessage(c.reviewError); }
    finally { setReviewing(false); }
  }

  function linkedContent(item: UploadDeletionRequest) {
    if (!item.linkedContent) return <span className={styles.unlinked}>{c.unlinked}</span>;
    const href = item.linkedContent.type === "product" ? `/${locale}/admin/products/${item.linkedContent.id}` : `/${locale}/admin/blog/${item.linkedContent.id}`;
    return <Link className={styles.contentLink} href={href as Route}>{item.linkedContent.title}</Link>;
  }

  return <section className={styles.queue} aria-labelledby="deletion-requests-title">
    <h2 id="deletion-requests-title">{c.title} ({items.length}{cursor ? "+" : ""})</h2>
    {message ? <p role="status" className={styles.message}>{message}</p> : null}
    {error ? <p role="alert" className={styles.error}>{error} <button type="button" disabled={loading} onClick={() => void load(failedCursor ?? undefined)}>{c.retry}</button></p> : null}
    {!loading && !items.length && !error ? <p className={styles.empty}>{c.empty}</p> : null}
    <div className={styles.list} aria-busy={loading}>{items.map((item) => <article className={styles.row} key={item.id}>
      <div><strong>{item.sellerName}</strong>{linkedContent(item)}<span>{c.from}: {item.requesterName ?? c.former}</span><details className={styles.assetDetails}><summary>{c.asset}</summary><span dir="ltr">{item.source} · {item.assetId}</span></details></div>
      <p>{item.reason}</p>
      <time dateTime={item.requestedAt}>{new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(item.requestedAt))}</time>
      <div className={styles.actions}><button type="button" disabled={previewing === item.id} aria-expanded={preview?.id === item.assetId && preview.source === item.source} onClick={() => void showPreview(item)}>{c.preview}</button><button type="button" disabled={reviewing} onClick={() => void review(item, "approve")}>{c.approve}</button><button type="button" disabled={reviewing} onClick={() => { setRejecting(item); setReason(""); }}>{c.reject}</button></div>
      {previewFailure === item.id ? <div className={styles.preview} role="alert">{c.previewError} <button type="button" onClick={() => void showPreview(item)}>{c.retry}</button></div> : null}
      {preview?.id === item.assetId && preview.source === item.source ? <div className={styles.preview}>{preview.previewUrl ? <div className={styles.imageFrame}>{imageState === "loading" ? <span role="status">{c.loading}</span> : null}{imageState === "error" ? <span role="alert">{c.previewError} <button type="button" onClick={() => { setImageRetry((value) => value + 1); setImageState("loading"); }}>{c.retry}</button></span> : null}<Image key={`${preview.previewUrl}:${imageRetry}`} src={preview.previewUrl} alt={c.preview} width={180} height={120} unoptimized data-loading={imageState !== "ready"} onLoad={() => setImageState("ready")} onError={() => setImageState("error")} /></div> : <span>{c.previewError}</span>}{preview.linkedContent ? <span>{c.linked}: {preview.linkedContent.title}</span> : null}</div> : null}
    </article>)}</div>
    {cursor ? <button className={styles.more} type="button" disabled={loading} onClick={() => void load(cursor)}>{c.more}</button> : null}
    <dialog ref={dialogRef} className={styles.dialog} aria-labelledby="reject-upload-title" onCancel={() => setRejecting(null)}>{rejecting ? <><h3 id="reject-upload-title">{c.reject}</h3><p className={styles.dialogContext}><strong>{rejecting.sellerName}</strong> · {rejecting.linkedContent?.title ?? c.unlinked}</p><label><span>{c.reason}</span><textarea autoFocus minLength={3} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} /></label><footer><button type="button" onClick={() => setRejecting(null)}>{c.cancel}</button><button type="button" disabled={reviewing || reason.trim().length < 3} onClick={() => void review(rejecting, "reject")}>{c.reject}</button></footer></> : null}</dialog>
  </section>;
}
