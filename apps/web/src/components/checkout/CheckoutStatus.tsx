"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { CheckoutDetail, OrderStatus } from "@topgsm/shared-types";
import { DesignIcon } from "@/components/DesignIcon";
import { RelativeOrderTime } from "@/components/orders/RelativeOrderTime";
import { api } from "@/lib/api/client";
import { removePurchasedOffers } from "@/lib/cart";
import { currencyLabel, formatCurrencyAmount } from "@/lib/currency";
import { openDigitalDownload } from "@/lib/digital-download";
import type { Locale } from "@/lib/i18n";
import { safePaymentHref } from "@/lib/safe-navigation";
import styles from "./CheckoutStatus.module.css";

/* Hallmark · pre-emit critique: P5 H5 E4 S5 R5 V4 */
const COPY = {
  en: {
    title: "Payment status",
    paidTitle: "Payment received",
    pendingTitle: "Payment due",
    partialTitle: "Partially paid",
    expiredTitle: "Payment window closed",
    cancelledTitle: "Checkout cancelled",
    paidPhysicalHint: "Track shipping from your orders.",
    partialHint: "Pay the remainder to finish this checkout.",
    pendingReturn: "The payment result is not on this checkout yet. Refresh in a moment.",
    failedReturn: "The payment was not recorded. You can try again from this page.",
    canceledReturn: "You cancelled the payment. You can continue from this page.",
    loading: "Loading your checkout…",
    retry: "Try again",
    refresh: "Refresh",
    error: "We couldn't load your checkout. Check your connection and try again.",
    actionError: "This action could not be completed. Please try again.",
    emptyOrders: "This checkout has no orders.",
    orders: "Orders in this checkout",
    summary: "Payment summary",
    total: "Checkout total",
    paidAmount: "Paid",
    remaining: "Remaining",
    group: "Payment",
    pay: "Continue payment",
    paying: "Opening payment…",
    downloading: "Preparing download…",
    paid: "Paid",
    pending: "Payment required",
    failed: "Payment failed",
    expired: "Expired",
    cancelled: "Cancelled",
    pendingHint: "Complete the remaining payment to move your orders forward.",
    expiredHint: "This checkout can no longer accept payment.",
    cancelledHint: "This checkout was cancelled and can no longer be paid.",
    order: "Order",
    seller: "Seller",
    quantity: "Qty",
    serviceNote: "Your note",
    postalFee: "Postal delivery",
    download: "Get digital file",
    limit: "downloads used",
    confirm: "Confirm delivery",
    confirming: "Confirming…",
    external: "Opens a seller supplied link",
    shop: "Continue shopping",
    account: "Orders",
    created: "Created",
    statuses: { pending: "Awaiting payment", paid: "Paid", processing: "Processing", shipped: "Shipped", awaiting_confirmation: "Awaiting confirmation", delivered: "Delivered", cancelled: "Cancelled" },
    providers: { zarinpal: "Zarinpal", zibal: "Zibal", "local-country-gateway": "Local payment", manual: "Manual payment" }
  },
  fa: {
    title: "وضعیت پرداخت",
    paidTitle: "پرداخت شد",
    pendingTitle: "پرداخت باقی مانده",
    partialTitle: "بخشی پرداخت شده",
    expiredTitle: "مهلت پرداخت تمام شد",
    cancelledTitle: "خرید لغو شد",
    paidPhysicalHint: "وضعیت ارسال را در سفارش‌ها ببینید.",
    partialHint: "باقی‌مانده را پرداخت کنید تا سفارش کامل شود.",
    pendingReturn: "نتیجه پرداخت هنوز روی این خرید ننشسته. کمی بعد تازه کنید.",
    failedReturn: "پرداخت ثبت نشد. از همین صفحه می‌توانید دوباره تلاش کنید.",
    canceledReturn: "پرداخت را لغو کردید. هر وقت خواستید از همین صفحه ادامه دهید.",
    loading: "در حال دریافت وضعیت خرید…",
    retry: "تلاش دوباره",
    refresh: "تازه‌سازی",
    error: "وضعیت خرید دریافت نشد. اتصال اینترنت را بررسی کنید و دوباره تلاش کنید.",
    actionError: "انجام این کار ممکن نبود. دوباره تلاش کنید.",
    emptyOrders: "سفارشی برای این خرید ثبت نشده.",
    orders: "سفارش‌های این خرید",
    summary: "خلاصه پرداخت",
    total: "مبلغ کل خرید",
    paidAmount: "پرداخت‌شده",
    remaining: "باقی‌مانده",
    group: "پرداخت",
    pay: "ادامه پرداخت",
    paying: "در حال باز کردن درگاه…",
    downloading: "در حال دریافت…",
    paid: "پرداخت‌شده",
    pending: "نیازمند پرداخت",
    failed: "پرداخت ناموفق",
    expired: "منقضی‌شده",
    cancelled: "لغوشده",
    pendingHint: "برای ادامه پردازش سفارش، پرداخت باقی‌مانده را تکمیل کنید.",
    expiredHint: "مهلت پرداخت این خرید به پایان رسیده است.",
    cancelledHint: "این خرید لغو شده و دیگر پرداخت نمی‌شود.",
    order: "سفارش",
    seller: "فروشنده",
    quantity: "تعداد",
    serviceNote: "توضیح شما",
    postalFee: "هزینه ارسال پستی",
    download: "دریافت فایل",
    limit: "بار استفاده از لینک",
    confirm: "تأیید دریافت",
    confirming: "در حال تأیید…",
    external: "لینک فروشنده باز می‌شود",
    shop: "ادامه خرید",
    account: "سفارش‌ها",
    created: "تاریخ ثبت",
    statuses: { pending: "در انتظار پرداخت", paid: "پرداخت‌شده", processing: "در حال پردازش", shipped: "ارسال‌شده", awaiting_confirmation: "در انتظار تأیید", delivered: "تحویل‌شده", cancelled: "لغوشده" },
    providers: { zarinpal: "زرین‌پال", zibal: "زیبال", "local-country-gateway": "پرداخت محلی", manual: "پرداخت دستی" }
  },
  ar: {
    title: "حالة الدفع",
    paidTitle: "تم الدفع",
    pendingTitle: "المبلغ متبقٍ",
    partialTitle: "مدفوع جزئيًا",
    expiredTitle: "انتهت مهلة الدفع",
    cancelledTitle: "أُلغي الشراء",
    paidPhysicalHint: "تابع الشحن من طلباتك.",
    partialHint: "ادفع المتبقي لإكمال هذا الشراء.",
    pendingReturn: "لم تُسجَّل نتيجة الدفع على هذا الشراء بعد. حدّث الصفحة بعد قليل.",
    failedReturn: "لم يُسجَّل الدفع. يمكنك المحاولة مرة أخرى من هذه الصفحة.",
    canceledReturn: "ألغيت الدفع. يمكنك المتابعة من هذه الصفحة متى شئت.",
    loading: "جارٍ تحميل حالة الشراء…",
    retry: "حاول مجددًا",
    refresh: "تحديث",
    error: "تعذر تحميل حالة الشراء. تحقق من اتصالك وحاول مجددًا.",
    actionError: "تعذر إتمام الإجراء. حاول مجددًا.",
    emptyOrders: "لا توجد طلبات في هذا الشراء.",
    orders: "طلبات هذا الشراء",
    summary: "ملخص الدفع",
    total: "إجمالي الشراء",
    paidAmount: "المدفوع",
    remaining: "المتبقي",
    group: "الدفع",
    pay: "متابعة الدفع",
    paying: "جارٍ فتح بوابة الدفع…",
    downloading: "جارٍ التجهيز…",
    paid: "مدفوع",
    pending: "يتطلب الدفع",
    failed: "فشل الدفع",
    expired: "منتهي الصلاحية",
    cancelled: "ملغى",
    pendingHint: "أكمل المبلغ المتبقي لمتابعة معالجة طلباتك.",
    expiredHint: "انتهت مهلة دفع هذا الشراء.",
    cancelledHint: "أُلغي هذا الشراء ولم يعد يقبل الدفع.",
    order: "الطلب",
    seller: "البائع",
    quantity: "الكمية",
    serviceNote: "ملاحظتك",
    postalFee: "تكلفة الشحن البريدي",
    download: "تنزيل الملف",
    limit: "مرات استخدام الرابط",
    confirm: "تأكيد الاستلام",
    confirming: "جارٍ التأكيد…",
    external: "يفتح رابط البائع",
    shop: "متابعة التسوق",
    account: "الطلبات",
    created: "تاريخ الإنشاء",
    statuses: { pending: "بانتظار الدفع", paid: "مدفوع", processing: "قيد المعالجة", shipped: "تم الشحن", awaiting_confirmation: "بانتظار التأكيد", delivered: "تم التسليم", cancelled: "ملغى" },
    providers: { zarinpal: "زرين بال", zibal: "زيبال", "local-country-gateway": "دفع محلي", manual: "دفع يدوي" }
  }
} as const;

