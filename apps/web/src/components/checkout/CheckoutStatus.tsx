"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { CheckoutDetail, OrderStatus } from "@topgsm/shared-types";
import { DesignIcon } from "@/components/DesignIcon";
import { API_BASE, api } from "@/lib/api/client";
import { removePurchasedOffers } from "@/lib/cart";
import { currencyLabel, formatCurrencyAmount } from "@/lib/currency";
import type { Locale } from "@/lib/i18n";
import styles from "./CheckoutStatus.module.css";

/* Hallmark · pre-emit critique: P4 H5 E4 S5 R5 V4 */
const COPY = {
  en: { title: "Your payment status", breadcrumb: "Checkout / Payment", loading: "Loading your checkout…", retry: "Try again", error: "We couldn't load your checkout. Check your connection and try again.", actionError: "This action could not be completed. Please try again.", orders: "Orders in this checkout", ordersHint: "Products and delivery details from each seller", summary: "Payment summary", total: "Checkout total", paidAmount: "Paid", remaining: "Remaining", payment: "Payment", group: "Payment group", pay: "Continue payment", paying: "Opening payment…", paid: "Paid", pending: "Payment required", failed: "Payment failed", expired: "Expired", cancelled: "Cancelled", partial: "Partially paid", complete: "All payments are complete", completeHint: "Follow your orders and access available deliveries below.", pendingHint: "Complete the remaining payment to move your orders forward.", expiredHint: "This checkout can no longer accept payment.", order: "Order", seller: "Seller", quantity: "Qty", download: "Get digital file", limit: "downloads used", confirm: "Confirm delivery", confirming: "Confirming…", external: "Opens a seller supplied link", shop: "Continue shopping", account: "View all orders", created: "Created", provider: "Provider", statuses: { pending: "Awaiting payment", paid: "Paid", processing: "Processing", shipped: "Shipped", awaiting_confirmation: "Awaiting confirmation", delivered: "Delivered", cancelled: "Cancelled" }, providers: { zarinpal: "Zarinpal", "local-country-gateway": "Local payment", manual: "Manual payment" } },
  fa: { title: "وضعیت پرداخت شما", breadcrumb: "خرید / پرداخت", loading: "در حال دریافت وضعیت خرید…", retry: "تلاش دوباره", error: "وضعیت خرید دریافت نشد. اتصال اینترنت را بررسی کنید و دوباره تلاش کنید.", actionError: "انجام این کار ممکن نبود. دوباره تلاش کنید.", orders: "سفارش‌های این خرید", ordersHint: "محصولات و جزئیات تحویل هر فروشنده", summary: "خلاصه پرداخت", total: "مبلغ کل خرید", paidAmount: "پرداخت‌شده", remaining: "باقی‌مانده", payment: "پرداخت", group: "گروه پرداخت", pay: "ادامه پرداخت", paying: "در حال باز کردن درگاه…", paid: "پرداخت‌شده", pending: "نیازمند پرداخت", failed: "پرداخت ناموفق", expired: "منقضی‌شده", cancelled: "لغوشده", partial: "بخشی پرداخت شده", complete: "همه پرداخت‌ها انجام شده‌اند", completeHint: "می‌توانید سفارش‌ها و فایل‌های آماده را در همین صفحه پیگیری کنید.", pendingHint: "برای ادامه پردازش سفارش، پرداخت باقی‌مانده را تکمیل کنید.", expiredHint: "مهلت پرداخت این خرید به پایان رسیده است.", order: "سفارش", seller: "فروشنده", quantity: "تعداد", download: "دریافت فایل دیجیتال", limit: "بار استفاده از لینک", confirm: "تأیید دریافت", confirming: "در حال تأیید…", external: "لینک ارائه‌شده توسط فروشنده باز می‌شود", shop: "ادامه خرید", account: "مشاهده همه سفارش‌ها", created: "تاریخ ثبت", provider: "درگاه", statuses: { pending: "در انتظار پرداخت", paid: "پرداخت‌شده", processing: "در حال پردازش", shipped: "ارسال‌شده", awaiting_confirmation: "در انتظار تأیید", delivered: "تحویل‌شده", cancelled: "لغوشده" }, providers: { zarinpal: "زرین‌پال", "local-country-gateway": "پرداخت محلی", manual: "پرداخت دستی" } },
  ar: { title: "حالة الدفع", breadcrumb: "الشراء / الدفع", loading: "جارٍ تحميل حالة الشراء…", retry: "حاول مجددًا", error: "تعذر تحميل حالة الشراء. تحقق من اتصالك وحاول مجددًا.", actionError: "تعذر إتمام الإجراء. حاول مجددًا.", orders: "طلبات هذا الشراء", ordersHint: "المنتجات وتفاصيل التسليم من كل بائع", summary: "ملخص الدفع", total: "إجمالي الشراء", paidAmount: "المدفوع", remaining: "المتبقي", payment: "الدفع", group: "مجموعة الدفع", pay: "متابعة الدفع", paying: "جارٍ فتح بوابة الدفع…", paid: "مدفوع", pending: "يتطلب الدفع", failed: "فشل الدفع", expired: "منتهي الصلاحية", cancelled: "ملغى", partial: "مدفوع جزئيًا", complete: "اكتملت جميع المدفوعات", completeHint: "يمكنك متابعة طلباتك والملفات المتاحة هنا.", pendingHint: "أكمل المبلغ المتبقي لمتابعة معالجة طلباتك.", expiredHint: "انتهت مهلة دفع هذا الشراء.", order: "الطلب", seller: "البائع", quantity: "الكمية", download: "تنزيل الملف الرقمي", limit: "مرات استخدام الرابط", confirm: "تأكيد الاستلام", confirming: "جارٍ التأكيد…", external: "يفتح رابطًا يقدمه البائع", shop: "متابعة التسوق", account: "عرض جميع الطلبات", created: "تاريخ الإنشاء", provider: "بوابة الدفع", statuses: { pending: "بانتظار الدفع", paid: "مدفوع", processing: "قيد المعالجة", shipped: "تم الشحن", awaiting_confirmation: "بانتظار التأكيد", delivered: "تم التسليم", cancelled: "ملغى" }, providers: { zarinpal: "زرين بال", "local-country-gateway": "دفع محلي", manual: "دفع يدوي" } }
} as const;

