"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api/client";
import { currencyLabel, formatCurrencyAmount } from "@/lib/currency";
import type { Locale } from "@/lib/i18n";
import styles from "@/components/bridge/BridgeWorkspace.module.css";

type BridgeDetails = { id: string; status: string; errorCode: string | null; input: { fields?: Record<string, string> } | null };
type SellerOrder = {
  id: string; seller?: { id: string; shopName: string }; buyer?: { fullName: string; email: string; phoneNumber: string | null };
  status: string; currency: string; totalAmount: string; createdAt: string;
  shippingAddress?: { recipientName: string; phoneNumber: string; province: string; city: string; postalCode: string; addressLine: string } | null;
  amadastShipment?: { externalOrderId: number; status: string; courierTrackingCode: string | null; courierTitle: string | null; errorCode: string | null } | null;
  items: Array<{ offerId: string; productTitle: string; productType: string; quantity: number; serviceNote?: string | null; bridge?: BridgeDetails }>;
};
type BridgeOrderAction = { id: string; mayRetry: boolean };

const COPY = {
  en: { intro: "Manage every customer order in one place, including Bridge fulfilment.", adminIntro: "Review every order placed across the platform.", empty: "No orders yet.", refresh: "Refresh", loadMore: "Load more", seller: "Seller", buyer: "Buyer", address: "Delivery address", result: "Delivery result", complete: "Publish result", retry: "Retry once", process: "Start processing", ready: "Ready for confirmation", ship: "Mark shipped manually", amadast: "Send with Amadast", amadastSync: "Refresh Amadast tracking", carrier: "Carrier", tracking: "Tracking code", error: "Orders could not be loaded.", actionError: "The order action failed." },
  fa: { intro: "همه سفارش‌های مشتریان، از جمله پردازش Bridge، را در یک جا مدیریت کنید.", adminIntro: "همه سفارش‌های ثبت‌شده در پلتفرم را یک‌جا بررسی کنید.", empty: "هنوز سفارشی ندارید.", refresh: "تازه‌سازی", loadMore: "نمایش بیشتر", seller: "فروشنده", buyer: "خریدار", address: "نشانی تحویل", result: "نتیجه تحویل", complete: "ثبت نتیجه", retry: "یک تلاش دوباره", process: "شروع پردازش", ready: "آماده تأیید مشتری", ship: "ثبت ارسال دستی", amadast: "ارسال با آمادست", amadastSync: "دریافت کد رهگیری آمادست", carrier: "شرکت حمل", tracking: "کد رهگیری", error: "دریافت سفارش‌ها انجام نشد.", actionError: "عملیات سفارش انجام نشد." },
  ar: { intro: "أدر جميع طلبات العملاء، بما فيها تنفيذ Bridge، في مكان واحد.", adminIntro: "راجع جميع الطلبات المسجلة عبر المنصة.", empty: "لا توجد طلبات بعد.", refresh: "تحديث", loadMore: "عرض المزيد", seller: "البائع", buyer: "المشتري", address: "عنوان التسليم", result: "نتيجة التسليم", complete: "نشر النتيجة", retry: "إعادة المحاولة", process: "بدء المعالجة", ready: "جاهز لتأكيد العميل", ship: "تسجيل الشحن يدوياً", amadast: "الشحن عبر Amadast", amadastSync: "تحديث تتبع Amadast", carrier: "شركة الشحن", tracking: "رقم التتبع", error: "تعذر تحميل الطلبات.", actionError: "تعذر تنفيذ إجراء الطلب." }
} as const;

