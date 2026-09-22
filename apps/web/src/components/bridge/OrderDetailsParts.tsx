"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api/client";
import { currencyLabel, formatCurrencyAmount } from "@/lib/currency";
import type { Locale } from "@/lib/i18n";
import { AccountIcon } from "@/components/account/AccountIcon";
import { type BuyerOrder, type OrderItem } from "./OrderDetails.types";
import { statusLabel, statusTone, type OrderCopy } from "./OrderDetailsCopy";
import s from "./OrderDetails.module.css";
import { CustomerOrderChat } from "./CustomerOrderChat";
import { DownloadFilesModal } from "./DownloadFilesModal";

export function Money({ amount, currency, locale }: { amount: string; currency: string; locale: Locale }) {
  return <span className={s.money}>{formatCurrencyAmount(amount, currency, locale)} <small>{currencyLabel(currency)}</small></span>;
}

export function OrderDate({ value, locale }: { value: string; locale: Locale }) {
  return <time dateTime={value}>{new Date(value).toLocaleString(locale, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</time>;
}

export function StatusBadge({ status, c }: { status: string; c: OrderCopy }) {
  return <span className={s.badge} data-tone={statusTone(status)}><span aria-hidden="true" />{statusLabel(c, status)}</span>;
}

export function CopyValue({ value, label, c }: { value: string; label: string; c: OrderCopy }) {
  const [feedback, setFeedback] = useState("");
  useEffect(() => { if (!feedback) return; const timer = setTimeout(() => setFeedback(""), 3000); return () => clearTimeout(timer); }, [feedback]);
  async function copy() {
    try { await navigator.clipboard.writeText(value); setFeedback(c.copied); }
    catch { setFeedback(c.copyError); }
  }
  return <span className={s.copyValue}><bdi>{value}</bdi><button type="button" className={s.copy} onClick={() => void copy()} aria-label={`${c.copy}: ${label}`}>{c.copy}</button><span className={s.copyFeedback} role="status">{feedback}</span></span>;
}

export function OrderProgress({ order, locale, c }: { order: BuyerOrder; locale: Locale; c: OrderCopy }) {
  const digital = order.items.length > 0 && order.items.every((item) => item.productType === "digital");
  const physical = order.items.some((item) => item.productType === "physical");
  const stopped = ["cancelled", "refunded"].includes(order.status);
  const issue = stopped || order.status === "delivered" ? undefined : order.items.map((item) => item.bridge?.status).find((status) => status && ["failed", "manual_required", "refund_requested"].includes(status));
  const stages = digital ? [c.steps.placed, c.steps.payment, c.steps.ready, c.steps.delivered] : [c.steps.placed, c.steps.payment, c.steps.processing, physical ? c.steps.shipped : c.steps.ready, c.steps.delivered];
  const step = order.status === "pending" ? 1 : order.status === "paid" ? 2 : order.status === "processing" ? 2 : ["shipped", "awaiting_confirmation"].includes(order.status) ? stages.length - 2 : order.status === "delivered" ? stages.length - 1 : -1;
  const state = issue ?? order.status;
  const hint = c.hints[state as keyof OrderCopy["hints"]] ?? c.unknown;
  const showHint = stopped || Boolean(issue) || ["pending", "awaiting_confirmation"].includes(order.status) || step < 0;
  return <section className={s.progress} aria-labelledby="order-progress">
    <div className={s.progressHeading}><h2 id="order-progress">{c.progress}</h2><StatusBadge status={state} c={c} /></div>
    {!stopped && step >= 0 ? <ol className={s.steps}>{stages.map((label, index) => <li key={label} data-complete={index < step || order.status === "delivered"} aria-current={index === step ? "step" : undefined}>
      <span className={s.stepMark} aria-hidden="true">{index < step || order.status === "delivered" ? <AccountIcon name="check" width={9} height={9} /> : null}</span><strong><span className="sr-only">{(index + 1).toLocaleString(locale)}. </span>{label}</strong>
    </li>)}</ol> : null}
    <p className={showHint ? s.progressHint : "sr-only"}>{hint}</p>
  </section>;
}

function Result({ value, c }: { value: unknown; c: OrderCopy }) {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return <p className={s.result}>{String(value)}</p>;
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const entries = Object.entries(value);
    if (entries.length <= 12 && entries.every(([, entry]) => entry === null || ["string", "number", "boolean"].includes(typeof entry))) {
      return <dl className={s.fields}>{entries.map(([key, entry]) => <div key={key}><dt><bdi>{key}</bdi></dt><dd><bdi>{entry === null ? "—" : String(entry)}</bdi></dd></div>)}</dl>;
    }
  }
  return <details className={s.resultDetails}><summary>{c.structured}</summary><pre dir="ltr">{JSON.stringify(value, null, 2)}</pre></details>;
}

function RefundRequest({ item, c, refresh }: { item: OrderItem; c: OrderCopy; refresh: () => Promise<void> }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const lock = useRef(false);
  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!item.bridge || lock.current) return;
    if (reason.trim().length < 3 || reason.trim().length > 500) { setError(c.refundValidation); return; }
    lock.current = true; setBusy(true); setError("");
    try { await api.post(`/bridge/orders/${item.bridge.id}/refund-request`, { reason: reason.trim() }); setSent(true); await refresh(); }
    catch { setError(c.actionError); }
    finally { lock.current = false; setBusy(false); }
  }
  if (sent) return <p role="status" className={s.success}>{c.refundSent}</p>;
  return <details className={s.refund}><summary>{c.refund}</summary><form onSubmit={(event) => void submit(event)}>
    <label htmlFor={`reason-${item.id}`}>{c.reason}</label><textarea id={`reason-${item.id}`} value={reason} onChange={(event) => setReason(event.target.value)} required minLength={3} maxLength={500} rows={3} disabled={busy} aria-describedby={`reason-hint-${item.id}`} aria-invalid={Boolean(error)} />
    <small id={`reason-hint-${item.id}`}>{c.reasonHint}</small>{error ? <p role="alert" className={s.error}>{error}</p> : null}
    <button type="submit" className={s.primary} disabled={busy}>{busy ? c.working : c.send}</button>
  </form></details>;
}