function money(value: string, currency: CheckoutDetail["currency"], locale: Locale) {
  return <><bdi>{formatCurrencyAmount(value, currency, locale)}</bdi> <small>{currencyLabel(currency)}</small></>;
}

export function CheckoutStatus({ locale, checkoutId }: { locale: Locale; checkoutId: string }) {
  const c = COPY[locale];
  const [checkout, setCheckout] = useState<CheckoutDetail | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      const response = await api.get<CheckoutDetail>(`/checkouts/${checkoutId}`);
      setCheckout(response.data);
      setError("");
      const paidOrderIds = new Set(response.data.paymentGroups.filter((group) => group.status === "paid").flatMap((group) => group.orderIds));
      removePurchasedOffers(response.data.orders.filter((order) => paidOrderIds.has(order.id)).flatMap((order) => order.items.map((item) => item.offerId)));
    } catch { setError(c.error); }
  }, [c.error, checkoutId]);
  useEffect(() => { const frame = requestAnimationFrame(() => void load()); return () => cancelAnimationFrame(frame); }, [load]);

  async function pay(groupId: string) {
    setBusy(groupId); setError("");
    try {
      const response = await api.post<{ paymentUrl?: string }>(`/checkouts/${checkoutId}/payment-groups/${groupId}/initiate`, {}, { headers: { "Idempotency-Key": crypto.randomUUID() } });
      if (response.data.paymentUrl) window.location.assign(response.data.paymentUrl.startsWith("/pay/local/") ? `/${locale}${response.data.paymentUrl}` : response.data.paymentUrl);
      else { await load(); setBusy(""); }
    } catch { setError(c.actionError); setBusy(""); }
  }

  async function confirm(orderId: string) {
    setBusy(orderId); setError("");
    try { await api.patch(`/orders/${orderId}/status`, { status: "delivered" }, { headers: { "Idempotency-Key": crypto.randomUUID() } }); await load(); }
    catch { setError(c.actionError); } finally { setBusy(""); }
  }

  const complete = checkout?.status === "paid";
  const closed = checkout?.status === "expired" || checkout?.status === "cancelled";
  const paidTotal = checkout?.paymentGroups.filter((group) => group.status === "paid").reduce((sum, group) => sum + BigInt(group.amount), 0n) ?? 0n;
  const remaining = checkout ? BigInt(checkout.totalAmount) - paidTotal : 0n;
  const number = new Intl.NumberFormat(locale);
  const date = checkout ? new Intl.DateTimeFormat(locale, { year: "numeric", month: "long", day: "numeric" }).format(new Date(checkout.createdAt)) : "";
  const statusLabel = (status: OrderStatus) => c.statuses[status];
  const providerLabel = (provider: string) => c.providers[provider as keyof typeof c.providers] ?? provider;

  return <main className={styles.page} dir={locale === "en" ? "ltr" : "rtl"}><div className={styles.shell}>
    <nav className={styles.topbar} aria-label={c.breadcrumb}><Link className={styles.brand} href={`/${locale}`}>topgsm<span>.</span></Link><Link className={styles.navLink} href={`/${locale}/account/orders`}>{c.account} <DesignIcon name="arrow" /></Link></nav>
    <header className={styles.hero}><div className={styles.heroCopy}><p className={styles.eyebrow}>{c.breadcrumb}</p><h1>{c.title}</h1><div className={styles.meta}><span>{c.order} <bdi>#{checkoutId}</bdi></span>{checkout ? <span>{c.created} <bdi>{date}</bdi></span> : null}</div></div>
      {checkout ? <div className={styles.heroState} data-state={complete ? "paid" : closed ? "closed" : "pending"}><span className={styles.stateIcon}><DesignIcon name={complete ? "check" : "bag"} /></span><div><strong>{complete ? c.complete : checkout.status === "partially_paid" ? c.partial : checkout.status === "expired" ? c.expired : checkout.status === "cancelled" ? c.cancelled : c.pending}</strong><p>{complete ? c.completeHint : closed ? c.expiredHint : c.pendingHint}</p></div></div> : null}
    </header>
    {error ? <div className={styles.error} role="alert"><span>{error}</span><button type="button" onClick={() => void load()}>{c.retry}</button></div> : null}
    {!checkout && !error ? <div className={styles.loading} role="status"><span className={styles.loader} />{c.loading}</div> : null}
    {checkout ? <div className={styles.layout}><section className={styles.orderSection} aria-labelledby="checkout-orders"><div className={styles.sectionHead}><div><p className={styles.sectionIndex}>01 / {c.orders}</p><h2 id="checkout-orders">{c.orders}</h2><p>{c.ordersHint}</p></div><span className={styles.count}>{number.format(checkout.orders.length)}</span></div>
      <div className={styles.orderList}>{checkout.orders.map((order) => {
        const canConfirm = order.items.every((item) => item.productType !== "digital") && (order.status === "shipped" || order.status === "awaiting_confirmation");
        return <article className={styles.orderCard} key={order.id}><div className={styles.orderTop}><div><span className={styles.sellerLabel}>{c.seller}</span><h3>{order.seller.shopName}</h3></div><span className={styles.orderStatus} data-status={order.status}>{statusLabel(order.status)}</span></div>
          <div className={styles.orderItems}>{order.items.map((item) => <div className={styles.product} key={item.id}><span className={styles.productIcon}><DesignIcon name={item.productType === "digital" ? "file" : "bag"} /></span><div className={styles.productDetails}><strong>{item.productTitle}</strong><span>{c.quantity} {number.format(item.quantity)}</span>{(item.digitalDeliveries ?? (item.digitalDelivery ? [item.digitalDelivery] : [])).map((file, index, files) => <div className={styles.delivery} key={file.downloadUrl}><a href={`${API_BASE}${file.downloadUrl}`} target="_blank" rel="noopener noreferrer"><DesignIcon name="arrow" /> {c.download} {files.length > 1 ? number.format(index + 1) : null}</a><small>{file.destinationHost} · {number.format(file.downloadCount)}/{file.maxDownloads ? number.format(file.maxDownloads) : "∞"} {c.limit}</small><small>{c.external}</small></div>)}</div><strong className={styles.productAmount}>{money(item.totalAmount, checkout.currency, locale)}</strong></div>)}</div>
          <div className={styles.orderBottom}><span>{c.order} <bdi>#{order.id.slice(0, 8)}</bdi></span><strong>{money(order.totalAmount, checkout.currency, locale)}</strong>{canConfirm ? <button type="button" disabled={busy === order.id} onClick={() => void confirm(order.id)}>{busy === order.id ? c.confirming : c.confirm}</button> : null}</div></article>;
      })}</div></section>
      <aside className={styles.summary} aria-labelledby="payment-summary"><p className={styles.sectionIndex}>02 / {c.payment}</p><h2 id="payment-summary">{c.summary}</h2><div className={styles.totalBlock}><span>{c.total}</span><strong>{money(checkout.totalAmount, checkout.currency, locale)}</strong></div><dl className={styles.totals}><div><dt>{c.paidAmount}</dt><dd>{money(paidTotal.toString(), checkout.currency, locale)}</dd></div><div><dt>{c.remaining}</dt><dd>{money((remaining > 0n ? remaining : 0n).toString(), checkout.currency, locale)}</dd></div></dl>
        <div className={styles.groupList}>{checkout.paymentGroups.map((group, index) => <div className={styles.group} key={group.id}><div className={styles.groupHeading}><span>{c.group} {number.format(index + 1)} <span aria-hidden="true">·</span> {providerLabel(group.provider)}</span><strong className={styles.groupAmount}>{money(group.amount, group.currency, locale)}</strong></div><div className={styles.groupDetails}><strong className={styles.groupStatus} data-status={group.status}>{group.status === "paid" ? c.paid : group.status === "failed" ? c.failed : group.status === "expired" ? c.expired : c.pending}</strong>{group.status === "pending" && !closed ? <button className={styles.primary} type="button" disabled={busy === group.id} onClick={() => void pay(group.id)}>{busy === group.id ? c.paying : c.pay}<DesignIcon name="arrow" /></button> : null}</div></div>)}</div>
        <div className={styles.summaryLinks}><Link href={`/${locale}/account/orders`}>{c.account}</Link><Link href={`/${locale}/products`}>{c.shop}</Link></div></aside>
    </div> : null}
  </div></main>;
}