type Copy = (typeof COPY)[Locale];
type ViewState = "paid" | "partial" | "pending" | "expired" | "cancelled";
type ReturnCode = "ok" | "failed" | "canceled";

function money(value: string, currency: CheckoutDetail["currency"], locale: Locale) {
  return <><bdi>{formatCurrencyAmount(value, currency, locale)}</bdi> <small>{currencyLabel(currency)}</small></>;
}

function viewState(status: CheckoutDetail["status"]): ViewState {
  if (status === "paid") return "paid";
  if (status === "partially_paid") return "partial";
  if (status === "expired") return "expired";
  if (status === "cancelled") return "cancelled";
  return "pending";
}

function returnCode(value: string): ReturnCode | null {
  if (value === "paid" || value === "succeeded") return "ok";
  if (value === "failed") return "failed";
  if (value === "canceled" || value === "cancelled") return "canceled";
  return null;
}

function headline(state: ViewState, copy: Copy) {
  if (state === "paid") return copy.paidTitle;
  if (state === "partial") return copy.partialTitle;
  if (state === "expired") return copy.expiredTitle;
  if (state === "cancelled") return copy.cancelledTitle;
  return copy.pendingTitle;
}

function hintFor(checkout: CheckoutDetail, state: ViewState, copy: Copy) {
  if (state === "paid") {
    const items = checkout.orders.flatMap((order) => order.items);
    const downloadable = items.some((item) => (item.digitalDeliveries ?? (item.digitalDelivery ? [item.digitalDelivery] : [])).length > 0);
    const physical = items.some((item) => item.productType === "physical");
    return physical && !downloadable ? copy.paidPhysicalHint : "";
  }
  if (state === "partial") return copy.partialHint;
  if (state === "expired") return copy.expiredHint;
  if (state === "cancelled") return copy.cancelledHint;
  return copy.pendingHint;
}

