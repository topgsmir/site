"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api/client";
import { currencyLabel, formatCurrencyAmount } from "@/lib/currency";
import type { Locale } from "@/lib/i18n";
import styles from "./LocalGateway.module.css";

type LocalPayment = { status: string; amount: string; currency: string; orderId: string; checkoutId: string | null };

const COPY = {
  en: { title: "Local test gateway", description: "Choose a test result for this payment. No money will be charged.", paid: "Mark as paid", canceled: "Cancel payment", pending: "Awaiting test result", done: "This payment has already been completed.", error: "Could not load or update this payment.", busy: "Processing…", back: "Back to checkout" },
  fa: { title: "درگاه آزمایشی محلی", description: "نتیجه آزمایشی این پرداخت را انتخاب کنید. مبلغی دریافت نمی‌شود.", paid: "ثبت پرداخت موفق", canceled: "لغو پرداخت", pending: "در انتظار نتیجه آزمایشی", done: "نتیجه این پرداخت قبلاً ثبت شده است.", error: "بارگذاری یا ثبت نتیجه پرداخت ممکن نبود.", busy: "در حال پردازش…", back: "بازگشت به خرید" },
  ar: { title: "بوابة الدفع المحلية التجريبية", description: "اختر نتيجة تجريبية لهذا الدفع. لن يتم تحصيل أي مبلغ.", paid: "تحديد كمدفوع", canceled: "إلغاء الدفع", pending: "بانتظار النتيجة التجريبية", done: "تم تسجيل نتيجة هذا الدفع سابقًا.", error: "تعذر تحميل الدفع أو تحديثه.", busy: "جارٍ المعالجة…", back: "العودة إلى الشراء" }
} as const;

export function LocalGateway({ locale, authority }: { locale: Locale; authority: string }) {
  const c = COPY[locale];
  const [payment, setPayment] = useState<LocalPayment | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      const response = await api.get<LocalPayment>(`/payments/local/${encodeURIComponent(authority)}`);
      setPayment(response.data);
    } catch { setError(c.error); }
  }, [authority, c.error]);
  useEffect(() => { const frame = requestAnimationFrame(() => void load()); return () => cancelAnimationFrame(frame); }, [load]);

  async function complete(status: "paid" | "canceled") {
    if (!payment || busy) return;
    setBusy(true); setError("");
    try {
      await api.post(`/payments/local/${encodeURIComponent(authority)}/complete`, { status });
      window.location.assign(payment.checkoutId ? `/${locale}/checkout/${payment.checkoutId}?payment=${status}` : `/${locale}/orders/${payment.orderId}?payment=${status}`);
    } catch { setError(c.error); await load(); setBusy(false); }
  }

  return <main className={styles.page} dir={locale === "en" ? "ltr" : "rtl"}><section className={styles.panel}>
    <span className={styles.badge}>TEST</span><h1>{c.title}</h1><p>{c.description}</p>
    {error ? <p className={styles.error} role="alert">{error}</p> : null}
    {payment ? <><strong className={styles.amount}>{formatCurrencyAmount(payment.amount, payment.currency, locale)} {currencyLabel(payment.currency)}</strong>
      <p>{payment.status === "pending" ? c.pending : c.done}</p>
      {payment.status === "pending" ? <div className={styles.actions}><button type="button" disabled={busy} onClick={() => void complete("paid")}>{busy ? c.busy : c.paid}</button><button type="button" disabled={busy} onClick={() => void complete("canceled")}>{c.canceled}</button></div> : null}
      {payment.checkoutId ? <Link href={`/${locale}/checkout/${payment.checkoutId}`}>{c.back}</Link> : <Link href={`/${locale}/orders/${payment.orderId}`}>{c.back}</Link>}
    </> : null}
  </section></main>;
}
