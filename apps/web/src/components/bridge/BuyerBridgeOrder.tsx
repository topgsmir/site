"use client";

import Link from "next/link";
import type { Route } from "next";
import { useCallback, useEffect, useState } from "react";
import { API_BASE, api } from "@/lib/api/client";
import { currencyLabel, formatCurrencyAmount } from "@/lib/currency";
import { getSocket } from "@/lib/sockets/socket";
import type { Locale } from "@/lib/i18n";
import styles from "./BridgeWorkspace.module.css";

type Order = {
  id: string;
  checkoutId?: string | null;
  status: string;
  totalAmount: string;
  currency: string;
  seller: { shopName: string };
  shippingAddress?: { recipientName: string; phoneNumber: string; province: string; city: string; postalCode: string; addressLine: string } | null;
  shipment?: { carrier: string | null; trackingCode: string | null; shippedAt: string } | null;
  items: Array<{
    id: string;
    productTitle: string;
    productType: string;
    quantity: number;
    serviceNote?: string | null;
    digitalDelivery?: { downloadUrl: string; destinationHost: string; maxDownloads: number; downloadCount: number };
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
    account: "My account", continuePayment: "Continue payment", confirm: "Confirm delivery", cancel: "Cancel order", working: "Working…", actionError: "The order could not be updated.",
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
    account: "حساب من", continuePayment: "ادامه پرداخت", confirm: "تأیید تحویل", cancel: "لغو سفارش", working: "در حال انجام…", actionError: "سفارش به‌روز نشد. دوباره تلاش کنید.",
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
    account: "حسابي", continuePayment: "متابعة الدفع", confirm: "تأكيد التسليم", cancel: "إلغاء الطلب", working: "جارٍ التنفيذ…", actionError: "تعذر تحديث الطلب.",
    error: "تعذر تحميل الطلب.",
  },
} as const;

const STATUS: Record<Locale, Record<string, string>> = {
  en: { pending: "Payment pending", paid: "Paid", processing: "Processing", shipped: "Shipped", awaiting_confirmation: "Awaiting confirmation", delivered: "Delivered", cancelled: "Cancelled", waiting_payment: "Waiting for payment", queued: "Queued", submitting: "Submitting", submitted: "Submitted", polling: "Checking result", manual_required: "Needs review", succeeded: "Completed", failed: "Failed", refund_requested: "Refund requested" },
  fa: { pending: "در انتظار پرداخت", paid: "پرداخت‌شده", processing: "در حال پردازش", shipped: "ارسال‌شده", awaiting_confirmation: "در انتظار تأیید", delivered: "تحویل‌شده", cancelled: "لغوشده", waiting_payment: "در انتظار پرداخت", queued: "در صف انجام", submitting: "در حال ثبت", submitted: "ثبت‌شده", polling: "در حال بررسی نتیجه", manual_required: "نیازمند بررسی", succeeded: "انجام‌شده", failed: "ناموفق", refund_requested: "درخواست بازپرداخت ثبت‌شده" },
  ar: { pending: "بانتظار الدفع", paid: "مدفوع", processing: "قيد المعالجة", shipped: "تم الشحن", awaiting_confirmation: "بانتظار التأكيد", delivered: "تم التسليم", cancelled: "ملغى", waiting_payment: "بانتظار الدفع", queued: "في قائمة الانتظار", submitting: "جارٍ الإرسال", submitted: "تم الإرسال", polling: "جارٍ فحص النتيجة", manual_required: "بحاجة إلى مراجعة", succeeded: "مكتمل", failed: "فشل", refund_requested: "تم طلب الاسترداد" }
};

