"use client";

import { scheduleEffectTask } from "@/lib/effect-task";
import type { Route } from "next";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api/client";
import { currencyLabel, formatCurrencyAmount } from "@/lib/currency";
import type { Locale } from "@/lib/i18n";
import { RelativeOrderTime } from "@/components/orders/RelativeOrderTime";
import { orderFieldLabel, orderValueDirection, orderValueLabel, paymentProviderLabel } from "./AdminOrderDetailsCopy";
import styles from "./AdminOrderDetails.module.css";

type Details = Record<string, unknown>;
const copy = {
  en: { back: "All orders", title: "Order details", refresh: "Refresh", loading: "Loading order details…", error: "Order details could not be loaded.", retry: "Try again", missing: "No records", overview: "Order record", buyer: "Buyer", seller: "Seller", items: "Order items", shippingAddress: "Delivery address", shipment: "Shipment", shippingDispatch: "Provider shipment", itemOperations: "Fulfillment and inventory", payments: "Payment attempts and refunds", payouts: "Payout ledger", checkout: "Checkout", paymentGroups: "Payment groups", history: "Status history", outbox: "Event delivery", total: "Order total", placed: "Placed", units: "Units", yes: "Yes", no: "No" },
  fa: { back: "همه سفارش‌ها", title: "جزئیات سفارش", refresh: "تازه‌سازی", loading: "در حال بارگذاری جزئیات سفارش…", error: "بارگذاری جزئیات سفارش انجام نشد.", retry: "تلاش دوباره", missing: "رکوردی ثبت نشده", overview: "اطلاعات سفارش", buyer: "خریدار", seller: "فروشنده", items: "اقلام سفارش", shippingAddress: "نشانی تحویل", shipment: "اطلاعات ارسال", shippingDispatch: "ارسال سرویس حمل", itemOperations: "پردازش و موجودی", payments: "پرداخت‌ها و بازپرداخت‌ها", payouts: "دفتر تسویه", checkout: "تسویه‌حساب", paymentGroups: "گروه‌های پرداخت", history: "تاریخچه وضعیت", outbox: "ارسال رویدادها", total: "مبلغ سفارش", placed: "تاریخ ثبت", units: "تعداد", yes: "بله", no: "خیر" },
  ar: { back: "كل الطلبات", title: "تفاصيل الطلب", refresh: "تحديث", loading: "جارٍ تحميل تفاصيل الطلب…", error: "تعذر تحميل تفاصيل الطلب.", retry: "حاول مجدداً", missing: "لا توجد سجلات", overview: "بيانات الطلب", buyer: "المشتري", seller: "البائع", items: "عناصر الطلب", shippingAddress: "عنوان التسليم", shipment: "بيانات الشحن", shippingDispatch: "شحنة مزود الخدمة", itemOperations: "التنفيذ والمخزون", payments: "المدفوعات والمبالغ المستردة", payouts: "سجل المستحقات", checkout: "إتمام الشراء", paymentGroups: "مجموعات الدفع", history: "سجل الحالات", outbox: "تسليم الأحداث", total: "إجمالي الطلب", placed: "تاريخ الطلب", units: "الوحدات", yes: "نعم", no: "لا" }
} as const;

const paymentCopy = {
  en: { by: "Paid via", reference: "Bank reference", complete: "Mark completed", confirm: "Mark this order completed? This records your action and makes the order eligible for payout.", saving: "Completing…", done: "Order marked completed.", error: "Could not complete the order. Refresh and try again." },
  fa: { by: "پرداخت توسط", reference: "کد پیگیری بانک", complete: "تبدیل به تکمیل‌شده", confirm: "این سفارش تکمیل‌شده ثبت شود؟ این تغییر در تاریخچه ثبت می‌شود و سفارش را برای تسویه واجد شرایط می‌کند.", saving: "در حال تکمیل…", done: "سفارش تکمیل‌شده ثبت شد.", error: "تکمیل سفارش انجام نشد. تازه‌سازی و دوباره تلاش کنید." },
  ar: { by: "دُفع عبر", reference: "مرجع البنك", complete: "وضع علامة مكتمل", confirm: "هل تريد إكمال هذا الطلب؟ يُسجل الإجراء في السجل ويجعل الطلب مؤهلاً للدفع.", saving: "جارٍ الإكمال…", done: "اكتمل الطلب.", error: "تعذر إكمال الطلب. حدّث الصفحة وحاول مجدداً." }
} as const;

