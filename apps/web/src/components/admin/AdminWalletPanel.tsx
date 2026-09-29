"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { api } from "@/lib/api/client";
import { formatCurrencyAmount } from "@/lib/currency";
import type { Locale } from "@/lib/i18n";
import styles from "./AdminWalletPanel.module.css";

type Balance = { balance: string; currency: "TOMAN" };
type Entry = { id: string; amount: string; kind: string; reason: string; referenceType: string; referenceId: string; actorUserId: string | null; createdAt: string };
type History = { items: Entry[]; nextCursor: string | null };

const COPY = {
  fa: { title: "کیف پول کاربر", balance: "موجودی", amount: "مبلغ با علامت + یا − (تومان)", reason: "دلیل", reference: "مرجع", adjust: "ثبت اصلاح موجودی", refund: "بازگشت وجه سفارش به کیف پول", orderId: "شناسه سفارش", refundAction: "بازگشت وجه", history: "تاریخچه", more: "بیشتر", error: "عملیات کیف پول انجام نشد.", empty: "تراکنشی وجود ندارد." },
  en: { title: "User wallet", balance: "Balance", amount: "Signed amount (Toman)", reason: "Reason", reference: "Reference", adjust: "Record adjustment", refund: "Refund order to wallet", orderId: "Order ID", refundAction: "Refund", history: "History", more: "More", error: "Wallet operation failed.", empty: "No transactions." },
  ar: { title: "محفظة المستخدم", balance: "الرصيد", amount: "المبلغ بإشارة + أو − (تومان)", reason: "السبب", reference: "المرجع", adjust: "تسجيل التعديل", refund: "إعادة قيمة الطلب إلى المحفظة", orderId: "معرف الطلب", refundAction: "إعادة", history: "السجل", more: "المزيد", error: "تعذرت عملية المحفظة.", empty: "لا توجد معاملات." }
} as const;

export function AdminWalletPanel({ userId, locale }: { userId: string; locale: Locale }) {
  const c = COPY[locale];
  const [balance, setBalance] = useState<Balance | null>(null);
  const [history, setHistory] = useState<History>({ items: [], nextCursor: null });
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [reference, setReference] = useState("");
  const [orderId, setOrderId] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const adjustmentRequest = useRef<{ payload: string; key: string } | null>(null);
  const refundRequest = useRef<{ payload: string; key: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const [account, entries] = await Promise.all([api.get<Balance>(`/wallet/admin/users/${userId}`), api.get<History>(`/wallet/admin/users/${userId}/transactions`)]);
      setBalance(account.data); setHistory(entries.data); setError("");
    } catch { setError(c.error); }
  }, [userId, c.error]);
  useEffect(() => { const frame = requestAnimationFrame(() => void load()); return () => cancelAnimationFrame(frame); }, [load]);

  async function adjust(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const payload = JSON.stringify({ userId, amount, reason, reference });
      if (adjustmentRequest.current?.payload !== payload) adjustmentRequest.current = { payload, key: crypto.randomUUID() };
      await api.post(`/wallet/admin/users/${userId}/adjustments`, { amount, reason, reference }, { headers: { "Idempotency-Key": adjustmentRequest.current.key } });
      adjustmentRequest.current = null;
      setAmount(""); setReason(""); setReference(""); await load();
    } catch { setError(c.error); } finally { setBusy(false); }
  }

  async function refund(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const payload = JSON.stringify({ userId, orderId, reason: refundReason });
      if (refundRequest.current?.payload !== payload) refundRequest.current = { payload, key: crypto.randomUUID() };
      await api.post(`/wallet/admin/users/${userId}/orders/${orderId}/refund`, { reason: refundReason }, { headers: { "Idempotency-Key": refundRequest.current.key } });
      refundRequest.current = null;
      setOrderId(""); setRefundReason(""); await load();
    } catch { setError(c.error); } finally { setBusy(false); }
  }

  async function more() {
    if (!history.nextCursor) return;
    setBusy(true);
    try { const result = await api.get<History>(`/wallet/admin/users/${userId}/transactions`, { params: { cursor: history.nextCursor } }); setHistory((current) => ({ items: [...current.items, ...result.data.items], nextCursor: result.data.nextCursor })); }
    catch { setError(c.error); } finally { setBusy(false); }
  }

  return <details className={styles.panel}><summary>{c.title} {balance ? `· ${formatCurrencyAmount(balance.balance, "TOMAN", locale)}` : ""}</summary>
    <div className={styles.content}>
      {error ? <p className={styles.error} role="alert">{error}</p> : null}
      <p><strong>{c.balance}:</strong> {balance ? formatCurrencyAmount(balance.balance, "TOMAN", locale) : "—"}</p>
      <form onSubmit={(event) => void adjust(event)}><h3>{c.adjust}</h3><label>{c.amount}<input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="numeric" pattern="-?[1-9][0-9]{0,7}" required /></label><label>{c.reason}<input value={reason} onChange={(event) => setReason(event.target.value)} minLength={10} maxLength={500} required /></label><label>{c.reference}<input value={reference} onChange={(event) => setReference(event.target.value)} minLength={3} maxLength={128} required /></label><button disabled={busy} type="submit">{c.adjust}</button></form>
      <form onSubmit={(event) => void refund(event)}><h3>{c.refund}</h3><label>{c.orderId}<input value={orderId} onChange={(event) => setOrderId(event.target.value)} pattern="[0-9a-fA-F-]{36}" required /></label><label>{c.reason}<input value={refundReason} onChange={(event) => setRefundReason(event.target.value)} minLength={10} maxLength={500} required /></label><button disabled={busy} type="submit">{c.refundAction}</button></form>
      <h3>{c.history}</h3><div className={styles.history}>{history.items.map((entry) => <div key={entry.id}><strong>{entry.amount.startsWith("-") ? "" : "+"}{formatCurrencyAmount(entry.amount, "TOMAN", locale)}</strong><span>{entry.reason}<small>{entry.kind} · {entry.referenceType} · <bdi>{entry.referenceId}</bdi> · {new Date(entry.createdAt).toLocaleString(locale)} · <bdi>{entry.actorUserId}</bdi></small></span></div>)}</div>
      {!history.items.length ? <p>{c.empty}</p> : null}{history.nextCursor ? <button disabled={busy} type="button" onClick={() => void more()}>{c.more}</button> : null}
    </div>
  </details>;
}