export function BuyerOrderDetails({ locale, orderId }: { locale: Locale; orderId: string }) {
  const c = COPY[locale];
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState("");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setError("");
      setOrder((await api.get<Order>(`/orders/${orderId}`)).data);
    } catch {
      setError(c.error);
    }
  }, [c.error, orderId]);

  useEffect(() => {
    const loadFrame = window.requestAnimationFrame(() => void load());
    const socket = getSocket();
    const onUpdate = (payload: { orderId?: string }) => {
      if (payload.orderId === orderId) void load();
    };
    socket.on("order.status.updated", onUpdate);
    const timer = window.setInterval(() => void load(), 15_000);
    return () => {
      window.cancelAnimationFrame(loadFrame);
      socket.off("order.status.updated", onUpdate);
      window.clearInterval(timer);
    };
  }, [load, orderId]);

  const bridge = order?.items.find((item) => item.bridge)?.bridge;

  async function refund() {
    if (!bridge) return;
    setBusy(true); setError("");
    try {
      await api.post(`/bridge/orders/${bridge.id}/refund-request`, { reason });
      setMessage(c.sent);
    } catch {
      setError(c.actionError);
    } finally { setBusy(false); }
  }

  async function transition(status: "delivered" | "cancelled") {
    setBusy(true); setError("");
    try {
      await api.patch(`/orders/${orderId}/status`, { status }, { headers: { "Idempotency-Key": crypto.randomUUID() } });
      await load();
    } catch { setError(c.actionError); }
    finally { setBusy(false); }
  }

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div>
          <p className={styles.brand}>{c.brand}</p>
          <h1>{order?.items[0]?.productTitle ?? `#${orderId}`}</h1>
        </div>
        <Link className={styles.link} href={`/${locale}/account/orders` as Route}>
          {c.account}
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
                  {STATUS[locale][order.status] ?? order.status}
                </span>
                <strong>
                  {formatCurrencyAmount(order.totalAmount, order.currency, locale)} {currencyLabel(order.currency)}
                </strong>
              </article>
              <article className={styles.card}>
                <h2>{c.fulfillment}</h2>
                <span
                  className={styles.status}
                  data-tone={bridge?.status === "succeeded" ? "good" : bridge?.status === "failed" ? "bad" : "warn"}
                >
                  {STATUS[locale][bridge?.status ?? order.status] ?? bridge?.status ?? order.status}
                </span>
                <p>{c.wait}</p>
              </article>
              <article className={styles.card}>
                <h2>{c.seller}</h2>
                <p>{order.seller.shopName}</p>
              </article>
            </section>
            <div className={styles.actions}>
              {order.status === "pending" && order.checkoutId ? <Link className={styles.link} href={`/${locale}/checkout/${order.checkoutId}` as Route}>{c.continuePayment}</Link> : null}
              {order.status === "pending" ? <button className={styles.buttonQuiet} type="button" disabled={busy} onClick={() => void transition("cancelled")}>{busy ? c.working : c.cancel}</button> : null}
              {(order.status === "shipped" || order.status === "awaiting_confirmation" || (order.status === "paid" && order.items.length > 0 && order.items.every((item) => item.productType === "digital"))) ? <button className={styles.button} type="button" disabled={busy} onClick={() => void transition("delivered")}>{busy ? c.working : c.confirm}</button> : null}
            </div>
            {order.shippingAddress ? <section className={styles.section}><div className={styles.sectionHead}><h2>{locale === "fa" ? "نشانی تحویل" : locale === "ar" ? "عنوان التسليم" : "Delivery address"}</h2></div><p>{order.shippingAddress.recipientName} · {order.shippingAddress.phoneNumber}</p><p>{order.shippingAddress.province}، {order.shippingAddress.city}، {order.shippingAddress.addressLine} · {order.shippingAddress.postalCode}</p>{order.shipment ? <p>{order.shipment.carrier} · {order.shipment.trackingCode}</p> : null}</section> : null}
            {order.items.some((item) => item.digitalDelivery) ? <section className={styles.section}><div className={styles.sectionHead}><h2>{locale === "fa" ? "فایل‌های خریداری‌شده" : locale === "ar" ? "الملفات المشتراة" : "Purchased files"}</h2></div>{order.items.map((item) => item.digitalDelivery ? <p key={item.id}><a href={`${API_BASE}${item.digitalDelivery.downloadUrl}`} target="_blank" rel="noopener noreferrer">{item.productTitle} · {item.digitalDelivery.destinationHost}</a></p> : null)}</section> : null}
            {bridge ? <section className={styles.section}>
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
            </section> : null}
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
                <button className={styles.button} disabled={busy || reason.trim().length < 3} onClick={() => void refund()}>
                  {busy ? c.working : c.send}
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
          <div className={styles.empty}><p>{error || "…"}</p>{error ? <button className={styles.buttonQuiet} type="button" onClick={() => void load()}>{locale === "fa" ? "تلاش دوباره" : locale === "ar" ? "حاول مجددًا" : "Try again"}</button> : null}</div>
        )}
      </main>
    </div>
  );
}