export function PurchasedItem({ item, order, locale, c, refresh }: { item: OrderItem; order: BuyerOrder; locale: Locale; c: OrderCopy; refresh: () => Promise<void> }) {
  const [downloadsOpen, setDownloadsOpen] = useState(false);
  const delivery = item.digitalDelivery;
  const bridge = item.bridge;
  const inputs = item.serviceInputs ?? [];
  const fields = Object.entries(bridge?.input?.fields ?? {}).filter(([key]) => !inputs.some((field) => field.key === key));
  const files = item.digitalDeliveries ?? (delivery ? [delivery] : []);
  return <article className={s.item} aria-labelledby={`item-${item.id}`}>
    <div className={s.itemTop}>
      <header className={s.itemHeader}><span className={s.itemIcon}><AccountIcon name={item.productType === "digital" ? "file" : "orders"} width={26} height={26} /></span><div><span className={s.eyebrow}>{c.types[item.productType as keyof OrderCopy["types"]] ?? c.order}</span><h3 id={`item-${item.id}`}>{item.productTitle}</h3></div>{bridge ? <StatusBadge status={bridge.status} c={c} /> : null}</header>
      {item.productType === "digital" && files.length > 0 ? <div className={s.downloadActions}>
        <button type="button" className={s.primary} aria-haspopup="dialog" onClick={() => setDownloadsOpen(true)}>{c.download}<AccountIcon name="arrow" width={17} height={17} /></button>
        {downloadsOpen ? <DownloadFilesModal item={item} order={order} locale={locale} c={c} onClose={() => setDownloadsOpen(false)} /> : null}
      </div> : null}
    </div>
    <dl className={s.itemPricing}><div><dt>{c.quantity}</dt><dd>{item.quantity.toLocaleString(locale)}</dd></div><div><dt>{c.unit}</dt><dd><Money amount={item.unitPrice} currency={order.currency} locale={locale} /></dd></div><div><dt>{c.itemTotal}</dt><dd><Money amount={item.totalAmount} currency={order.currency} locale={locale} /></dd></div></dl>
    {item.productType === "digital" && !files.length ? <div className={s.download}><strong>{c.locked}</strong><p>{c.downloadWait}</p></div> : null}
    {inputs.length || fields.length ? <div className={s.itemSection}><h4>{c.inputs}</h4><dl className={s.fields}>{inputs.map((field) => <div key={field.key}><dt>{field.label}</dt><dd><bdi>{field.sensitive || field.type === "password" || field.value === null ? c.protected : field.value}</bdi></dd></div>)}{fields.map(([key, value]) => <div key={key}><dt><bdi>{key}</bdi></dt><dd><bdi>{value}</bdi></dd></div>)}</dl></div> : null}
    {item.serviceNote ? <div className={s.itemSection}><h4>{c.note}</h4><p className={s.result}>{item.serviceNote}</p></div> : null}
    {bridge ? <div className={s.itemSection}><div className={s.sectionHeading}><h4>{c.result}</h4>{bridge.completedAt ? <small>{c.completed}: <OrderDate value={bridge.completedAt} locale={locale} /></small> : null}</div>{bridge.result !== undefined && bridge.result !== null ? <Result value={bridge.result} c={c} /> : <p className={s.muted}>{c.resultWait}</p>}{["failed", "manual_required"].includes(bridge.status) ? <RefundRequest item={item} c={c} refresh={refresh} /> : null}</div> : null}
    <div className={s.itemSeller}>
      <p className={s.eyebrow}><bdi>{order.seller.shopName}</bdi></p>
      <CustomerOrderChat orderId={order.id} orderItemId={item.id} available={order.chatAvailable} c={c} />
    </div>
  </article>;
}