const actionCopy = {
  en: { change: "Change status", select: "Choose status", trash: "Move to trash", restore: "Restore order", confirm: "Confirm this order change? The actor and time will be recorded.", unpaid: "This order has no verified payment. Completing it will not make it eligible for payout. Continue?", busy: "Saving…", done: "Order updated.", error: "Order update failed. Refresh and try again." },
  fa: { change: "تغییر وضعیت", select: "انتخاب وضعیت", trash: "انتقال به زباله‌دان", restore: "بازگردانی سفارش", confirm: "این تغییر سفارش تأیید می‌شود؟ عامل و زمان عملیات ثبت خواهد شد.", unpaid: "این سفارش پرداخت تأییدشده ندارد. تکمیل آن را واجد شرایط تسویه نمی‌کند. ادامه می‌دهید؟", busy: "در حال ذخیره…", done: "سفارش به‌روزرسانی شد.", error: "به‌روزرسانی سفارش انجام نشد. تازه‌سازی و دوباره تلاش کنید." },
  ar: { change: "تغيير الحالة", select: "اختر الحالة", trash: "نقل إلى المهملات", restore: "استعادة الطلب", confirm: "تأكيد تغيير الطلب؟ سيُسجل المنفذ والوقت.", unpaid: "لا توجد دفعة مؤكدة لهذا الطلب. إكماله لن يجعله مؤهلاً للصرف. متابعة؟", busy: "جارٍ الحفظ…", done: "تم تحديث الطلب.", error: "تعذر تحديث الطلب. حدّث الصفحة وحاول مجدداً." }
} as const;

const downloadCopy = {
  en: { total: "Total downloads", unlimited: "Unlimited" },
  fa: { total: "مجموع دانلودها", unlimited: "نامحدود" },
  ar: { total: "إجمالي التنزيلات", unlimited: "غير محدود" }
} as const;

const sections = [
  { key: "buyerProfile", label: "buyer" },
  { key: "sellerProfile", label: "seller" },
  { key: "items", label: "items" },
  { key: "shippingAddress", label: "shippingAddress" },
  { key: "shipment", label: "shipment" },
  { key: "shippingDispatch", label: "shippingDispatch" },
  { key: "itemOperations", label: "itemOperations" },
  { key: "payments", label: "payments" },
  { key: "payouts", label: "payouts" },
  { key: "checkout", label: "checkout" },
  { key: "paymentGroups", label: "paymentGroups" },
  { key: "history", label: "history" },
  { key: "outbox", label: "outbox" }
] as const;
const separated = new Set<string>(sections.map((section) => section.key));
const mainFields = new Set(["id", "status", "trashedAt", "allowedStatusTransitions", "totalAmount", "currency", "createdAt", "items", "buyer", "seller", "buyerProfile", "sellerProfile"]);
const itemFields = new Set(["productId", "productTitle", "productType", "quantity", "unitPrice", "totalAmount"]);
const moneyField = /(?:amount|price|fee|cost|revenue|balance|holdback|commission|refund|discount|subtotal|shippingCost)$/i;

