"use client";

import Link from "next/link";
import { OfferPicker } from "@/components/product/OfferPicker";
import { isAxiosError } from "axios";
import { createBridgeCheckoutAttempt } from "./bridge-checkout-attempt";
import { useRef, useState, type FormEvent } from "react";
import { api } from "@/lib/api/client";
import { captchaTokenFor } from "@/lib/security-captcha";
import { getTrafficSource } from "@/lib/traffic-source";
import { currencyLabel, formatCurrencyAmount, multiplyCurrencyAmount } from "@/lib/currency";
import type { Locale } from "@/lib/i18n";
import { safePaymentHref } from "@/lib/safe-navigation";
import styles from "./BridgeWorkspace.module.css";

export type StoreProduct = { id: string; slug: string; title: string; description: string | null; category: string | null; type: string; bridge?: { fields: Array<{ key: string; label: string; type: "text"|"textarea"|"number"|"select"; required: boolean; placeholder?: string; helpText?: string; minimumLength?: number; maximumLength?: number; options?: Array<{ value: string; label: string }> }>; minimumQuantity: number; maximumQuantity: number }; variants: Array<{ id: string; name: string | null; offers: Array<{ id: string; price: string; currency: string; seller: { shopName: string } }> }> };

const COPY = {
  en: { retry: "Retry payment", saved: "Your order is saved. Retry payment for this order; its details can no longer be changed here.", pending: "We could not confirm the order. Retry with the same details to safely recover it.", orders: "View orders", back: "TopGSM", service: "Secure service checkout", sold: "Sold by", variant: "Offer", qty: "Quantity", buyer: "Required information", buy: "Buy now", signin: "Verify your mobile", phone: "Iranian mobile number", fullName: "Name", code: "Six-digit code", send: "Send code", verify: "Verify and continue", sending: "Please wait…", total: "Total", protected: "Your inputs are encrypted and sent only for fulfilling this order.", error: "Checkout could not continue. Review the information and try again.", unavailable: "This product is currently unavailable." },
  fa: { retry: "تلاش دوباره برای پرداخت", saved: "سفارش شما ثبت شده است. پرداخت همین سفارش را دوباره امتحان کنید؛ اطلاعات آن در این صفحه قابل تغییر نیست.", pending: "ثبت سفارش تأیید نشد. با همان اطلاعات دوباره تلاش کنید تا وضعیت سفارش مشخص شود.", orders: "مشاهده سفارش‌ها", back: "تاپ جی‌اس‌ام", service: "خرید امن سرویس", sold: "فروشنده", variant: "پیشنهاد", qty: "تعداد", buyer: "اطلاعات مورد نیاز", buy: "خرید مستقیم", signin: "تأیید شماره موبایل", phone: "شماره موبایل ایران", fullName: "نام", code: "کد شش‌رقمی", send: "ارسال کد", verify: "تأیید و ادامه", sending: "کمی صبر کنید…", total: "مبلغ کل", protected: "اطلاعات شما رمزنگاری می‌شود و فقط برای انجام همین سفارش استفاده خواهد شد.", error: "ادامه پرداخت ممکن نبود. اطلاعات را بررسی و دوباره تلاش کنید.", unavailable: "این محصول اکنون قابل خرید نیست." },
  ar: { retry: "إعادة محاولة الدفع", saved: "تم حفظ طلبك. أعد محاولة الدفع للطلب نفسه؛ لا يمكن تعديل تفاصيله هنا.", pending: "تعذر تأكيد الطلب. أعد المحاولة بالمعلومات نفسها لاستعادة حالته بأمان.", orders: "عرض الطلبات", back: "TopGSM", service: "شراء خدمة آمن", sold: "البائع", variant: "العرض", qty: "الكمية", buyer: "المعلومات المطلوبة", buy: "اشتر الآن", signin: "تحقق من رقم الجوال", phone: "رقم جوال إيراني", fullName: "الاسم", code: "الرمز المكوّن من ستة أرقام", send: "إرسال الرمز", verify: "تحقق وتابع", sending: "يرجى الانتظار…", total: "الإجمالي", protected: "تُشفّر بياناتك ولا تُستخدم إلا لتنفيذ هذا الطلب.", error: "تعذر متابعة الدفع. راجع المعلومات وحاول مجدداً.", unavailable: "هذا المنتج غير متاح حالياً." }
} as const;

