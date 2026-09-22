"use client";

import Link from "next/link";
import type { Route } from "next";
import { isAxiosError } from "axios";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api/client";
import { getSocket } from "@/lib/sockets/socket";
import { CustomerOrderChat } from "./CustomerOrderChat";
import type { Locale } from "@/lib/i18n";
import { AccountIcon } from "@/components/account/AccountIcon";
import { canConfirmOrder, type BuyerOrder } from "./OrderDetails.types";
import { ORDER_COPY, statusLabel } from "./OrderDetailsCopy";
import { Confirmation, CopyValue, Money, OrderDate, OrderProgress, PurchasedItem, ShippingDetails, StatusBadge } from "./OrderDetailsParts";
import s from "./OrderDetails.module.css";

export function BuyerOrderDetails({ locale, orderId }: { locale: Locale; orderId: string }) {
  // Route changes must discard old order data and all pending action state.
  return <OrderDetails key={`${locale}:${orderId}`} locale={locale} orderId={orderId} />;
}

function OrderDetails({ locale, orderId }: { locale: Locale; orderId: string }) {
  const c = ORDER_COPY[locale];
  const [order, setOrder] = useState<BuyerOrder | null>(null);
  const [error, setError] = useState<"load" | "unavailable" | "refresh" | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [action, setAction] = useState<"cancelled" | "delivered" | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [message, setMessage] = useState("");
  const request = useRef<AbortController | null>(null);
  const current = useRef<BuyerOrder | null>(null);
  const mounted = useRef(true);
  const mutationLock = useRef(false);
  const mutationKey = useRef<string | null>(null);

  const load = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    setRefreshing(true);
    try {
      const response = await api.get<BuyerOrder>(`/orders/${orderId}`, { signal: controller.signal });
      if (controller.signal.aborted || !mounted.current) return;
      current.current = response.data; setOrder(response.data); setError(null);
    } catch (cause) {
      if (controller.signal.aborted || !mounted.current) return;
      const denied = isAxiosError(cause) && [401, 403, 404].includes(cause.response?.status ?? 0);
      if (denied) { current.current = null; setOrder(null); }
      setError(denied ? "unavailable" : current.current ? "refresh" : "load");
    } finally {
      if (!controller.signal.aborted && mounted.current) { request.current = null; setRefreshing(false); }
    }
  }, [orderId]);

  useEffect(() => {
    mounted.current = true;
    const frame = requestAnimationFrame(() => void load());
    const socket = getSocket();
    const update = (payload: { orderId?: string }) => { if (payload.orderId === orderId) void load(); };
    const visibleRefresh = () => { if (document.visibilityState === "visible" && !request.current) void load(); };
    socket.on("order.status.updated", update); socket.on("connect", visibleRefresh);
    const timer = window.setInterval(visibleRefresh, 15_000);
    window.addEventListener("focus", visibleRefresh);
    document.addEventListener("visibilitychange", visibleRefresh);
    return () => {
      mounted.current = false; cancelAnimationFrame(frame); request.current?.abort();
      socket.off("order.status.updated", update); socket.off("connect", visibleRefresh);
      clearInterval(timer); window.removeEventListener("focus", visibleRefresh); document.removeEventListener("visibilitychange", visibleRefresh);
    };
  }, [load, orderId]);

  async function transition() {
    if (!action || mutationLock.current) return;
    mutationLock.current = true; setBusy(true); setActionError("");
    mutationKey.current ??= crypto.randomUUID();
    try {
      await api.patch(`/orders/${orderId}/status`, { status: action }, { headers: { "Idempotency-Key": mutationKey.current } });
      if (!mounted.current) return;
      setAction(null); setMessage(c.updated); mutationKey.current = null;
      await load();
    } catch {
      if (mounted.current) setActionError(c.actionError);
    } finally { mutationLock.current = false; if (mounted.current) setBusy(false); }
  }
  function chooseAction(value: "cancelled" | "delivered") { mutationKey.current = null; setActionError(""); setMessage(""); setAction(value); }

  const errorText = error === "unavailable" ? c.unavailable : error === "refresh" ? c.refreshError : c.error;
  const payment = order?.status === "pending" ? c.pending : order?.status === "cancelled" ? c.cancelledPayment : order?.status === "refunded" ? statusLabel(c, "refunded") : order && ["paid", "processing", "shipped", "awaiting_confirmation", "delivered"].includes(order.status) ? c.paid : c.unknown;

  return <div className={s.shell} dir={locale === "en" ? "ltr" : "rtl"}>
    <nav className={s.navigation} aria-label={c.back}><Link href={`/${locale}/account/orders` as Route}><AccountIcon name="arrow" width={18} height={18} />{c.back}</Link><span>TOP<span className={s.brandAccent}>GSM</span></span></nav>
    <header className={s.header}><div><p className={s.eyebrow}>{c.eyebrow}</p><h1>{order?.items[0]?.productTitle ?? c.order}{order && order.items.length > 1 ? <span className={s.extra}> +{(order.items.length - 1).toLocaleString(locale)}</span> : null}</h1>{order ? <div className={s.metadata}><span>{c.number}: <CopyValue value={order.id} label={c.number} c={c} /></span><span>{c.created}: <OrderDate value={order.createdAt} locale={locale} /></span></div> : null}</div>{order ? <button type="button" className={s.secondary} disabled={refreshing} onClick={() => void load()}>{refreshing ? c.refreshing : c.refresh}</button> : null}</header>
    <main>
      {error ? <div className={s.errorBanner} role="alert"><p>{errorText}</p><button type="button" className={s.secondary} onClick={() => void load()} disabled={refreshing}>{c.retry}</button></div> : null}
      {!order && !error ? <div className={s.skeleton} role="status" aria-label={c.loading}><div /><div /><div /></div> : null}
      {order ? <>
        <section className={s.seller} aria-labelledby="order-seller-heading">
          <div className={s.sellerIdentity}><span className={s.eyebrow}>{c.seller}</span><h2 id="order-seller-heading"><bdi>{order.seller.shopName}</bdi></h2></div>
          <CustomerOrderChat orderId={order.id} available={order.chatAvailable} c={c} />
        </section>
        <OrderProgress order={order} locale={locale} c={c} />
        <div className={s.layout}><div className={s.content}>
          <div className={s.sectionHeading}><h2>{c.items} <span className={s.count}>{order.items.length.toLocaleString(locale)}</span></h2></div>
          {order.items.map((item) => <PurchasedItem key={item.id} item={item} order={order} locale={locale} c={c} refresh={load} />)}
          {!order.items.length ? <p className={s.panel}>{c.empty}</p> : null}
          {order.items.some((item) => item.productType === "physical") || order.shippingAddress || order.shipment ? <ShippingDetails order={order} locale={locale} c={c} /> : null}
        </div><aside className={s.sidebar}>
          <section className={s.summary}><h2>{c.summary}</h2><div className={s.total}><span>{c.total}</span><strong><Money amount={order.totalAmount} currency={order.currency} locale={locale} /></strong></div><dl className={s.fields}><div><dt>{c.payment}</dt><dd>{payment}</dd></div><div><dt>{c.progress}</dt><dd><StatusBadge status={order.status} c={c} /></dd></div></dl>
            <div className={s.sidebarActions}>
              {order.status === "pending" && order.checkoutId ? <Link className={s.primary} href={`/${locale}/checkout/${order.checkoutId}` as Route}>{c.continuePayment}<AccountIcon name="arrow" width={18} height={18} /></Link> : null}
              {canConfirmOrder(order) ? <button type="button" className={s.primary} onClick={() => chooseAction("delivered")} disabled={busy}>{c.confirm}<AccountIcon name="check" width={18} height={18} /></button> : null}
              {order.status === "pending" && order.items.length > 0 ? <button type="button" className={s.quiet} onClick={() => chooseAction("cancelled")} disabled={busy}>{c.cancel}</button> : null}
            </div>{message ? <p className={s.success} role="status">{message}</p> : null}
          </section>
          <p className={s.updated}>{c.latest}<br /><OrderDate value={order.updatedAt} locale={locale} /></p>
        </aside></div>
      </> : null}
    </main>
    {action ? <Confirmation action={action} busy={busy} error={actionError} c={c} onClose={() => setAction(null)} onConfirm={() => void transition()} /> : null}
  </div>;
}