export function OrdersWorkspace({ locale, audience }: { locale: Locale; audience: "seller" | "admin" }) {
  const copy = COPY[locale];
  const [orders, setOrders] = useState<SellerOrder[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [bridgeActions, setBridgeActions] = useState<BridgeOrderAction[]>([]);
  const [results, setResults] = useState<Record<string, string>>({});
  const [shipping, setShipping] = useState<Record<string, { carrier: string; trackingCode: string }>>({});
  const [amadastEnabled, setAmadastEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const retryable = useMemo(() => new Set(bridgeActions.filter((item) => item.mayRetry).map((item) => item.id)), [bridgeActions]);

  const load = useCallback(async (cursor?: string) => {
    setLoading(true); setError("");
    try {
      const response = await api.get<{ items: SellerOrder[]; nextCursor: string | null; shippingProviders: { amadast: { enabled: boolean } } }>("/orders", { params: { limit: 50, ...(cursor ? { cursor } : {}) } });
      setOrders((current) => cursor ? [...current, ...response.data.items] : response.data.items); setNextCursor(response.data.nextCursor);
      setAmadastEnabled(response.data.shippingProviders.amadast.enabled);
      if (!cursor && audience === "seller" && process.env.NEXT_PUBLIC_BRIDGE_FEATURE_ENABLED === "true") setBridgeActions((await api.get<BridgeOrderAction[]>("/bridge/orders")).data);
      else if (!cursor) setBridgeActions([]);
    } catch { setError(copy.error); } finally { setLoading(false); }
  }, [audience, copy.error]);
  useEffect(() => { const frame = requestAnimationFrame(() => void load()); return () => cancelAnimationFrame(frame); }, [load]);

  async function bridgeAction(id: string, action: "complete" | "retry") {
    setBusy(`${id}:${action}`); setError("");
    try { if (action === "complete") await api.post(`/bridge/orders/${id}/complete`, { result: results[id] ?? "" }); else await api.post(`/bridge/orders/${id}/retry`); await load(); }
    catch { setError(copy.actionError); } finally { setBusy(""); }
  }
  async function transition(orderId: string, status: "processing" | "awaiting_confirmation") {
    setBusy(orderId); setError("");
    try { await api.patch(`/orders/${orderId}/status`, { status }, { headers: { "Idempotency-Key": crypto.randomUUID() } }); await load(); }
    catch { setError(copy.actionError); } finally { setBusy(""); }
  }
  async function ship(orderId: string) {
    setBusy(orderId); setError("");
    try { await api.patch(`/orders/${orderId}/shipping`, shipping[orderId] ?? {}, { headers: { "Idempotency-Key": crypto.randomUUID() } }); await load(); }
    catch { setError(copy.actionError); } finally { setBusy(""); }
  }
  async function amadast(orderId: string, action: "register" | "sync") {
    setBusy(orderId); setError("");
    try { await api.post(`/orders/${orderId}/shipping/amadast${action === "sync" ? "/sync" : ""}`, {}, { headers: { "Idempotency-Key": crypto.randomUUID() } }); await load(); }
    catch { setError(copy.actionError); } finally { setBusy(""); }
  }

  return <section className={styles.workspace} aria-labelledby="seller-orders-title"><header className={styles.workspaceIntro}><div className={styles.sectionHead}><p id="seller-orders-title">{audience === "admin" ? copy.adminIntro : copy.intro}</p><button className={styles.buttonQuiet} type="button" onClick={() => void load()} disabled={loading}>{copy.refresh}</button></div></header>
    {orders.length ? <div className={styles.grid}>{orders.map((order) => <article className={styles.card} key={order.id}><div className={styles.cardHead}><div><h3>#{order.id}</h3><p className={styles.muted}>{new Date(order.createdAt).toLocaleString(locale)} · {formatCurrencyAmount(order.totalAmount, order.currency, locale)} {currencyLabel(order.currency)}</p>{audience === "admin" && order.seller ? <p className={styles.muted}>{copy.seller}: {order.seller.shopName}</p> : null}</div><span className={styles.status} data-tone={order.status === "delivered" ? "good" : order.status === "cancelled" ? "bad" : "warn"}>{order.status}</span></div>
      {order.buyer ? <p className={styles.muted}>{copy.buyer}: {order.buyer.fullName} · {order.buyer.phoneNumber ?? order.buyer.email}</p> : null}{order.shippingAddress ? <p className={styles.muted}>{copy.address}: {order.shippingAddress.province}، {order.shippingAddress.city}، {order.shippingAddress.addressLine} · {order.shippingAddress.postalCode}</p> : null}
      {order.items.map((item) => <div key={item.offerId}><p><strong>{item.productTitle}</strong> × {item.quantity}</p>{item.serviceNote ? <p className={styles.muted}>{item.serviceNote}</p> : null}{item.bridge ? <><span className={styles.status} data-tone={item.bridge.status === "succeeded" ? "good" : item.bridge.status === "failed" ? "bad" : "warn"}>{item.bridge.status}</span><ul className={styles.fields}>{Object.entries(item.bridge.input?.fields ?? {}).map(([key, value]) => <li key={key}>{key}: {value}</li>)}</ul>{["manual_required", "failed"].includes(item.bridge.status) ? <><label className={styles.field}><span>{copy.result}</span><textarea value={results[item.bridge.id] ?? ""} onChange={(event) => setResults((current) => ({ ...current, [item.bridge!.id]: event.target.value }))} maxLength={10000}/><small>{item.bridge.errorCode ?? " "}</small></label><div className={styles.actions}><button className={styles.button} type="button" disabled={!results[item.bridge.id]?.trim() || Boolean(busy)} onClick={() => void bridgeAction(item.bridge!.id, "complete")}>{copy.complete}</button>{retryable.has(item.bridge.id) ? <button className={styles.buttonQuiet} type="button" disabled={Boolean(busy)} onClick={() => void bridgeAction(item.bridge!.id, "retry")}>{copy.retry}</button> : null}</div></> : null}</> : null}</div>)}
      {audience === "seller" && !order.items.some((item) => item.productType === "bridge") ? <div className={styles.actions}>{order.status === "paid" ? <button className={styles.button} type="button" disabled={Boolean(busy)} onClick={() => void transition(order.id, "processing")}>{copy.process}</button> : null}{order.status === "processing" && order.items.every((item) => item.productType === "physical") ? <><input placeholder={copy.carrier} value={shipping[order.id]?.carrier ?? ""} onChange={(event) => setShipping((current) => ({ ...current, [order.id]: { carrier: event.target.value, trackingCode: current[order.id]?.trackingCode ?? "" } }))}/><input placeholder={copy.tracking} value={shipping[order.id]?.trackingCode ?? ""} onChange={(event) => setShipping((current) => ({ ...current, [order.id]: { carrier: current[order.id]?.carrier ?? "", trackingCode: event.target.value } }))}/><button className={styles.button} type="button" disabled={Boolean(busy) || (!shipping[order.id]?.carrier.trim() && !shipping[order.id]?.trackingCode.trim())} onClick={() => void ship(order.id)}>{copy.ship}</button>{amadastEnabled ? <button className={styles.buttonQuiet} type="button" disabled={Boolean(busy)} onClick={() => void amadast(order.id, order.amadastShipment && order.amadastShipment.status !== "failed" ? "sync" : "register")}>{order.amadastShipment && order.amadastShipment.status !== "failed" ? copy.amadastSync : copy.amadast}</button> : null}{order.amadastShipment?.errorCode ? <small>{order.amadastShipment.errorCode}</small> : null}</> : null}{order.status === "processing" && order.items.every((item) => item.productType !== "physical") ? <button className={styles.button} type="button" disabled={Boolean(busy)} onClick={() => void transition(order.id, "awaiting_confirmation")}>{copy.ready}</button> : null}</div> : null}</article>)}</div> : <p className={styles.empty}>{loading ? "…" : copy.empty}</p>}
    {nextCursor && !loading ? <button className={styles.buttonQuiet} type="button" onClick={() => void load(nextCursor)}>{copy.loadMore}</button> : null}{error ? <p className={styles.error} role="alert">{error}</p> : null}</section>;
}

export function SellerOrders({ locale }: { locale: Locale }) { return <OrdersWorkspace locale={locale} audience="seller" />; }
