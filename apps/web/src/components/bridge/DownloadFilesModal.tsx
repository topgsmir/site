"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AccountIcon } from "@/components/account/AccountIcon";
import { openDigitalDownload } from "@/lib/digital-download";
import type { Locale } from "@/lib/i18n";
import { canDownload, remainingDownloads, type BuyerOrder, type OrderItem } from "./OrderDetails.types";
import type { OrderCopy } from "./OrderDetailsCopy";
import s from "./OrderDetails.module.css";

export function DownloadFilesModal({ item, order, locale, c, onClose, refresh }: {
  item: OrderItem; order: BuyerOrder; locale: Locale; c: OrderCopy; onClose: () => void; refresh: () => Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const files = item.digitalDeliveries ?? (item.digitalDelivery ? [item.digitalDelivery] : []);
  const [busyIndex, setBusyIndex] = useState<number | null>(null);
  const [error, setError] = useState("");

  async function download(path: string, index: number) {
    setBusyIndex(index);
    setError("");
    try { await openDigitalDownload(path); void refresh().catch(() => undefined); }
    catch { setError(c.actionError); }
    finally { setBusyIndex(null); }
  }

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    const element = dialog.current;
    element?.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      element?.close();
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, []);

  return <dialog ref={dialog} className={`${s.dialog} ${s.downloadDialog}`} aria-labelledby={titleId} aria-describedby={descriptionId} onCancel={(event) => { event.preventDefault(); onClose(); }}>
    <header className={s.downloadDialogHeader}>
      <div><h2 id={titleId}>{c.download}</h2><p id={descriptionId}>{item.productTitle}</p></div>
      <button type="button" className={s.secondary} onClick={onClose} autoFocus>{c.close}</button>
    </header>
    {error ? <p className={s.error} role="alert">{error}</p> : null}
    <ul className={s.downloadFiles}>
      {files.map((file, index) => {
        const available = canDownload(order, { ...item, digitalDelivery: file });
        const exhausted = file.maxDownloads > 0 && file.downloadCount >= file.maxDownloads;
        const remaining = remainingDownloads(file);
        return <li className={s.download} key={file.downloadUrl}>
          <div><strong><bdi>{file.title || file.destinationHost}</bdi></strong><p>{c.downloadCount}: {file.downloadCount.toLocaleString(locale)} · {remaining === null ? c.unlimited : `${c.remaining}: ${remaining.toLocaleString(locale)}`}</p></div>
          <div>{available ? <button className={s.primary} type="button" disabled={busyIndex !== null} onClick={() => void download(file.downloadUrl, index)} aria-describedby={`${descriptionId}-${index}`}>
            {busyIndex === index ? c.working : c.download} {(index + 1).toLocaleString(locale)}<AccountIcon name="arrow" width={17} height={17} />
          </button> : <span className={s.muted}>{exhausted ? c.exhausted : c.locked}</span>}
          {available ? <small id={`${descriptionId}-${index}`}>{c.downloadHint}</small> : null}</div>
        </li>;
      })}
    </ul>
  </dialog>;
}