export function BridgeCheckout({ locale, product, signedInBuyer, embedded = false }: { locale: Locale; product: StoreProduct; signedInBuyer: boolean; embedded?: boolean }) {
  const c=COPY[locale]; const offers=product.variants.flatMap((variant)=>variant.offers.map((offer)=>({...offer,variantName:variant.name})));
  const [offerId,setOfferId]=useState(offers[0]?.id ?? ""); const [quantity,setQuantity]=useState(product.bridge?.minimumQuantity ?? 1); const [fields,setFields]=useState<Record<string,string>>({});
  const [otp,setOtp]=useState(signedInBuyer); const [challenge,setChallenge]=useState(""); const [phone,setPhone]=useState(""); const [busy,setBusy]=useState(false); const [error,setError]=useState("");
  const offer=offers.find((item)=>item.id===offerId); const total=offer ? formatCurrencyAmount(multiplyCurrencyAmount(offer.price, Number.isSafeInteger(quantity) && quantity > 0 ? quantity : 0), offer.currency, locale) : "—";
  const attempt = useRef<ReturnType<typeof createBridgeCheckoutAttempt> | null>(null);
  const submitting = useRef(false);
  const [locked, setLocked] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);

  async function placeOrder() {
    if (!offer) return;
    if (!attempt.current) {
      let orderOutcomeUncertain = false;
      attempt.current = createBridgeCheckoutAttempt({
        offerId: offer.id,
        quantity,
        trafficSource: getTrafficSource(),
        bridgeFields: Object.entries(fields).map(([key, value]) => ({ key, value })),
      }, {
        async createOrder(input, key) {
          try {
            const response = await api.post<{ id: string }>("/orders", input, { headers: { "Idempotency-Key": key } });
            setOrderId(response.data.id);
            return response.data;
          } catch (failure) {
            // The API transaction rejected this order. Let the buyer correct the form.
            // Timeouts, throttling, server errors and missing responses remain uncertain.
            const status = isAxiosError(failure) ? failure.response?.status : undefined;
            const rejected = status !== undefined && [400, 401, 403, 404, 409, 422].includes(status);
            // A later rejection cannot rule out an earlier committed, lost response.
            if (!rejected) orderOutcomeUncertain = true;
            if (rejected && !orderOutcomeUncertain) {
              attempt.current = null;
              setLocked(false);
            }
            throw failure;
          }
        },
        async initiatePayment(id, key) {
          const response = await api.post<{ paymentUrl: string }>("/payments/zarinpal", { orderId: id }, { headers: { "Idempotency-Key": key } });
          return response.data;
        },
      });
      setLocked(true);
    }
    const payment = await attempt.current.pay();
    const destination = safePaymentHref(payment.paymentUrl, locale);
    if (!destination) throw new Error("Payment provider returned an invalid redirect URL");
    window.location.assign(destination);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      if (!otp) {
        const form = new FormData(event.currentTarget);
        if (!challenge) {
          const captchaToken = await captchaTokenFor("otp");
          const result = await api.post<{ challengeId: string }>("/auth/otp/request", { phoneNumber: phone, ...(captchaToken ? { captchaToken } : {}) });
          setChallenge(result.data.challengeId);
          setBusy(false);
          return;
        }
        const fullName = String(form.get("fullName") ?? "").trim();
        await api.post("/auth/otp/verify", { phoneNumber: phone, challengeId: challenge, code: form.get("code"), ...(fullName ? { fullName } : {}) });
        setOtp(true);
      }
      await placeOrder();
    } catch {
      setError(c.error);
      setBusy(false);
    } finally {
      submitting.current = false;
    }
  }
  if(!product.bridge || !offer) return <div className={styles.shell}><p className={styles.empty}>{c.unavailable}</p></div>;
  return <div className={embedded ? styles.embeddedCheckout : styles.shell}>{!embedded ? <header className={styles.header}><div><p className={styles.brand}>{c.service}</p><h1>{product.title}</h1></div><div><p>{product.description}</p><Link className={styles.link} href={`/${locale}`}>{c.back}</Link></div></header> : null}<div className={styles.main}><form className={styles.form} onSubmit={submit} aria-busy={busy}>
    <fieldset className={styles.checkoutFields} disabled={busy || locked} aria-label={c.service}>
    <div className={styles.formGrid}><OfferPicker offers={offers.map((item) => ({ id: item.id, variant: item.variantName || product.title, seller: item.seller.shopName, price: item.price, currency: item.currency }))} value={offerId} onChange={setOfferId} locale={locale} label={c.variant} sellerLabel={c.sold} /><label className={styles.field}><span>{c.qty}</span><input type="number" min={product.bridge.minimumQuantity} max={product.bridge.maximumQuantity} value={Number.isNaN(quantity) ? "" : quantity} onChange={(e)=>setQuantity(e.target.value === "" ? NaN : Number(e.target.value))} required/><small>{product.bridge.minimumQuantity}–{product.bridge.maximumQuantity}</small></label></div>
    <section className={styles.section}><div className={styles.sectionHead}><div><h2>{c.buyer}</h2><p>{c.protected}</p></div></div><div className={styles.formGrid}>{product.bridge.fields.map((field)=><label className={styles.field} key={field.key}><span>{field.label}{field.required?" *":""}</span>{field.type==="select"?<select required={field.required} value={fields[field.key]??""} onChange={(e)=>setFields((v)=>({...v,[field.key]:e.target.value}))}><option value=""/>{field.options?.map((o)=><option key={o.value} value={o.value}>{o.label}</option>)}</select>:field.type==="textarea"?<textarea required={field.required} minLength={field.minimumLength} maxLength={field.maximumLength} placeholder={field.placeholder} value={fields[field.key]??""} onChange={(e)=>setFields((v)=>({...v,[field.key]:e.target.value}))}/>:<input type={field.type==="number"?"number":"text"} required={field.required} minLength={field.minimumLength} maxLength={field.maximumLength} placeholder={field.placeholder} value={fields[field.key]??""} onChange={(e)=>setFields((v)=>({...v,[field.key]:e.target.value}))}/>}<small>{field.helpText??" "}</small></label>)}</div></section>
    {!otp?<section className={styles.section}><div className={styles.sectionHead}><h2>{c.signin}</h2></div><div className={styles.formGrid}><label className={styles.field}><span>{c.phone}</span><input type="tel" value={phone} onChange={(e)=>setPhone(e.target.value)} pattern="(?:\+98|0098|98|0)?9[0-9]{9}" required/><small>&nbsp;</small></label>{challenge?<><label className={styles.field}><span>{c.code}</span><input name="code" inputMode="numeric" pattern="[0-9]{6}" required/><small>&nbsp;</small></label><label className={styles.field}><span>{c.fullName}</span><input name="fullName" minLength={2} maxLength={120}/><small>&nbsp;</small></label></>:null}</div></section>:null}
    </fieldset>
    {locked && (!busy || orderId) ? <p className={styles.helper} role="status">{orderId ? c.saved : c.pending}</p> : null}
    {locked ? <Link className={styles.link} href={`/${locale}/account/orders`}>{c.orders}</Link> : null}
    <div className={styles.cardHead}><strong>{c.total}: {total} {currencyLabel(offer.currency)}</strong><button className={styles.button} disabled={busy}>{busy?c.sending:orderId?c.retry:!otp&&!challenge?c.send:!otp?c.verify:c.buy}</button></div>{error?<p className={styles.error} role="alert">{error}</p>:null}
  </form></div></div>;
}