export function ShippingDetails({ order, locale, c }: { order: BuyerOrder; locale: Locale; c: OrderCopy }) {
  const address = order.shippingAddress;
  const shipment = order.shipment;
  return <section className={s.panel}><div className={s.sectionHeading}><h2>{c.delivery}</h2><AccountIcon name="orders" /></div>
    {address ? <dl className={s.fields}><div><dt>{c.recipient}</dt><dd>{address.recipientName}<br /><bdi>{address.phoneNumber}</bdi></dd></div><div><dt>{c.address}</dt><dd>{[address.province, address.city, address.addressLine].filter(Boolean).join(locale === "en" ? ", " : "، ")}</dd></div><div><dt>{c.postal}</dt><dd><bdi>{address.postalCode}</bdi></dd></div></dl> : null}
    {shipment ? <dl className={s.fields}><div><dt>{c.carrier}</dt><dd>{shipment.carrier ?? "—"}</dd></div><div><dt>{c.tracking}</dt><dd>{shipment.trackingCode ? <CopyValue value={shipment.trackingCode} label={c.tracking} c={c} /> : "—"}</dd></div><div><dt>{c.shipped}</dt><dd><OrderDate value={shipment.shippedAt} locale={locale} /></dd></div></dl> : <p className={s.muted}>{c.shippingWait}</p>}
  </section>;
}

export function Confirmation({ action, busy, error, c, onClose, onConfirm }: { action: "cancelled" | "delivered"; busy: boolean; error: string; c: OrderCopy; onClose: () => void; onConfirm: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const element = dialog.current; element?.showModal();
    return () => { element?.close(); previous?.focus(); };
  }, []);
  const title = action === "cancelled" ? c.cancel : c.confirm;
  return <dialog ref={dialog} className={s.dialog} aria-labelledby="confirm-title" aria-describedby="confirm-description" onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}>
    <h2 id="confirm-title">{title}</h2><p id="confirm-description">{action === "cancelled" ? c.cancelHint : c.confirmHint}</p>
    {error ? <p role="alert" className={s.error}>{error}</p> : null}
    <div className={s.actions}><button type="button" className={s.secondary} disabled={busy} onClick={onClose} autoFocus>{c.close}</button><button type="button" className={s.primary} disabled={busy} onClick={onConfirm}>{busy ? c.working : title}</button></div>
  </dialog>;
}