export function AdminOrderDetails({ locale, orderId }: { locale: Locale; orderId: string }) {
  const c = copy[locale];
  const [details, setDetails] = useState<Details | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [actionError, setActionError] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [completedOrder, setCompletedOrder] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState("");
  const completionKey = useRef<string | null>(null);
  const [section, setSection] = useState<"items" | "people" | "delivery" | "finance" | "activity">("items");
  const load = useCallback(async () => {
    setLoading(true); setError(false);
    try { setDetails((await api.get<Details>(`/orders/admin/${orderId}`)).data); }
    catch { setError(true); }
    finally { setLoading(false); }
  }, [orderId]);
  useEffect(() => scheduleEffectTask(() => { void load(); }), [load]);

  const items = Array.isArray(details?.items) ? details.items : [];
  const units = items.reduce((sum, item) => sum + (isRecord(item) && typeof item.quantity === "number" ? item.quantity : 0), 0);
  const currency = typeof details?.currency === "string" ? details.currency : "";
  const total = typeof details?.totalAmount === "string" ? details.totalAmount : "";
  const overview = details ? Object.fromEntries(Object.entries(details).filter(([key]) => !separated.has(key) && !mainFields.has(key))) : null;
  const buyer = isRecord(details?.buyerProfile) ? details.buyerProfile : null;
  const seller = isRecord(details?.sellerProfile) ? details.sellerProfile : null;
  const checkout = isRecord(details?.checkout) ? details.checkout : null;
  const verifiedPayment = (Array.isArray(details?.payments) ? details.payments : []).find((entry) => isRecord(entry) && typeof entry.verifiedAt === "string" && typeof entry.provider === "string") as Record<string, unknown> | undefined;
  const transitions = Array.isArray(details?.allowedStatusTransitions) ? details.allowedStatusTransitions.filter((value): value is string => typeof value === "string") : [];
  const trashed = typeof details?.trashedAt === "string";

  async function changeOrder(action: "status" | "trash") {
    if (action === "status" && !selectedStatus) return;
    if (!window.confirm(action === "status" && selectedStatus === "delivered" ? verifiedPayment ? paymentCopy[locale].confirm : actionCopy[locale].unpaid : actionCopy[locale].confirm)) return;
    const markingCompleted = action === "status" && selectedStatus === "delivered";
    setCompleting(true); setActionError(false); setCompleted(false);
    completionKey.current ??= crypto.randomUUID();
    try {
      if (action === "status") await api.patch(`/orders/${orderId}/status`, { status: selectedStatus, confirmSensitive: true }, { headers: { "Idempotency-Key": completionKey.current } });
      else await api.patch(`/orders/admin/${orderId}/trash`, { trashed: !trashed, confirm: true }, { headers: { "Idempotency-Key": completionKey.current } });
      completionKey.current = null;
      setSelectedStatus("");
      setCompletedOrder(markingCompleted);
      setCompleted(true);
      await load();
    } catch { completionKey.current = null; setActionError(true); }
    finally { setCompleting(false); }
  }

  return <section className={styles.workspace} aria-labelledby="admin-order-title" dir={locale === "en" ? "ltr" : "rtl"}>
    <div className={styles.toolbar}><Link href={`/${locale}/admin/orders` as Route} className={styles.back}><span aria-hidden="true">{locale === "en" ? "←" : "→"}</span> {c.back}</Link><div className={styles.toolbarActions}>{transitions.length ? <><label className={styles.statusPicker}><span>{actionCopy[locale].change}</span><select value={selectedStatus} onChange={(event) => { setSelectedStatus(event.target.value); completionKey.current = null; }} disabled={completing || loading}><option value="">{actionCopy[locale].select}</option>{transitions.map((value) => <option key={value} value={value}>{orderValueLabel("status", value, locale)}</option>)}</select></label><button type="button" className={styles.completeButton} onClick={() => void changeOrder("status")} disabled={!selectedStatus || completing || loading}>{completing ? selectedStatus === "delivered" ? paymentCopy[locale].saving : actionCopy[locale].busy : selectedStatus === "delivered" ? paymentCopy[locale].complete : actionCopy[locale].change}</button></> : null}{details && (trashed || details.status === "delivered" || details.status === "cancelled") ? <button type="button" onClick={() => void changeOrder("trash")} disabled={completing || loading}>{trashed ? actionCopy[locale].restore : actionCopy[locale].trash}</button> : null}<button type="button" onClick={() => void load()} disabled={loading || completing}>{c.refresh}</button></div></div>
    {actionError ? <p className={styles.actionError} role="alert">{actionCopy[locale].error}</p> : null}
    {completed ? <p className={styles.actionSuccess} role="status">{completedOrder ? paymentCopy[locale].done : actionCopy[locale].done}</p> : null}
    {error ? <div className={styles.notice} role="alert">{c.error} {details ? locale === "fa" ? "اطلاعات آخرین بارگذاری نمایش داده می‌شود." : locale === "ar" ? "تُعرض آخر معلومات تم تحميلها." : "Showing the last loaded information." : null} <button type="button" onClick={() => void load()}>{c.retry}</button></div> : null}
    {loading && !details ? <p className={styles.notice} role="status">{c.loading}</p> : null}
    {details ? <>
      <div className={styles.orderCard}><header className={styles.header} aria-busy={loading}><div><p className={styles.kicker}>{c.title}</p><h1 id="admin-order-title">{locale === "fa" ? "سفارش ثبت‌شده" : locale === "ar" ? "الطلب المسجل" : "Order overview"}</h1></div><span className={styles.status} data-status={String(details.status ?? "")}>{orderValueLabel("status", String(details.status ?? "—"), locale)}</span></header>
      <div className={styles.summary} id="overview"><div className={styles.primaryMetric}><span>{c.total}</span><strong><bdi dir="auto">{total ? `${formatCurrencyAmount(total, currency, locale)} ${currencyLabel(currency)}` : "—"}</bdi></strong></div><div><span>{c.placed}</span><strong>{typeof details.createdAt === "string" ? <RelativeOrderTime value={details.createdAt} locale={locale} showExact /> : "—"}</strong></div><div><span>{c.units}</span><strong>{units.toLocaleString(locale)}</strong></div><div><span>{locale === "fa" ? "وضعیت پرداخت" : locale === "ar" ? "حالة الدفع" : "Payment"}</span><strong>{checkout ? orderValueLabel("status", String(checkout.status ?? "—"), locale) : "—"}</strong>{verifiedPayment ? <small className={styles.paymentSummary}>{paymentCopy[locale].by} {paymentProviderLabel(String(verifiedPayment.provider), locale)}{typeof verifiedPayment.bankReference === "string" ? <><br />{paymentCopy[locale].reference}: <bdi dir="ltr">{verifiedPayment.bankReference}</bdi></> : null}</small> : null}</div></div></div>
      <section className={styles.detailArea} aria-label={locale === "fa" ? "سوابق سفارش" : locale === "ar" ? "سجلات الطلب" : "Order records"}>
        <div className={styles.detailHeading}><div><h2>{locale === "fa" ? "سوابق سفارش" : locale === "ar" ? "سجلات الطلب" : "Order records"}</h2><p>{section === "items" ? c.items : section === "people" ? (locale === "en" ? "People" : locale === "fa" ? "افراد" : "الأشخاص") : section === "delivery" ? c.shipment : section === "finance" ? c.payments : c.history}</p></div></div>
        <div className={styles.detailLayout}>
          <nav className={styles.sectionNav} aria-label={locale === "fa" ? "بخش‌های سفارش" : locale === "ar" ? "أقسام الطلب" : "Order sections"}>
            {(["items", "people", "delivery", "finance", "activity"] as const).map((key) => <button key={key} type="button" aria-pressed={section === key} onClick={() => setSection(key)}>{key === "items" ? c.items : key === "people" ? (locale === "en" ? "People" : locale === "fa" ? "افراد" : "الأشخاص") : key === "delivery" ? (locale === "en" ? "Delivery" : locale === "fa" ? "تحویل و ارسال" : "التسليم والشحن") : key === "finance" ? (locale === "en" ? "Payment and settlement" : locale === "fa" ? "پرداخت و تسویه" : "الدفع والتسوية") : (locale === "en" ? "Activity" : locale === "fa" ? "فعالیت‌ها" : "النشاط")}</button>)}
          </nav>
          <div className={styles.mobileCategory}><label htmlFor="order-detail-category">{locale === "fa" ? "بخش سفارش" : locale === "ar" ? "قسم الطلب" : "Order section"}</label><select id="order-detail-category" value={section} onChange={(event) => setSection(event.target.value as typeof section)}><option value="items">{c.items}</option><option value="people">{locale === "fa" ? "افراد" : locale === "ar" ? "الأشخاص" : "People"}</option><option value="delivery">{locale === "fa" ? "تحویل و ارسال" : locale === "ar" ? "التسليم والشحن" : "Delivery"}</option><option value="finance">{locale === "fa" ? "پرداخت و تسویه" : locale === "ar" ? "الدفع والتسوية" : "Payment and settlement"}</option><option value="activity">{locale === "fa" ? "فعالیت‌ها" : locale === "ar" ? "النشاط" : "Activity"}</option></select></div>
          <div className={styles.detailContent}>
            {section === "items" ? <section className={styles.section}><div className={styles.sectionHead}><h2>{c.items}</h2><span>{items.length.toLocaleString(locale)}</span></div>{items.length ? <div className={styles.recordList}>{items.map((item, index) => <OrderItem key={isRecord(item) && typeof item.id === "string" ? item.id : index} value={item} index={index} currency={currency} locale={locale} />)}</div> : <p className={styles.empty}>{c.missing}</p>}</section> : null}
            {section === "people" ? <section className={styles.section}><div className={styles.sectionHead}><h2>{locale === "fa" ? "افراد" : locale === "ar" ? "الأشخاص" : "People"}</h2></div><Person title={c.buyer} value={buyer} locale={locale} /><Person title={c.seller} value={seller} locale={locale} /></section> : null}
            {section === "delivery" ? <div className={styles.recordList}><RecordSection title={c.shippingAddress} value={details.shippingAddress} locale={locale} empty={c.missing} /><RecordSection title={c.shipment} value={details.shipment} locale={locale} empty={c.missing} />{details.shippingDispatch ? <RecordSection title={c.shippingDispatch} value={details.shippingDispatch} locale={locale} empty={c.missing} /> : null}</div> : null}
            {section === "finance" ? <div className={styles.recordList}>{(["payments", "payouts", "checkout", "paymentGroups"] as const).map((key) => <RecordSection key={key} title={c[key]} value={details[key]} locale={locale} empty={c.missing} currency={currency} />)}</div> : null}
            {section === "activity" ? <div className={styles.recordList}>{(["history", "itemOperations", "outbox"] as const).map((key) => <RecordSection key={key} title={c[key]} value={details[key]} locale={locale} empty={c.missing} />)}<details className={styles.metadata}><summary>{c.overview}<span className={styles.disclosureHint}>{locale === "fa" ? "شناسه‌ها و داده‌های فنی" : locale === "ar" ? "المعرفات والبيانات التقنية" : "IDs and technical data"}</span></summary><Fields value={{ id: orderId, ...(overview ?? {}) }} locale={locale} /></details></div> : null}
          </div>
        </div>
      </section>
    </> : null}
  </section>;
}

