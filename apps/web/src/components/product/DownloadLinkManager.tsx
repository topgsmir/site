"use client";

import { useEffect, useState } from "react";
import type { SellerProductOffer } from "@topgsm/shared-types";
import type { Locale } from "@/lib/i18n";
import { validDownloadLinks, type DownloadLink } from "@/lib/download-links";
import { api } from "@/lib/api/client";
import { DownloadLinkRows } from "./DownloadLinkRows";
import styles from "./DownloadLinkManager.module.css";

type Request = { id: string; action: string; status: string; link_index: number; review_reason: string | null };
const copy = {
  en: { title: "Download links", save: "Save links", add: "Add link", edit: "Request edit", remove: "Request deletion", pending: "Awaiting admin approval", approved: "Approved", rejected: "Rejected", saved: "Download links saved.", added: "Link added.", requested: "Request sent to an admin. The current link remains active.", error: "Could not update download links.", url: "Download URL", name: "Link title", hint: "You can add links now. Editing or deleting an existing link needs admin approval.", last: "Keep at least one link." },
  fa: { title: "لینک‌های دانلود", save: "ذخیره لینک‌ها", add: "افزودن لینک", edit: "درخواست ویرایش", remove: "درخواست حذف", pending: "در انتظار تأیید مدیر", approved: "تأییدشده", rejected: "ردشده", saved: "لینک‌های دانلود ذخیره شدند.", added: "لینک افزوده شد.", requested: "درخواست برای مدیر فرستاده شد. لینک فعلی تا تأیید فعال می‌ماند.", error: "تغییر لینک‌های دانلود ممکن نبود.", url: "لینک دانلود", name: "عنوان لینک", hint: "لینک جدید فوراً اضافه می‌شود. ویرایش یا حذف لینک فعلی به تأیید مدیر نیاز دارد.", last: "حداقل یک لینک باید باقی بماند." },
  ar: { title: "روابط التنزيل", save: "حفظ الروابط", add: "إضافة رابط", edit: "طلب تعديل", remove: "طلب حذف", pending: "بانتظار موافقة المسؤول", approved: "تمت الموافقة", rejected: "مرفوض", saved: "حُفظت روابط التنزيل.", added: "أُضيف الرابط.", requested: "أُرسل الطلب للمسؤول. يبقى الرابط الحالي نشطاً حتى الموافقة.", error: "تعذر تحديث روابط التنزيل.", url: "رابط التنزيل", name: "عنوان الرابط", hint: "يمكنك إضافة رابط فوراً. يتطلب تعديل رابط موجود أو حذفه موافقة المسؤول.", last: "يجب الإبقاء على رابط واحد على الأقل." }
} as const;

function currentLinks(offer: SellerProductOffer): DownloadLink[] {
  return (offer.digital?.fileReferences ?? []).map((url, index) => ({ url, title: offer.digital?.fileTitles[index] ?? "" }));
}

