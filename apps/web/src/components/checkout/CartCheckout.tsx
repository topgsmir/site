"use client";

import axios from "axios";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import type { CheckoutDetail, CheckoutQuote } from "@topgsm/shared-types";
import { DesignIcon } from "@/components/DesignIcon";
import { api } from "@/lib/api/client";
import { captchaTokenFor } from "@/lib/security-captcha";
import { getTrafficSource } from "@/lib/traffic-source";
import { readCart, writeCart, type CartItem } from "@/lib/cart";
import { currencyLabel, formatCurrencyAmount } from "@/lib/currency";
import type { Locale } from "@/lib/i18n";
import styles from "./Checkout.module.css";

const COPY = {
  en: {
    eyebrow: "Secure checkout", title: "Review your cart.", intro: "Confirm your selections, then choose delivery and payment details.",
    empty: "Your cart is ready for its first item.", emptyHint: "Browse files, tools, and specialist services selected for repair professionals.", shop: "Browse products", continueShopping: "Continue shopping",
    item: "item", items: "items", quantity: "Quantity", remove: "Remove", each: "each", total: "Order total", summary: "Order summary", payment: "Payment method",
    address: "Shipping address", recipient: "Recipient name", phone: "Iranian mobile", province: "Province", city: "City", postal: "10-digit postal code", street: "Full address",
    signin: "Verify your mobile", signinHint: "We’ll send a one-time code before creating your order.", code: "Six-digit code", fullName: "Full name", email: "Email (required for new accounts)", sendCode: "Send verification code", verify: "Verify and continue", pay: "Create checkout and pay",
    busy: "Please wait…", failed: "Checkout could not continue. Try again.", cartSaveFailed: "Your cart could not be saved in this browser. Check storage permissions and try again.", serviceNote: "Note for the seller", serviceNoteHint: "Add the device model, issue, or any details the specialist needs.",
    external: "Digital delivery links are supplied by sellers and may open an external website.", seller: "Sold by", stepCart: "Cart", stepDetails: "Details", stepPayment: "Payment", loading: "Confirming current prices…", secure: "Your payment details are handled by the selected payment provider.",
    digital: "Digital file", physical: "Repair tool", service: "Specialist service", productUnavailable: "Product name unavailable",
    progress: "Checkout progress", completed: "Completed", current: "Current step", upcoming: "Upcoming", updating: "Updating total…",
    quoteFailed: "Current prices could not be confirmed.", unavailable: "Some items are no longer available. Remove them to continue.", stockChanged: "An item no longer has the requested quantity. Remove it or choose a lower quantity.", retry: "Try again", removeUnavailable: "Remove unavailable items",
    removed: "Item removed from your cart.", removedMany: "Unavailable items removed from your cart.", undo: "Undo",
    otpSent: "Code sent to", otpExpires: "Code expires in", otpExpired: "This code has expired.", otpInvalid: "The code is incorrect or expired. Check it or send a new one.", resend: "Send again", resendIn: "Send again in", changePhone: "Change number", newBuyerHint: "New buyers also need to enter their full name and email.", profileRequired: "For a new account, enter your full name and email, then try again.", newCode: "Send a new code"
  },
  fa: {
    eyebrow: "خرید امن", title: "سبد خریدتان را مرور کنید.", intro: "انتخاب‌ها را بررسی کنید و سپس اطلاعات تحویل و پرداخت را تکمیل کنید.",
    empty: "سبد خریدتان منتظر اولین انتخاب است.", emptyHint: "فایل‌ها، ابزارها و خدمات تخصصی مناسب تعمیرکاران را ببینید.", shop: "مشاهده محصولات", continueShopping: "ادامه خرید",
    item: "محصول", items: "محصول", quantity: "تعداد", remove: "حذف", each: "قیمت واحد", total: "مبلغ سفارش", summary: "خلاصه سفارش", payment: "روش پرداخت",
    address: "نشانی تحویل", recipient: "نام گیرنده", phone: "شماره موبایل ایران", province: "استان", city: "شهر", postal: "کد پستی ۱۰ رقمی", street: "نشانی کامل",
    signin: "تأیید شماره موبایل", signinHint: "پیش از ثبت سفارش، یک کد یک‌بارمصرف برایتان می‌فرستیم.", code: "کد شش‌رقمی", fullName: "نام و نام خانوادگی", email: "ایمیل (برای حساب جدید الزامی)", sendCode: "ارسال کد تأیید", verify: "تأیید و ادامه", pay: "ثبت سفارش و پرداخت",
    busy: "کمی صبر کنید…", failed: "ادامه خرید ممکن نبود. دوباره تلاش کنید.", cartSaveFailed: "سبد خرید در این مرورگر ذخیره نشد. دسترسی ذخیره‌سازی را بررسی و دوباره تلاش کنید.", serviceNote: "توضیح برای فروشنده", serviceNoteHint: "مدل دستگاه، ایراد یا اطلاعات موردنیاز متخصص را بنویسید.",
    external: "لینک تحویل فایل را فروشنده ارائه می‌کند و ممکن است در وب‌سایت دیگری باز شود.", seller: "فروشنده", stepCart: "سبد", stepDetails: "اطلاعات", stepPayment: "پرداخت", loading: "در حال بررسی قیمت‌های فعلی…", secure: "اطلاعات پرداخت شما در درگاه پرداخت منتخب پردازش می‌شود.",
    digital: "فایل دیجیتال", physical: "ابزار تعمیر", service: "خدمت تخصصی", productUnavailable: "نام محصول در دسترس نیست",
    progress: "مراحل خرید", completed: "انجام شد", current: "مرحله فعلی", upcoming: "مرحله بعد", updating: "در حال به‌روزرسانی مبلغ…",
    quoteFailed: "بررسی قیمت‌های فعلی ممکن نبود.", unavailable: "بعضی محصولات دیگر در دسترس نیستند. برای ادامه آن‌ها را حذف کنید.", stockChanged: "موجودی یکی از محصولات برای این تعداد کافی نیست. تعداد را کم کنید یا محصول را حذف کنید.", retry: "تلاش دوباره", removeUnavailable: "حذف محصولات ناموجود",
    removed: "محصول از سبد خرید حذف شد.", removedMany: "محصولات ناموجود از سبد خرید حذف شدند.", undo: "برگرداندن",
    otpSent: "کد به این شماره فرستاده شد:", otpExpires: "مهلت استفاده از کد:", otpExpired: "مهلت این کد تمام شده است.", otpInvalid: "کد نادرست است یا مهلتش تمام شده. کد را بررسی کنید یا کد تازه بگیرید.", resend: "ارسال دوباره", resendIn: "ارسال دوباره تا", changePhone: "تغییر شماره", newBuyerHint: "اگر حساب تازه می‌سازید، نام کامل و ایمیل را هم وارد کنید.", profileRequired: "برای ساخت حساب، نام کامل و ایمیل را وارد و دوباره تلاش کنید.", newCode: "ارسال کد جدید"
  },
  ar: {
    eyebrow: "دفع آمن", title: "راجع سلة التسوق.", intro: "تأكد من اختياراتك، ثم أكمل بيانات التسليم والدفع.",
    empty: "سلة التسوق بانتظار اختيارك الأول.", emptyHint: "تصفح الملفات والأدوات والخدمات المتخصصة لفنيي الصيانة.", shop: "تصفح المنتجات", continueShopping: "متابعة التسوق",
    item: "منتج", items: "منتجات", quantity: "الكمية", remove: "إزالة", each: "سعر الوحدة", total: "إجمالي الطلب", summary: "ملخص الطلب", payment: "طريقة الدفع",
    address: "عنوان الشحن", recipient: "اسم المستلم", phone: "رقم جوال إيراني", province: "المحافظة", city: "المدينة", postal: "الرمز البريدي من 10 أرقام", street: "العنوان الكامل",
    signin: "تحقق من رقم الجوال", signinHint: "سنرسل رمزاً لمرة واحدة قبل إنشاء الطلب.", code: "الرمز المكوّن من ستة أرقام", fullName: "الاسم الكامل", email: "البريد الإلكتروني (مطلوب للحساب الجديد)", sendCode: "إرسال رمز التحقق", verify: "تحقق وتابع", pay: "إنشاء الطلب والدفع",
    busy: "يرجى الانتظار…", failed: "تعذر متابعة الشراء. حاول مجددًا.", cartSaveFailed: "تعذر حفظ سلة التسوق في هذا المتصفح. تحقق من صلاحية التخزين وحاول مجددًا.", serviceNote: "ملاحظة للبائع", serviceNoteHint: "أضف طراز الجهاز أو المشكلة أو التفاصيل التي يحتاجها المختص.",
    external: "يوفر البائع روابط التسليم الرقمي وقد تفتح موقعًا خارجيًا.", seller: "البائع", stepCart: "السلة", stepDetails: "البيانات", stepPayment: "الدفع", loading: "جارٍ تأكيد الأسعار الحالية…", secure: "تتم معالجة بيانات الدفع لدى مزود الدفع الذي تختاره.",
    digital: "ملف رقمي", physical: "أداة صيانة", service: "خدمة متخصصة", productUnavailable: "اسم المنتج غير متاح",
    progress: "مراحل الشراء", completed: "مكتمل", current: "المرحلة الحالية", upcoming: "التالي", updating: "جارٍ تحديث الإجمالي…",
    quoteFailed: "تعذر تأكيد الأسعار الحالية.", unavailable: "بعض المنتجات لم تعد متاحة. أزلها للمتابعة.", stockChanged: "الكمية المطلوبة لأحد المنتجات لم تعد متاحة. قلل الكمية أو أزل المنتج.", retry: "حاول مجددًا", removeUnavailable: "إزالة المنتجات غير المتاحة",
    removed: "تمت إزالة المنتج من سلة التسوق.", removedMany: "تمت إزالة المنتجات غير المتاحة من سلة التسوق.", undo: "تراجع",
    otpSent: "أُرسل الرمز إلى", otpExpires: "تنتهي صلاحية الرمز خلال", otpExpired: "انتهت صلاحية هذا الرمز.", otpInvalid: "الرمز غير صحيح أو انتهت صلاحيته. تحقّق منه أو أرسل رمزًا جديدًا.", resend: "إرسال مجددًا", resendIn: "إعادة الإرسال خلال", changePhone: "تغيير الرقم", newBuyerHint: "إذا كنت تنشئ حسابًا جديدًا، فأدخل الاسم الكامل والبريد الإلكتروني أيضًا.", profileRequired: "لإنشاء حساب جديد، أدخل الاسم الكامل والبريد الإلكتروني ثم حاول مجددًا.", newCode: "إرسال رمز جديد"
  }
} as const;