function isRecord(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
const previewKeys = ["action", "recipientName", "city", "status", "toStatus", "amount", "totalAmount", "payableAmount", "provider", "carrier", "trackingCode", "service", "type", "at", "createdAt"];
function preview(value: unknown, locale: Locale, currency?: string): string {
  if (Array.isArray(value)) {
    if (!value.length) return copy[locale].missing;
    const count = `${value.length.toLocaleString(locale)} ${locale === "fa" ? "مورد" : locale === "ar" ? "سجلات" : "records"}`;
    const first = preview(value[0], locale, currency);
    return first === copy[locale].missing ? count : `${count} · ${first}`;
  }
  if (!isRecord(value)) return copy[locale].missing;
  const parts = previewKeys.flatMap((key) => {
    const field = value[key];
    if (field === null || field === undefined || field === "" || typeof field === "object") return [];
    if (typeof field === "string" && /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(field)) return [];
    return [`${orderFieldLabel(key, locale)}: ${display(key, field, locale, typeof value.currency === "string" ? value.currency : currency)}`];
  });
  const payment = isRecord(value.payment) ? value.payment : null;
  const paymentDetail = payment && typeof payment.provider === "string" ? `${paymentCopy[locale].by} ${paymentProviderLabel(payment.provider, locale)}${typeof payment.reference === "string" ? ` · ${paymentCopy[locale].reference}: ${payment.reference}` : ""}` : "";
  return [parts.slice(0, 2).join(" · "), paymentDetail].filter(Boolean).join(" · ") || copy[locale].missing;
}
function display(key: string, value: unknown, locale: Locale, currency?: string): string {
  if (value === null || value === undefined || value === "") return "—";
  if (key === "currency" && typeof value === "string") return currencyLabel(value);
  if (typeof value === "boolean") return value ? copy[locale].yes : copy[locale].no;
  if (moneyField.test(key) && (typeof value === "number" || typeof value === "string") && /^-?\d+(?:\.\d+)?$/.test(String(value))) {
    return currency ? `${formatCurrencyAmount(value, currency, locale)} ${currencyLabel(currency)}` : new Intl.NumberFormat(locale, { maximumFractionDigits: 4 }).format(Number(value));
  }
  if (typeof value === "number") return value.toLocaleString(locale);
  if (typeof value === "string" && /^\d{4}-\d\d-\d\dT\d\d:\d\d/.test(value)) return new Date(value).toLocaleString(locale);
  return typeof value === "string" ? orderValueLabel(key, value, locale) : String(value);
}
function Person({ title, value, locale }: { title: string; value: Record<string, unknown> | null; locale: Locale }) {
  const name = typeof value?.fullName === "string" ? value.fullName : typeof value?.shopName === "string" ? value.shopName : "—";
  const secondary = typeof value?.email === "string" ? value.email : isRecord(value?.owner) && typeof value.owner.fullName === "string" ? value.owner.fullName : null;
  return <details className={styles.disclosure}><summary className={styles.disclosureSummary}><span className={styles.disclosureMain}><span className={styles.personRole}>{title}</span><strong>{name}</strong>{secondary ? <span className={styles.personSecondary}><bdi dir="auto">{secondary}</bdi></span> : null}</span><span className={styles.disclosureAction}>{locale === "fa" ? "جزئیات" : locale === "ar" ? "التفاصيل" : "Details"}</span></summary>{value ? <div className={styles.disclosureBody}><Fields value={value} locale={locale} /></div> : null}</details>;
}
function OrderItem({ value, index, currency, locale }: { value: unknown; index: number; currency: string; locale: Locale }) {
  if (!isRecord(value)) return <div className={styles.record}><Fields value={value} locale={locale} /></div>;
  const title = typeof value.productTitle === "string" ? value.productTitle : "—";
  const productId = typeof value.productId === "string" ? value.productId : null;
  const amount = typeof value.totalAmount === "string" ? value.totalAmount : "";
  const unitPrice = typeof value.unitPrice === "string" ? value.unitPrice : "";
  const files = Array.isArray(value.digitalDeliveries)
    ? value.digitalDeliveries.filter(isRecord)
    : isRecord(value.digitalDelivery) ? [value.digitalDelivery] : [];
  const downloadCount = files.length ? files.reduce((total, file) => total + (typeof file.downloadCount === "number" ? file.downloadCount : 0), 0) : null;
  const digitalDeliveries = files.map((file) => {
    const maximum = typeof file.maxDownloads === "number" ? file.maxDownloads : null;
    const used = typeof file.downloadCount === "number" ? file.downloadCount : null;
    return { ...file,
      ...(maximum !== null ? { maxDownloads: maximum > 0 ? maximum : downloadCopy[locale].unlimited } : {}),
      ...(maximum !== null && used !== null ? { remainingDownloads: maximum > 0 ? Math.max(0, maximum - used) : downloadCopy[locale].unlimited } : {}) };
  });
  const rest = Object.fromEntries(Object.entries(value).filter(([key]) => !itemFields.has(key) && key !== "digitalDelivery" && key !== "digitalDeliveries"));
  return <details className={styles.disclosure}><summary className={styles.disclosureSummary}><span className={styles.disclosureMain}><span className={styles.itemIndex}>{locale === "fa" ? "قلم" : locale === "ar" ? "عنصر" : "Item"} {(index + 1).toLocaleString(locale)}</span><strong>{productId ? <Link className={styles.productLink} href={`/${locale}/admin/products/${productId}` as Route} onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>{title}</Link> : title}</strong><span className={styles.personSecondary}>{orderFieldLabel("quantity", locale)}: {display("quantity", value.quantity, locale)} · {orderValueLabel("productType", String(value.productType ?? "—"), locale)}{downloadCount !== null ? ` · ${files.length > 1 ? downloadCopy[locale].total : orderFieldLabel("downloadCount", locale)}: ${downloadCount.toLocaleString(locale)}` : ""}</span></span><span className={styles.disclosureSide}><strong><bdi dir="auto">{amount ? `${formatCurrencyAmount(amount, currency, locale)} ${currencyLabel(currency)}` : "—"}</bdi></strong><span className={styles.disclosureAction}>{locale === "fa" ? "جزئیات" : locale === "ar" ? "التفاصيل" : "Details"}</span></span></summary><div className={styles.disclosureBody}><Fields value={{ productTitle: title, productType: value.productType, quantity: value.quantity, unitPrice, totalAmount: amount, ...(files.length ? { digitalDeliveries } : {}), ...rest }} locale={locale} currency={currency} /></div></details>;
}
function RecordSection({ title, value, locale, empty, currency }: { title: string; value: unknown; locale: Locale; empty: string; currency?: string }) {
  const records = Array.isArray(value) ? value : [value];
  const hasRecords = records.some((record) => record !== null && record !== undefined);
  return <details className={styles.disclosure}><summary className={styles.disclosureSummary}><span className={styles.disclosureMain}><strong>{title}</strong><span className={styles.recordPreview}>{hasRecords ? preview(value, locale, currency) : empty}</span></span><span className={styles.disclosureAction}>{locale === "fa" ? "جزئیات" : locale === "ar" ? "التفاصيل" : "Details"}</span></summary>{hasRecords ? <div className={styles.disclosureBody}>{Array.isArray(value) ? <div className={styles.recordList}>{records.map((record, index) => <div className={styles.record} key={isRecord(record) && typeof record.id === "string" ? record.id : index}><h3>{title} {(index + 1).toLocaleString(locale)}</h3><Fields value={record} locale={locale} currency={currency} /></div>)}</div> : <Fields value={value} locale={locale} currency={currency} />}</div> : null}</details>;
}
function Fields({ value, locale, currency }: { value: unknown; locale: Locale; currency?: string }) {
  if (!isRecord(value)) return <p className={styles.scalar}>{display("", value, locale, currency)}</p>;
  const recordCurrency = typeof value.currency === "string" ? value.currency : currency;
  return <dl className={styles.fields}>{Object.entries(value).map(([key, field]) => <div className={styles.field} key={key}><dt>{orderFieldLabel(key, locale)}</dt><dd>{isRecord(field) ? <Fields value={field} locale={locale} currency={recordCurrency} /> : Array.isArray(field) ? field.length ? <div className={styles.nestedList}>{field.map((nested, index) => <div className={styles.nested} key={isRecord(nested) && typeof nested.id === "string" ? nested.id : index}><span className={styles.nestedIndex}>{(index + 1).toLocaleString(locale)}</span><Fields value={nested} locale={locale} currency={recordCurrency} /></div>)}</div> : "—" : <bdi dir={orderValueDirection(key, field)}>{display(key, field, locale, recordCurrency)}</bdi>}</dd></div>)}</dl>;
}
