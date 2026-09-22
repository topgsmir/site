"use client";

import { useEffect, useId, useRef } from "react";
import { AccountIcon } from "@/components/account/AccountIcon";
import { API_BASE } from "@/lib/api/client";
import type { Locale } from "@/lib/i18n";
import { canDownload, type BuyerOrder, type OrderItem } from "./OrderDetails.types";
import type { OrderCopy } from "./OrderDetailsCopy";
import s from "./OrderDetails.module.css";

export function DownloadFilesModal({ item, order, locale, c, onClose }: {
  item: OrderItem; order: BuyerOrder; locale: Locale; c: OrderCopy; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const files = item.digitalDeliveries ?? (item.digitalDelivery ? [item.digitalDelivery] : []);

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
    <ul className={s.downloadFiles}>
      {files.map((file, index) => {
        const available = canDownload(order, { ...item, digitalDelivery: file });
        const exhausted = file.maxDownloads > 0 && file.downloadCount >= file.maxDownloads;
        return <li className={s.download} key={file.downloadUrl}>
          <div><strong><bdi>{file.destinationHost}</bdi></strong><p>{file.maxDownloads > 0 ? `${c.remaining}: ${Math.max(0, file.maxDownloads - file.downloadCount).toLocaleString(locale)}` : c.unlimited}</p></div>
          <div>{available ? <a className={s.primary} href={`${API_BASE}${file.downloadUrl}`} target="_blank" rel="noopener noreferrer" aria-describedby={`${descriptionId}-${index}`}>
            {c.download} {(index + 1).toLocaleString(locale)}<AccountIcon name="arrow" width={17} height={17} />
          </a> : <span className={s.muted}>{exhausted ? c.exhausted : c.locked}</span>}
          {available ? <small id={`${descriptionId}-${index}`}>{c.downloadHint}</small> : null}</div>
        </li>;
      })}
    </ul>
  </dialog>;
}