function returnNote(code: ReturnCode | null, state: ViewState, copy: Copy) {
  if (!code || state === "paid") return "";
  if (code === "ok") return state === "pending" ? copy.pendingReturn : "";
  if (code === "canceled") return copy.canceledReturn;
  return copy.failedReturn;
}

export function CheckoutStatus({ locale, checkoutId, paymentReturn = "" }: { locale: Locale; checkoutId: string; paymentReturn?: string }) {
  const c = COPY[locale];
  const discountLabel = locale === "fa" ? "تخفیف" : locale === "ar" ? "الخصم" : "Discount";
  const walletLabel = locale === "fa" ? "پرداخت از کیف پول" : locale === "ar" ? "الدفع من المحفظة" : "Pay from wallet";
  const walletBalanceLabel = locale === "fa" ? "موجودی" : locale === "ar" ? "الرصيد" : "Balance";
  const [checkout, setCheckout] = useState<CheckoutDetail | null>(null);
  const [busy, setBusy] = useState("");
  const [walletBalance, setWalletBalance] = useState("0");
  const [walletAmounts, setWalletAmounts] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      const response = await api.get<CheckoutDetail>(`/checkouts/${checkoutId}`);
      setCheckout(response.data);
      void api.get<{ balance: string }>("/wallet").then((account) => setWalletBalance(account.data.balance)).catch(() => setWalletBalance("0"));
      setError("");
      const paidOrderIds = new Set(response.data.paymentGroups.filter((group) => group.status === "paid").flatMap((group) => group.orderIds));
      removePurchasedOffers(response.data.orders.filter((order) => paidOrderIds.has(order.id)).flatMap((order) => order.items.map((item) => item.offerId)));
    } catch { setError(c.error); }
  }, [c.error, checkoutId]);
  useEffect(() => { const frame = requestAnimationFrame(() => void load()); return () => cancelAnimationFrame(frame); }, [load]);

  async function pay(groupId: string) {
    setBusy(groupId); setError("");
    try {
      const group = checkout?.paymentGroups.find((item) => item.id === groupId);
      if (!group) throw new Error("Payment group disappeared");
      const walletAmount = group.walletAmount !== "0" ? group.walletAmount : walletAmounts[groupId] || "0";
      if (!/^(?:0|[1-9]\d{0,15})$/.test(walletAmount) || (group.provider !== "wallet" && (BigInt(walletAmount) >= BigInt(group.amount) || BigInt(walletAmount) > BigInt(walletBalance)))) throw new Error("Invalid wallet contribution");
      const response = await api.post<{ paymentUrl?: string }>(`/checkouts/${checkoutId}/payment-groups/${groupId}/initiate`, { walletAmount }, { headers: { "Idempotency-Key": crypto.randomUUID() } });
      if (response.data.paymentUrl) {
        const destination = safePaymentHref(response.data.paymentUrl, locale);
        if (!destination) throw new Error("Payment provider returned an invalid redirect URL");
        window.location.assign(destination);
      }
      else { await load(); setBusy(""); }
    } catch { setError(c.actionError); setBusy(""); }
  }

  async function confirm(orderId: string) {
    setBusy(orderId); setError("");
    try { await api.patch(`/orders/purchases/${orderId}/status`, { status: "delivered" }, { headers: { "Idempotency-Key": crypto.randomUUID() } }); await load(); }
    catch { setError(c.actionError); } finally { setBusy(""); }
  }

  async function download(path: string) {
    setBusy(path); setError("");
    try { await openDigitalDownload(path); await load(); }
    catch { setError(c.actionError); }
    finally { setBusy(""); }
  }

  const state = checkout ? viewState(checkout.status) : null;
  const closed = state === "expired" || state === "cancelled";
  const paidTotal = checkout?.paymentGroups.filter((group) => group.status === "paid").reduce((sum, group) => sum + BigInt(group.amount), 0n) ?? 0n;
  const remaining = checkout ? BigInt(checkout.totalAmount) - paidTotal : 0n;
  const number = new Intl.NumberFormat(locale);
  const statusLabel = (status: OrderStatus) => c.statuses[status];
  const providerLabel = (provider: string) => provider === "wallet" ? walletLabel : c.providers[provider as keyof typeof c.providers] ?? provider;
  const gateway = returnCode(paymentReturn);
  const note = checkout && state ? returnNote(gateway, state, c) : "";
  const hasDownload = checkout?.orders.some((order) => order.items.some((item) => (item.digitalDeliveries ?? (item.digitalDelivery ? [item.digitalDelivery] : [])).length > 0)) ?? false;
  const needsPayment = Boolean(checkout && !closed && checkout.paymentGroups.some((group) => group.status === "pending"));
  const shortRef = checkoutId.slice(0, 8);

  return <main className={styles.page} data-state={state ?? "loading"} dir={locale === "en" ? "ltr" : "rtl"}>
    <div className={styles.shell}>
      {!checkout && !error ? <div className={styles.loading} role="status" aria-live="polite"><span className="sr-only">{c.loading}</span><div className={styles.skelHead} /><div className={styles.skelLayout}><div className={styles.skelOrders} /><div className={styles.skelRail} /></div></div> : null}
      {!checkout && error ? <div className={styles.missing}><h1>{c.title}</h1><div className={styles.error} role="alert"><span>{error}</span><button type="button" onClick={() => void load()}>{c.retry}</button></div></div> : null}
      {checkout && state ? <>
        <header className={styles.head}>
          <div className={styles.headCopy}>
            <h1><span className={styles.mark}><DesignIcon name={state === "paid" ? "check" : "bag"} /></span>{headline(state, c)}</h1>
            {hintFor(checkout, state, c) ? <p>{hintFor(checkout, state, c)}</p> : null}
            <div className={styles.meta}>
              <span>{c.order} <bdi>#{shortRef}</bdi><span className="sr-only"> {checkoutId}</span></span>
              <span>{c.created} <RelativeOrderTime value={checkout.createdAt} locale={locale} showExact /></span>
            </div>
          </div>
          <div className={styles.headActions}>
            <Link className={state === "paid" && !hasDownload ? styles.primary : styles.navLink} href={`/${locale}/account/orders`}>{c.account}</Link>
            <Link className={styles.quietLink} href={`/${locale}/products`}>{c.shop}</Link>
          </div>
        </header>
        {note ? <div className={styles.note} data-tone={gateway === "ok" ? "neutral" : "error"} role={gateway === "ok" ? "status" : "alert"}><span>{note}</span>{gateway === "ok" ? <button type="button" onClick={() => void load()}>{c.refresh}</button> : null}</div> : null}
        {error ? <div className={styles.error} role="alert"><span>{error}</span><button type="button" onClick={() => void load()}>{c.retry}</button></div> : null}
        <div className={styles.layout}>
          <section className={styles.orderSection} aria-labelledby="checkout-orders">
            <div className={styles.sectionHead}><h2 id="checkout-orders">{c.orders}</h2><span className={styles.count}>{number.format(checkout.orders.length)}</span></div>
            {checkout.orders.length === 0 ? <p className={styles.empty}>{c.emptyOrders}</p> : <div className={styles.orderList}>{checkout.orders.map((order) => {
              const canConfirm = order.items.every((item) => item.productType !== "digital") && (order.status === "shipped" || order.status === "awaiting_confirmation");
              return <article className={styles.orderCard} key={order.id}>
                <div className={styles.orderTop}><div><span className={styles.sellerLabel}>{c.seller}</span><h3>{order.seller.shopName}</h3></div><span className={styles.orderStatus} data-status={order.status}>{statusLabel(order.status)}</span></div>
                <div className={styles.orderItems}>{order.items.map((item) => {
                  const files = item.digitalDeliveries ?? (item.digitalDelivery ? [item.digitalDelivery] : []);
                  return <div className={styles.product} key={item.id}>
                    <span className={styles.productIcon}><DesignIcon name={item.productType === "digital" ? "file" : "bag"} /></span>
                    <div className={styles.productDetails}>
                      <strong>{item.productTitle}</strong>
                      <span>{c.quantity} {number.format(item.quantity)}</span>
                      {item.serviceNote ? <span className={styles.serviceNote}><b>{c.serviceNote}</b> {item.serviceNote}</span> : null}
                    </div>
                    <strong className={styles.productAmount}>{money(item.totalAmount, checkout.currency, locale)}</strong>
                    {files.length ? <div className={styles.deliveries}>{files.map((file, index) => <div className={styles.delivery} key={file.downloadUrl}>
                      <button type="button" className={needsPayment ? styles.download : styles.downloadPrimary} disabled={busy === file.downloadUrl} onClick={() => void download(file.downloadUrl)}>
                        <DesignIcon name="arrow" /> {busy === file.downloadUrl ? c.downloading : <>{c.download}{files.length > 1 ? ` ${number.format(index + 1)}` : null}</>}
                      </button>
                      <small>{file.destinationHost} · {number.format(file.downloadCount)}/{file.maxDownloads ? number.format(file.maxDownloads) : "∞"} {c.limit} · {c.external}</small>
                    </div>)}</div> : null}
                  </div>;
                })}</div>
                {order.shippingFee !== "0" ? <div className={styles.postalLine}><span>{c.postalFee}</span><strong>{money(order.shippingFee, checkout.currency, locale)}</strong></div> : null}
                <div className={styles.orderBottom}>
                  <span>{c.order} <bdi>#{order.id.slice(0, 8)}</bdi><span className="sr-only"> {order.id}</span></span>
                  {order.discountAmount !== "0" ? <span>{discountLabel}: −{money(order.discountAmount, checkout.currency, locale)}</span> : null}
                  <strong>{money(order.totalAmount, checkout.currency, locale)}</strong>
                  {canConfirm ? <button className={styles.confirm} type="button" disabled={busy === order.id} onClick={() => void confirm(order.id)}>{busy === order.id ? c.confirming : c.confirm}</button> : null}
                </div>
              </article>;
            })}</div>}
          </section>
          <aside className={styles.summary} aria-labelledby="payment-summary">
            <h2 id="payment-summary">{c.summary}</h2>
            <div className={styles.totalBlock}><span>{state === "paid" ? c.paidAmount : c.total}</span><strong>{money(state === "paid" ? paidTotal.toString() : checkout.totalAmount, checkout.currency, locale)}</strong></div>
            {checkout.couponCode && checkout.discountAmount !== "0" || state !== "paid" || remaining > 0n ? <dl className={styles.totals}>
              {checkout.couponCode && checkout.discountAmount !== "0" ? <div><dt>{discountLabel} ({checkout.couponCode})</dt><dd>−{money(checkout.discountAmount, checkout.currency, locale)}</dd></div> : null}
              {state === "paid" ? null : <div><dt>{c.paidAmount}</dt><dd>{money(paidTotal.toString(), checkout.currency, locale)}</dd></div>}
              {state === "paid" && remaining <= 0n ? null : <div><dt>{c.remaining}</dt><dd>{money((remaining > 0n ? remaining : 0n).toString(), checkout.currency, locale)}</dd></div>}
            </dl> : null}
            <div className={styles.groupList}>{checkout.paymentGroups.map((group, index) => {
              const canPay = group.status === "pending" && !closed;
              const showWallet = canPay && group.provider !== "wallet" && BigInt(walletBalance) > 0n;
              const statusText = group.status === "paid" ? c.paid : group.status === "failed" ? c.failed : group.status === "expired" ? c.expired : c.pending;
              return <div className={styles.group} key={group.id}>
                <div className={styles.groupHeading}>
                  <span>{checkout.paymentGroups.length > 1 ? `${c.group} ${number.format(index + 1)} · ` : null}{providerLabel(group.provider)} <span className={styles.groupStatus} data-status={group.status}>{statusText}</span></span>
                  <strong className={styles.groupAmount}>{money(group.amount, group.currency, locale)}</strong>
                </div>
                {showWallet ? <label className={styles.walletContribution}><span>{walletLabel} · {walletBalanceLabel}: {money(walletBalance, "TOMAN", locale)}</span><input type="text" inputMode="numeric" pattern="[0-9]+" value={group.walletAmount !== "0" ? group.walletAmount : walletAmounts[group.id] ?? ""} disabled={group.walletAmount !== "0" || busy === group.id} onChange={(event) => setWalletAmounts((current) => ({ ...current, [group.id]: event.target.value }))} /></label> : null}
                {canPay ? <button className={styles.primary} type="button" disabled={busy === group.id} onClick={() => void pay(group.id)}>{busy === group.id ? c.paying : c.pay}<DesignIcon name="arrow" /></button> : null}
              </div>;
            })}</div>
          </aside>
        </div>
      </> : null}
    </div>
  </main>;
}