type OtpChallenge = { id: string; requestedPhone: string; expiresAt: number; resendAt: number };
type QuoteIssue = { message: string; offerIds: string[] };
type RemovedLine = { item: CartItem; index: number };

function apiErrorData(error: unknown): { code?: string; offerIds?: unknown; message?: string } {
  if (!axios.isAxiosError(error) || typeof error.response?.data !== "object" || error.response.data === null) return {};
  return error.response.data as { code?: string; offerIds?: unknown; message?: string };
}

function formatCountdown(seconds: number, locale: Locale) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return new Intl.NumberFormat(locale, { minimumIntegerDigits: 2 }).format(minutes) + ":" + new Intl.NumberFormat(locale, { minimumIntegerDigits: 2 }).format(remainder);
}

export function CartCheckout({ locale, signedInBuyer }: { locale: Locale; signedInBuyer: boolean }) {
  const c = COPY[locale];
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [quote, setQuote] = useState<CheckoutQuote | null>(null);
  const [quoteUpdating, setQuoteUpdating] = useState(false);
  const [quoteIssue, setQuoteIssue] = useState<QuoteIssue | null>(null);
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [authenticated, setAuthenticated] = useState(signedInBuyer);
  const [challenge, setChallenge] = useState<OtpChallenge | null>(null);
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [clock, setClock] = useState(() => Date.now());
  const [quantityDrafts, setQuantityDrafts] = useState<Record<string, string>>({});
  const [removedLines, setRemovedLines] = useState<RemovedLine[]>([]);
  const checkoutKey = useRef(crypto.randomUUID());
  const quoteRequest = useRef(0);
  const quoteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const number = useMemo(() => new Intl.NumberFormat(locale), [locale]);

  const refresh = useCallback(async (cart: CartItem[]) => {
    const request = ++quoteRequest.current;
    if (!cart.length) { setQuote(null); setQuoteIssue(null); setQuoteUpdating(false); return; }
    setQuoteUpdating(true);
    setQuoteIssue(null);
    try {
      const response = await api.post<CheckoutQuote>("/checkouts/quote", { items: cart.map(({ offerId, quantity, serviceNote }) => ({ offerId, quantity, ...(serviceNote ? { serviceNote } : {}) })) });
      if (request !== quoteRequest.current) return;
      setQuote(response.data);
      const productNames = new Map(response.data.groups.flatMap((group) => group.items.map((item) => [item.offerId, item.title])));
      const migratedCart = cart.map((item) => {
        const productName = productNames.get(item.offerId);
        return productName && productName !== item.productName ? { ...item, productName } : item;
      });
      if (migratedCart.some((item, index) => item !== cart[index])) {
        setItems(migratedCart);
        writeCart(migratedCart);
      }
      setSelections((current) => Object.fromEntries(response.data.groups.map((group) => [group.key, current[group.key] && group.paymentMethods.some((method) => method.code === current[group.key]) ? current[group.key] : response.data.commonPaymentMethods[0]?.code ?? group.paymentMethods[0]!.code])));
    } catch (requestError) {
      if (request !== quoteRequest.current) return;
      const payload = apiErrorData(requestError);
      const offerIds = Array.isArray(payload.offerIds) ? payload.offerIds.filter((value): value is string => typeof value === "string") : [];
      setQuoteIssue({
        message: payload.code === "CART_ITEMS_UNAVAILABLE" ? c.unavailable : payload.code === "CART_STOCK_INSUFFICIENT" ? c.stockChanged : c.quoteFailed,
        offerIds
      });
    } finally {
      if (request === quoteRequest.current) setQuoteUpdating(false);
    }
  }, [c.quoteFailed, c.stockChanged, c.unavailable]);

  useEffect(() => {
    const cart = readCart();
    setItems(cart);
    setHydrated(true);
    void refresh(cart);
  }, [refresh]);

  useEffect(() => {
    if (!challenge) return;
    setClock(Date.now());
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [challenge]);

  useEffect(() => () => {
    if (quoteTimer.current) clearTimeout(quoteTimer.current);
    if (undoTimer.current) clearTimeout(undoTimer.current);
  }, []);

  const pricedOffers = useMemo(() => new Map(quote?.groups.flatMap((group) => group.items.map((item) => [item.offerId, item])) ?? []), [quote]);
  const offerGroups = useMemo(() => new Map(quote?.groups.flatMap((group) => group.items.map((item) => [item.offerId, group])) ?? []), [quote]);
  const itemCount = useMemo(() => items.reduce((total, item) => total + item.quantity, 0), [items]);
  const otpRemaining = challenge ? Math.max(0, Math.ceil((challenge.expiresAt - clock) / 1000)) : 0;
  const resendRemaining = challenge ? Math.max(0, Math.ceil((challenge.resendAt - clock) / 1000)) : 0;
  const activeStep = !quote ? 1 : busy && authenticated ? 3 : 2;

  function persist(next: CartItem[], mode: "immediate" | "debounced" = "immediate") {
    try {
      writeCart(next);
      setItems(next);
      setError("");
      checkoutKey.current = crypto.randomUUID();
      if (quoteTimer.current) clearTimeout(quoteTimer.current);
      if (mode === "debounced") {
        quoteRequest.current += 1;
        setQuoteUpdating(true);
        quoteTimer.current = setTimeout(() => void refresh(next), 300);
      } else {
        void refresh(next);
      }
    } catch {
      setError(c.cartSaveFailed);
    }
  }

  function updateQuantity(offerId: string, quantity: number, mode: "immediate" | "debounced" = "immediate") {
    const nextQuantity = Math.max(1, Math.min(100, quantity || 1));
    setQuantityDrafts((current) => {
      const next = { ...current };
      delete next[offerId];
      return next;
    });
    if (items.some((item) => item.offerId === offerId && item.quantity !== nextQuantity)) {
      persist(items.map((item) => item.offerId === offerId ? { ...item, quantity: nextQuantity } : item), mode);
    }
  }

  function commitQuantity(offerId: string) {
    const item = items.find((entry) => entry.offerId === offerId);
    if (!item) return;
    const draft = quantityDrafts[offerId];
    if (!draft) {
      setQuantityDrafts((current) => { const next = { ...current }; delete next[offerId]; return next; });
      return;
    }
    updateQuantity(offerId, Number(draft), "debounced");
  }

  function adjustQuantity(offerId: string, delta: number) {
    const item = items.find((entry) => entry.offerId === offerId);
    if (!item) return;
    const draft = quantityDrafts[offerId];
    const current = draft && Number.isFinite(Number(draft)) ? Number(draft) : item.quantity;
    updateQuantity(offerId, current + delta);
  }

  function handleQuantityKeyDown(event: KeyboardEvent<HTMLInputElement>, offerId: string) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    commitQuantity(offerId);
    event.currentTarget.blur();
  }

  function removeOffers(offerIds: Iterable<string>) {
    const removed = new Set(offerIds);
    const lines = items.flatMap((item, index) => removed.has(item.offerId) ? [{ item, index }] : []);
    if (!lines.length) return;
    persist(items.filter((item) => !removed.has(item.offerId)));
    setRemovedLines(lines);
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setRemovedLines([]), 6000);
  }

  function undoRemove() {
    if (!removedLines.length) return;
    const restored = [...items];
    for (const line of [...removedLines].sort((a, b) => a.index - b.index)) restored.splice(Math.min(line.index, restored.length), 0, line.item);
    setRemovedLines([]);
    if (undoTimer.current) clearTimeout(undoTimer.current);
    persist(restored);
  }

  function updateNote(offerId: string, serviceNote: string) {
    const next = items.map((item) => item.offerId === offerId ? { ...item, serviceNote } : item);
    try { writeCart(next); setItems(next); setError(""); checkoutKey.current = crypto.randomUUID(); }
    catch { setError(c.cartSaveFailed); }
  }

  async function requestOtp() {
    const captchaToken = await captchaTokenFor("otp");
    const response = await api.post<{ challengeId: string; expiresAt: string }>("/auth/otp/request", { phoneNumber: phone, ...(captchaToken ? { captchaToken } : {}) });
    const requestedAt = Date.now();
    setClock(requestedAt);
    setChallenge({ id: response.data.challengeId, requestedPhone: phone, expiresAt: Date.parse(response.data.expiresAt), resendAt: requestedAt + 60_000 });
  }

  async function resendOtp() {
    if (busy || resendRemaining > 0) return;
    setBusy(true); setError("");
    try { await requestOtp(); }
    catch { setError(c.failed); }
    finally { setBusy(false); }
  }

  function changePhone() {
    setChallenge(null);
    setError("");
  }

  async function createCheckout(form: HTMLFormElement) {
    if (!quote) return;
    const data = new FormData(form);
    const body = {
      trafficSource: getTrafficSource(),
      items: items.map(({ offerId, quantity, serviceNote }) => ({ offerId, quantity, ...(serviceNote ? { serviceNote } : {}) })),
      paymentSelections: quote.groups.map((group) => ({ orderGroupKey: group.key, providerCode: selections[group.key] })),
      ...(quote.requiresShippingAddress ? { shippingAddress: { recipientName: data.get("recipientName"), phoneNumber: data.get("shippingPhone"), province: data.get("province"), city: data.get("city"), postalCode: data.get("postalCode"), addressLine: data.get("addressLine") } } : {})
    };
    const checkout = await api.post<CheckoutDetail>("/checkouts", body, { headers: { "Idempotency-Key": checkoutKey.current } });
    const group = checkout.data.paymentGroups.find((item) => item.status === "pending");
    if (!group) { window.location.assign(`/${locale}/checkout/${checkout.data.id}`); return; }
    const payment = await api.post<{ paymentUrl?: string }>(`/checkouts/${checkout.data.id}/payment-groups/${group.id}/initiate`, {}, { headers: { "Idempotency-Key": crypto.randomUUID() } });
    const paymentUrl = payment.data.paymentUrl;
    window.location.assign(paymentUrl?.startsWith("/pay/local/") ? `/${locale}${paymentUrl}` : paymentUrl ?? `/${locale}/checkout/${checkout.data.id}`);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    let verifyingOtp = false;
    setBusy(true); setError("");
    try {
      if (!authenticated) {
        const data = new FormData(form);
        if (!challenge || otpRemaining === 0) {
          await requestOtp();
          setBusy(false); return;
        }
        verifyingOtp = true;
        await api.post("/auth/otp/verify", { phoneNumber: challenge.requestedPhone, challengeId: challenge.id, code: data.get("code"), fullName: data.get("fullName"), email: data.get("email") });
        verifyingOtp = false;
        setAuthenticated(true);
      }
      await createCheckout(form);
    } catch (submitError) {
      const status = axios.isAxiosError(submitError) ? submitError.response?.status : undefined;
      setError(verifyingOtp && status === 400 ? c.profileRequired : verifyingOtp && status === 401 ? c.otpInvalid : c.failed);
      setBusy(false);
    }
  }

  if (!hydrated) return <main className={styles.page} id="cart-content"><div className={styles.loading} role="status"><span /><p>{c.loading}</p></div></main>;

  return <main className={styles.page} id="cart-content">
    <header className={styles.hero}>
      <div><p className={styles.eyebrow}>{c.eyebrow}</p><h1>{c.title}</h1><p className={styles.intro}>{c.intro}</p></div>
      <ol className={styles.steps} aria-label={c.progress} data-active-step={activeStep}>
        {[c.stepCart, c.stepDetails, c.stepPayment].map((label, index) => {
          const step = index + 1;
          const state = step < activeStep ? "complete" : step === activeStep ? "current" : "upcoming";
          return <li key={label} data-state={state} aria-current={state === "current" ? "step" : undefined}>
            <span className={styles.stepMarker} aria-hidden="true">{state === "complete" ? <DesignIcon name="check" /> : step}</span>
            <span className={styles.stepLabel}><small>{state === "complete" ? c.completed : state === "current" ? c.current : c.upcoming}</small><strong>{label}</strong></span>
            <span className="sr-only">{state === "complete" ? c.completed : state === "current" ? c.current : c.upcoming}</span>
          </li>;
        })}
      </ol>
    </header>
    {!items.length ? <section className={styles.empty}><span className={styles.emptyIcon}><DesignIcon name="layers" /></span><h2>{c.empty}</h2><p>{c.emptyHint}</p><Link href={`/${locale}/products`}>{c.shop}<DesignIcon name="arrow" /></Link></section> : <form className={styles.layout} onSubmit={submit} aria-busy={busy}>
      <section className={styles.cartColumn} aria-labelledby="cart-items-title">
        <div className={styles.sectionHeading}><div><p id="cart-items-title">{number.format(itemCount)} {itemCount === 1 ? c.item : c.items}</p><h2>{c.stepCart}</h2></div><Link href={`/${locale}/products`}>{c.continueShopping}<DesignIcon name="arrow" /></Link></div>
        <div className={styles.items}>{items.map((cartItem) => {
          const item = pricedOffers.get(cartItem.offerId);
          const group = offerGroups.get(cartItem.offerId);
          const productType = item?.productType ?? "digital";
          return <article className={styles.item} key={cartItem.offerId}>
            <div className={styles.artwork} data-type={productType} data-has-image={Boolean(item?.image)}>
              {item?.image ? <Image src={item.image.url} alt="" width={item.image.width} height={item.image.height} unoptimized /> : <DesignIcon name={productType === "digital" ? "file" : productType === "service" ? "headphones" : "layers"} />}
              <span>{c[productType]}</span>
            </div>
            <div className={styles.itemBody}>
              <div className={styles.itemTop}><div><p>{group ? `${c.seller} ${group.seller.shopName}` : c[productType]}</p><h3>{item?.title ?? cartItem.productName ?? (quoteIssue ? c.productUnavailable : c.loading)}</h3></div><button className={styles.remove} type="button" onClick={() => removeOffers([cartItem.offerId])}>{c.remove}</button></div>
              <div className={styles.itemBottom}><div className={styles.price}><strong>{item ? `${formatCurrencyAmount(item.totalAmount, quote?.currency ?? "IRR", locale)} ${currencyLabel(quote?.currency ?? "IRR")}` : "—"}</strong>{item ? <small>{c.each}: {formatCurrencyAmount(item.unitPrice, quote?.currency ?? "IRR", locale)} {currencyLabel(quote?.currency ?? "IRR")}</small> : null}</div><div className={styles.quantity}><span>{c.quantity}</span><div><button type="button" aria-label={`${c.quantity} −`} disabled={cartItem.quantity <= 1 && !quantityDrafts[cartItem.offerId]} onClick={() => adjustQuantity(cartItem.offerId, -1)}>−</button><input aria-label={c.quantity} type="number" inputMode="numeric" min={1} max={100} value={quantityDrafts[cartItem.offerId] ?? String(cartItem.quantity)} onChange={(event) => { if (/^\d{0,3}$/.test(event.target.value)) setQuantityDrafts((current) => ({ ...current, [cartItem.offerId]: event.target.value })); }} onBlur={() => commitQuantity(cartItem.offerId)} onKeyDown={(event) => handleQuantityKeyDown(event, cartItem.offerId)} /><button type="button" aria-label={`${c.quantity} +`} disabled={cartItem.quantity >= 100 && !quantityDrafts[cartItem.offerId]} onClick={() => adjustQuantity(cartItem.offerId, 1)}>+</button></div></div></div>
              {item?.productType === "service" ? <label className={styles.note}><span>{c.serviceNote}</span><textarea maxLength={2000} value={cartItem.serviceNote ?? ""} placeholder={c.serviceNoteHint} onChange={(event) => updateNote(cartItem.offerId, event.target.value)} /></label> : null}
            </div>
          </article>;
        })}</div>
      </section>
      <aside className={styles.summary}>
        <div className={styles.summaryTitle}><div><p>{c.summary}</p><span>{number.format(itemCount)} {itemCount === 1 ? c.item : c.items}</span></div>{quote ? <><strong>{formatCurrencyAmount(quote.totalAmount, quote.currency, locale)} <small>{currencyLabel(quote.currency)}</small></strong>{quoteUpdating ? <span className={styles.updating} role="status">{c.updating}</span> : null}</> : <span className={styles.pricePlaceholder}>{c.loading}</span>}</div>
        {quote?.groups.map((group) => <div className={styles.paymentGroup} key={group.key}><div><span>{group.seller.shopName}</span><strong>{formatCurrencyAmount(group.totalAmount, quote.currency, locale)} {currencyLabel(quote.currency)}</strong></div><label><span>{c.payment}</span><select value={selections[group.key] ?? ""} onChange={(event) => setSelections((current) => ({ ...current, [group.key]: event.target.value }))}>{group.paymentMethods.map((method) => <option key={method.code} value={method.code}>{method.name}</option>)}</select></label></div>)}
        {quote?.requiresShippingAddress ? <fieldset><legend>{c.address}</legend><label><span>{c.recipient}</span><input name="recipientName" autoComplete="name" minLength={2} maxLength={120} required /></label><label><span>{c.phone}</span><input name="shippingPhone" type="tel" inputMode="tel" autoComplete="tel" pattern="(?:\+98|0098|98|0)?9[0-9]{9}" required /></label><div><label><span>{c.province}</span><input name="province" autoComplete="address-level1" minLength={2} maxLength={100} required /></label><label><span>{c.city}</span><input name="city" autoComplete="address-level2" minLength={2} maxLength={100} required /></label></div><label><span>{c.postal}</span><input name="postalCode" autoComplete="postal-code" pattern="[0-9]{10}" inputMode="numeric" required /></label><label><span>{c.street}</span><textarea name="addressLine" autoComplete="street-address" minLength={10} maxLength={1000} required /></label></fieldset> : null}
        {!authenticated ? <fieldset><legend>{c.signin}</legend><p className={styles.fieldHint}>{c.signinHint}</p><label><span>{c.phone}</span><input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" autoComplete="tel" pattern="(?:\+98|0098|98|0)?9[0-9]{9}" disabled={Boolean(challenge)} required /></label>{challenge ? <><div className={styles.otpMeta}><p>{c.otpSent} <b dir="ltr">{challenge.requestedPhone}</b></p><button type="button" onClick={changePhone}>{c.changePhone}</button></div><p className={otpRemaining === 0 ? styles.otpExpired : styles.otpTimer} role={otpRemaining === 0 ? "status" : undefined}>{otpRemaining === 0 ? c.otpExpired : `${c.otpExpires} ${formatCountdown(otpRemaining, locale)}`}</p>{otpRemaining > 0 ? <label><span>{c.code}</span><input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" autoFocus required /></label> : null}<p className={styles.fieldHint}>{c.newBuyerHint}</p><label><span>{c.fullName}</span><input name="fullName" autoComplete="name" minLength={2} maxLength={120} /></label><label><span>{c.email}</span><input name="email" type="email" autoComplete="email" maxLength={254} /></label><button className={styles.resend} type="button" disabled={busy || resendRemaining > 0} onClick={() => void resendOtp()}>{resendRemaining > 0 ? `${c.resendIn} ${formatCountdown(resendRemaining, locale)}` : c.resend}</button></> : null}</fieldset> : null}
        {quoteIssue ? <div className={styles.quoteError} role="alert"><p>{quoteIssue.message}</p><div><button type="button" onClick={() => void refresh(items)} disabled={quoteUpdating}>{c.retry}</button>{quoteIssue.offerIds.length ? <button type="button" onClick={() => removeOffers(quoteIssue.offerIds)}>{c.removeUnavailable}</button> : null}</div></div> : null}
        {error ? <p className={styles.error} role="alert">{error}</p> : null}
        <button className={styles.primary} type="submit" disabled={busy || quoteUpdating || Boolean(quoteIssue) || !quote}>{busy ? c.busy : !authenticated && (!challenge || otpRemaining === 0) ? (challenge ? c.newCode : c.sendCode) : !authenticated ? c.verify : c.pay}<DesignIcon name="arrow" /></button>
        <div className={styles.secureNote}><DesignIcon name="check" /><p>{c.secure}<small>{c.external}</small></p></div>
      </aside>
    </form>}
    {removedLines.length ? <div className={styles.undoNotice} role="status" aria-live="polite"><span>{removedLines.length > 1 ? c.removedMany : c.removed}</span><button type="button" onClick={undoRemove}>{c.undo}</button></div> : null}
  </main>;
}
