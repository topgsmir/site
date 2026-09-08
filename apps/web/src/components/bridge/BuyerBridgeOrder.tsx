"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api/client";
import { getSocket } from "@/lib/sockets/socket";
import type { Locale } from "@/lib/i18n";
import styles from "./BridgeWorkspace.module.css";

type Order = {
  id: string;
  status: string;
  totalAmount: string;
  currency: string;
  seller: { shopName: string };
  items: Array<{
    productTitle: string;
    quantity: number;
    bridge?: {
      id: string;
      mode: string;
      status: string;
      errorCode: string | null;
      input?: { fields?: Record<string, string>; quantity?: number } | null;
      result?: unknown;
    };
  }>;
};

const COPY = {
  en: {
    brand: "Your order",
    back: "TopGSM",
    payment: "Payment",
    fulfillment: "Fulfilment",
    seller: "Seller",
    inputs: "Submitted information",
    result: "Delivery result",
    wait: "This page updates while the service is being fulfilled.",
    refund: "Request a refund",
    reason: "Tell us why",
    send: "Send request",
    sent: "Refund request sent.",
    error: "The order could not be loaded.",
  },
  fa: {
    brand: "سفارش شما",
    back: "تاپ جی‌اس‌ام",
    payment: "پرداخت",
    fulfillment: "انجام سفارش",
    seller: "فروشنده",
    inputs: "اطلاعات ثبت‌شده",
    result: "نتیجه تحویل",
    wait: "این صفحه هنگام انجام سرویس به‌روزرسانی می‌شود.",
    refund: "درخواست بازپرداخت",
    reason: "دلیل درخواست",
    send: "ارسال درخواست",
    sent: "درخواست بازپرداخت ارسال شد.",
    error: "بارگذاری سفارش ممکن نبود.",
  },
  ar: {
    brand: "طلبك",
    back: "TopGSM",
    payment: "الدفع",
    fulfillment: "التنفيذ",
    seller: "البائع",
    inputs: "المعلومات المرسلة",
    result: "نتيجة التسليم",
    wait: "تتحدث هذه الصفحة أثناء تنفيذ الخدمة.",
    refund: "طلب استرداد",
    reason: "سبب الطلب",
    send: "إرسال الطلب",
    sent: "تم إرسال طلب الاسترداد.",
    error: "تعذر تحميل الطلب.",
  },
} as const;

export function BuyerBridgeOrder({ locale, orderId }: { locale: Locale; orderId: string }) {
  const c = COPY[locale];
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState("");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    try {
      setOrder((await api.get<Order>(`/orders/${orderId}`)).data);
    } catch {
      setError(c.error);
    }
  }, [c.error, orderId]);

  useEffect(() => {
    void load();
    const socket = getSocket();
    const onUpdate = (payload: { orderId?: string }) => {
      if (payload.orderId === orderId) void load();
    };
    socket.on("order.status.updated", onUpdate);
    const timer = window.setInterval(() => void load(), 15_000);
    return () => {
      socket.off("order.status.updated", onUpdate);
      window.clearInterval(timer);
    };
  }, [load, orderId]);

  const bridge = order?.items[0]?.bridge;

  async function refund() {
    if (!bridge) return;
    try {
      await api.post(`/bridge/orders/${bridge.id}/refund-request`, { reason });
      setMessage(c.sent);
    } catch {
      setError(c.error);
    }
  }

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div>
          <p className={styles.brand}>{c.brand}</p>
          <h1>{order?.items[0]?.productTitle ?? `#${orderId}`}</h1>
        </div>
        <Link className={styles.link} href={`/${locale}`}>
          {c.back}
        </Link>
      </header>
      <main className={styles.main}>
        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}
        {order ? (
          <>
            <section className={styles.grid}>
              <article className={styles.card}>
                <h2>{c.payment}</h2>
                <span className={styles.status} data-tone={order.status === "pending" ? "warn" : "good"}>
                  {order.status}
                </span>
                <strong>
                  {Number(order.totalAmount).toLocaleString(locale)} {order.currency}
                </strong>
              </article>
              <article className={styles.card}>
                <h2>{c.fulfillment}</h2>
                <span
                  className={styles.status}
                  data-tone={bridge?.status === "succeeded" ? "good" : bridge?.status === "failed" ? "bad" : "warn"}
                >
                  {bridge?.status ?? "—"}
                </span>
                <p>{c.wait}</p>
              </article>
              <article className={styles.card}>
                <h2>{c.seller}</h2>
                <p>{order.seller.shopName}</p>
              </article>
            </section>
            <section className={styles.section}>
              <div className={styles.sectionHead}>
                <h2>{c.inputs}</h2>
              </div>
              <ul className={styles.fields}>
                {Object.entries(bridge?.input?.fields ?? {}).map(([key, value]) => (
                  <li key={key}>
                    {key}: {value}
                  </li>
                ))}
              </ul>
            </section>
            {bridge?.result ? (
              <section className={styles.section}>
                <div className={styles.sectionHead}>
                  <h2>{c.result}</h2>
                </div>
                <pre className={styles.card}>
                  {typeof bridge.result === "string" ? bridge.result : JSON.stringify(bridge.result, null, 2)}
                </pre>
              </section>
            ) : null}
            {bridge && ["failed", "manual_required"].includes(bridge.status) ? (
              <section className={styles.form}>
                <h2>{c.refund}</h2>
                <label className={styles.field}>
                  <span>{c.reason}</span>
                  <textarea
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    minLength={3}
                    maxLength={500}
                  />
                  <small>&nbsp;</small>
                </label>
                <button className={styles.button} disabled={reason.trim().length < 3} onClick={() => void refund()}>
                  {c.send}
                </button>
              </section>
            ) : null}
            {message ? (
              <p className={styles.success} role="status">
                {message}
              </p>
            ) : null}
          </>
        ) : (
          <p className={styles.empty}>…</p>
        )}
      </main>
    </div>
  );
}