export function DownloadLinkManager({ locale, offer, mode, onUpdated }: {
  locale: Locale;
  offer: SellerProductOffer;
  mode: "admin" | "seller";
  onUpdated: (links: DownloadLink[]) => void;
}) {
  const c = copy[locale];
  const [links, setLinks] = useState<DownloadLink[]>(() => currentLinks(offer));
  const [addition, setAddition] = useState<DownloadLink>({ url: "", title: "" });
  const [requests, setRequests] = useState<Request[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (mode !== "seller") return;
    void api.get<Request[]>(`/products/offers/${offer.id}/download-link-requests`).then(({ data }) => setRequests(data)).catch(() => setError(c.error));
  }, [mode, offer.id, c.error]);

  async function saveAdmin() {
    if (!validDownloadLinks(links)) { setError(c.error); return; }
    setBusy(true); setError(""); setMessage("");
    try {
      const { data } = await api.put<{ fileReferences: string[]; fileTitles: string[] }>(`/products/admin/offers/${offer.id}/download-links`, {
        fileReferences: links.map((link) => link.url.trim()), fileTitles: links.map((link) => link.title.trim())
      });
      const saved = data.fileReferences.map((url, index) => ({ url, title: data.fileTitles[index] ?? "" }));
      setLinks(saved); onUpdated(saved);
      setMessage(c.saved);
    } catch { setError(c.error); }
    finally { setBusy(false); }
  }

  async function addSeller() {
    if (!validDownloadLinks([addition])) { setError(c.error); return; }
    setBusy(true); setError(""); setMessage("");
    try {
      const { data } = await api.post<{ fileReferences: string[]; fileTitles: string[] }>(`/products/offers/${offer.id}/download-links`, { url: addition.url.trim(), title: addition.title.trim() });
      const saved = data.fileReferences.map((url, index) => ({ url, title: data.fileTitles[index] ?? "" }));
      setLinks(saved); onUpdated(saved);
      setAddition({ url: "", title: "" }); setMessage(c.added);
    } catch { setError(c.error); }
    finally { setBusy(false); }
  }

  async function requestChange(index: number, action: "edit" | "delete") {
    if (action === "delete" && links.length === 1) { setError(c.last); return; }
    if (action === "edit" && !validDownloadLinks([links[index]!])) { setError(c.error); return; }
    setBusy(true); setError(""); setMessage("");
    try {
      const { data } = await api.post<{ id: string; status: string }>(`/products/offers/${offer.id}/download-link-requests`, {
        action, linkIndex: index, ...(action === "edit" ? { url: links[index]!.url.trim(), title: links[index]!.title.trim() } : {})
      });
      setRequests((current) => [{ id: data.id, action, status: data.status, link_index: index, review_reason: null }, ...current]);
      if (action === "edit") setLinks(currentLinks(offer));
      setMessage(c.requested);
    } catch { setError(c.error); }
    finally { setBusy(false); }
  }

  return <section className={styles.manager} aria-label={c.title}>
    <strong>{c.title}</strong>
    {mode === "admin" ? <>
      <DownloadLinkRows locale={locale} links={links} onChange={setLinks} removable required={false} />
      <button className={styles.action} type="button" disabled={busy || !validDownloadLinks(links)} onClick={() => void saveAdmin()}>{c.save}</button>
    </> : <>
      <p>{c.hint}</p>
      <div className={styles.links}>{links.map((link, index) => {
        const pending = requests.some((request) => request.link_index === index && request.status === "pending");
        return <div className={styles.link} key={`${offer.id}-${index}`}>
          <label><span>{c.url} {index + 1}</span><input type="url" dir="ltr" maxLength={2048} value={link.url} disabled={busy || pending} onChange={(event) => setLinks((current) => current.map((item, position) => position === index ? { ...item, url: event.target.value } : item))} /></label>
          <label><span>{c.name}</span><input maxLength={120} value={link.title} disabled={busy || pending} onChange={(event) => setLinks((current) => current.map((item, position) => position === index ? { ...item, title: event.target.value } : item))} /></label>
          <div className={styles.actions}><button type="button" disabled={busy || pending || (link.url === offer.digital?.fileReferences[index] && link.title === offer.digital?.fileTitles[index])} onClick={() => void requestChange(index, "edit")}>{c.edit}</button><button type="button" disabled={busy || pending || links.length === 1} onClick={() => void requestChange(index, "delete")}>{c.remove}</button></div>
          {pending ? <small>{c.pending}</small> : null}
        </div>;
      })}</div>
      <div className={styles.add}><label><span>{c.url}</span><input type="url" dir="ltr" maxLength={2048} value={addition.url} onChange={(event) => setAddition((current) => ({ ...current, url: event.target.value }))} /></label><label><span>{c.name}</span><input maxLength={120} value={addition.title} onChange={(event) => setAddition((current) => ({ ...current, title: event.target.value }))} /></label><button type="button" disabled={busy || links.length >= 50 || !validDownloadLinks([addition])} onClick={() => void addSeller()}>{c.add}</button></div>
      {requests.filter((request) => request.status !== "pending").slice(0, 3).map((request) => <small key={request.id}>{request.link_index + 1}: {request.status === "approved" ? c.approved : c.rejected}{request.review_reason ? ` · ${request.review_reason}` : ""}</small>)}
    </>}
    {message ? <p role="status">{message}</p> : null}
    {error ? <p role="alert">{error}</p> : null}
  </section>;
}
