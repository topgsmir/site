"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { CheckoutDetail } from "@topgsm/shared-types";
import { API_BASE, api } from "@/lib/api/client";
import { removePurchasedOffers } from "@/lib/cart";
import { currencyLabel, formatCurrencyAmount } from "@/lib/currency";
import type { Locale } from "@/lib/i18n";
import styles from "./Checkout.module.css";

const COPY = {
  en: { title: "Checkout status", back: "Continue shopping", paid: "Paid", pending: "Payment required", continue: "Continue payment", orders: "Orders", download: "Download from", limit: "redirects used", confirm: "Confirm delivery", error: "Checkout could not be loaded.", complete: "All payment groups are complete." },
  fa: { title: "وضعیت پرداخت", back: "ادامه خرید", paid: "پرداخت‌شده", pending: "نیازمند پرداخت", continue: "ادامه پرداخت", orders: "سفارش‌ها", download: "دریافت فایل از", limit: "بار استفاده از لینک", confirm: "تأیید دریافت", error: "بارگذاری وضعیت خرید ممکن نبود.", complete: "همه پرداخت‌ها کامل شده‌اند." },
  ar: { title: "حالة الدفع", back: "متابعة التسوق", paid: "مدفوع", pending: "الدفع مطلوب", continue: "متابعة الدفع", orders: "الطلبات", download: "تنزيل من", limit: "مرات استخدام الرابط", confirm: "تأكيد الاستلام", error: "تعذر تحميل حالة الشراء.", complete: "اكتملت جميع مجموعات الدفع." }
} as const;

export function CheckoutStatus({ locale, checkoutId }: { locale: Locale; checkoutId: string }) {
  const c = COPY[locale];
  const [checkout, setCheckout] = useState<CheckoutDetail | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      const response = await api.get<CheckoutDetail>(`/checkouts/${checkoutId}`);
      setCheckout(response.data);
      const paidOrderIds = new Set(response.data.paymentGroups.filter((group) => group.status === "paid").flatMap((group) => group.orderIds));
      removePurchasedOffers(response.data.orders.filter((order) => paidOrderIds.has(order.id)).flatMap((order) => order.items.map((item) => item.offerId)));
    } catch { setError(c.error); }
  }, [c.error, checkoutId]);
  useEffect(() => { const frame = requestAnimationFrame(() => void load()); return () => cancelAnimationFrame(frame); }, [load]);

  async function pay(groupId: string) {
    setBusy(groupId); setError("");
    try {
      const response = await api.post<{ paymentUrl?: string }>(`/checkouts/${checkoutId}/payment-groups/${groupId}/initiate`, {}, { headers: { "Idempotency-Key": crypto.randomUUID() } });
      if (response.data.paymentUrl) window.location.assign(response.data.paymentUrl); else await load();
    } catch { setError(c.error); setBusy(""); }
  }

  async function confirm(orderId: string) {
    setBusy(orderId);
    try { await api.patch(`/orders/${orderId}/status`, { status: "delivered" }, { headers: { "Idempotency-Key": crypto.randomUUID() } }); await load(); }
    catch { setError(c.error); } finally { setBusy(""); }
  }

  return <main className={styles.page} dir={locale === "en" ? "ltr" : "rtl"}><header className={styles.header}><Link href={`/${locale}`}>topgsm.</Link><div><h1>{c.title}</h1><p>#{checkoutId}</p></div></header>{error ? <p className={styles.error} role="alert">{error}</p> : null}{checkout ? <div className={styles.layout}><section className={styles.items}><h2>{c.orders}</h2>{checkout.orders.map((order) => <article className={styles.item} key={order.id}><div><p>{order.seller.shopName}</p><h2>{order.items.map((item) => item.productTitle).join(" · ")}</h2><strong>{formatCurrencyAmount(order.totalAmount, checkout.currency, locale)} {currencyLabel(checkout.currency)}</strong><p>{order.status}</p>{order.items.map((item) => <div key={item.id}>{item.digitalDelivery ? <a href={`${API_BASE}${item.digitalDelivery.downloadUrl}`} target="_blank" rel="noopener noreferrer">{c.download} {item.digitalDelivery.destinationHost} · {item.digitalDelivery.downloadCount}/{item.digitalDelivery.maxDownloads || "∞"} {c.limit}</a> : null}</div>)}</div>{(order.status === "shipped" || (order.status === "awaiting_confirmation") || (order.status === "paid" && order.items.every((item) => item.productType === "digital"))) ? <button type="button" disabled={busy === order.id} onClick={() => void confirm(order.id)}>{c.confirm}</button> : null}</article>)}</section><aside className={styles.summary}><h2>{formatCurrencyAmount(checkout.totalAmount, checkout.currency, locale)} {currencyLabel(checkout.currency)}</h2>{checkout.paymentGroups.map((group) => <div key={group.id}><p>{group.provider} · {formatCurrencyAmount(group.amount, group.currency, locale)} {currencyLabel(group.currency)}</p><strong>{group.status === "paid" ? c.paid : c.pending}</strong>{group.status === "pending" ? <button className={styles.primary} disabled={busy === group.id} onClick={() => void pay(group.id)}>{c.continue}</button> : null}</div>)}{checkout.status === "paid" ? <p>{c.complete}</p> : null}<Link href={`/${locale}/products`}>{c.back}</Link></aside></div> : null}</main>;
}
