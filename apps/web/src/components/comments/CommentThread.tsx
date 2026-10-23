"use client";

import type { Route } from "next";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useId, useState } from "react";
import axios from "axios";
import type { AppUser, CommentPage, CommentPostingPolicy, ProductComment } from "@topgsm/shared-types";
import type { Locale } from "@/lib/i18n";
import { api } from "@/lib/api/client";
import { captchaTokenFor } from "@/lib/security-captcha";
import styles from "./Comments.module.css";
import store from "./ProductComments.module.css";

const copy = {
  product: {
    en: {
      title: "Customer comments", intro: "Questions and experiences from customers, with answers from sellers.", empty: "No comments yet.", name: "Your name", customerName: "Customer name", customerNameHint: "Optional. Leave blank to post as yourself, or enter a customer name to display.", body: "Your comment", submit: "Send comment", sending: "Sending…", signIn: "Sign in to comment", purchase: "Only customers who bought this product can comment.", purchaseHint: "You can comment after a completed purchase of this product.", pending: "Your comment was sent for review.", approved: "Your comment is now visible.", error: "Comments could not be loaded.", submitError: "Your comment could not be sent. Try again.", more: "Load more", reply: "Seller reply",
      ctaPrompt: "You can also write a comment about this product.", buyer: "Buyer", expand: "Read more", collapse: "Show less", countLabel: "comments", countMore: "+",
      reasons: {
        purchase: "Only customers with a completed purchase of this product can comment.",
        signIn: "Sign in to post a comment.",
        plainText: "Remove symbols like < or > and try again. Comments must be plain text.",
        guestName: "Enter your name to post as a guest.",
        smsRequired: "Confirm your mobile number with the SMS code first.",
        smsInvalid: "The SMS code is wrong or expired. Request a new code.",
        captcha: "Security check failed. Refresh the page and try again.",
        rateLimited: "Too many attempts. Wait a few minutes and try again.",
        noSellers: "Comments are unavailable for this product right now.",
        network: "Could not reach the server. Check your connection and try again.",
        validation: "Check the comment fields and try again.",
        unavailable: "Commenting is temporarily unavailable. Try again shortly."
      }
    },
    fa: {
      title: "دیدگاه‌های مشتریان", intro: "نظرها و پرسش‌های مشتریان، همراه با پاسخ فروشنده‌ها.", empty: "هنوز دیدگاهی ثبت نشده است.", name: "نام شما", customerName: "نام مشتری", customerNameHint: "اختیاری. خالی بگذارید تا با نام خودتان ثبت شود، یا نام مشتری را وارد کنید.", body: "دیدگاه شما", submit: "ثبت دیدگاه", sending: "در حال ارسال…", signIn: "برای ثبت دیدگاه وارد شوید", purchase: "فقط خریداران این محصول می‌توانند دیدگاه بگذارند.", purchaseHint: "پس از تکمیل خرید این محصول می‌توانید دیدگاه ثبت کنید.", pending: "دیدگاه شما برای بررسی فرستاده شد.", approved: "دیدگاه شما منتشر شد.", error: "دیدگاه‌ها دریافت نشدند.", submitError: "دیدگاه ثبت نشد. دوباره تلاش کنید.", more: "نمایش بیشتر", reply: "پاسخ فروشنده",
      ctaPrompt: "شما هم درباره این محصول دیدگاه ثبت کنید", buyer: "خریدار", expand: "ادامه", collapse: "بستن", countLabel: "دیدگاه", countMore: "+",
      reasons: {
        purchase: "فقط کسانی که خرید این محصول را کامل کرده‌اند می‌توانند دیدگاه بگذارند.",
        signIn: "برای ثبت دیدگاه وارد حساب کاربری شوید.",
        plainText: "نویسه‌هایی مثل < یا > را حذف کنید؛ متن دیدگاه باید ساده باشد.",
        guestName: "برای ثبت دیدگاه مهمان، نام خود را وارد کنید.",
        smsRequired: "ابتدا شماره موبایل را با کد پیامکی تأیید کنید.",
        smsInvalid: "کد پیامکی نادرست یا منقضی است. کد جدید بگیرید.",
        captcha: "تأیید امنیتی انجام نشد. صفحه را تازه کنید و دوباره تلاش کنید.",
        rateLimited: "تعداد تلاش‌ها زیاد است. چند دقیقه صبر کنید و دوباره تلاش کنید.",
        noSellers: "ثبت دیدگاه برای این محصول فعلاً ممکن نیست.",
        network: "ارتباط با سرور برقرار نشد. اتصال اینترنت را بررسی کنید.",
        validation: "اطلاعات فرم را بررسی کنید و دوباره تلاش کنید.",
        unavailable: "ثبت دیدگاه موقتاً در دسترس نیست. کمی بعد دوباره تلاش کنید."
      }
    },
    ar: {
      title: "تعليقات العملاء", intro: "آراء العملاء وأسئلتهم مع ردود البائعين.", empty: "لا توجد تعليقات بعد.", name: "اسمك", customerName: "اسم العميل", customerNameHint: "اختياري. اتركه فارغًا للنشر باسمك، أو أدخل اسم عميل للعرض.", body: "تعليقك", submit: "إرسال التعليق", sending: "جار الإرسال…", signIn: "سجّل الدخول للتعليق", purchase: "يمكن لمن اشتروا هذا المنتج فقط التعليق.", purchaseHint: "يمكنك التعليق بعد إتمام شراء هذا المنتج.", pending: "أُرسل تعليقك للمراجعة.", approved: "تعليقك ظاهر الآن.", error: "تعذر تحميل التعليقات.", submitError: "تعذر إرسال تعليقك. حاول مجددًا.", more: "عرض المزيد", reply: "رد البائع",
      ctaPrompt: "يمكنك أيضًا تسجيل رأيك حول هذا المنتج.", buyer: "مشترٍ", expand: "المزيد", collapse: "أقل", countLabel: "تعليق", countMore: "+",
      reasons: {
        purchase: "يمكن فقط لمن أكملوا شراء هذا المنتج إضافة تعليق.",
        signIn: "سجّل الدخول لنشر تعليق.",
        plainText: "أزل رموزًا مثل < أو >؛ يجب أن يكون التعليق نصًا عاديًا.",
        guestName: "أدخل اسمك للنشر كضيف.",
        smsRequired: "أكّد رقم هاتفك برمز الرسالة أولًا.",
        smsInvalid: "رمز الرسالة غير صحيح أو منتهٍ. اطلب رمزًا جديدًا.",
        captcha: "فشل التحقق الأمني. حدّث الصفحة وحاول مجددًا.",
        rateLimited: "محاولات كثيرة. انتظر بضع دقائق ثم حاول مجددًا.",
        noSellers: "التعليقات غير متاحة لهذا المنتج حاليًا.",
        network: "تعذر الاتصال بالخادم. تحقق من اتصالك وحاول مجددًا.",
        validation: "تحقق من حقول التعليق وحاول مجددًا.",
        unavailable: "التعليق غير متاح مؤقتًا. حاول بعد قليل."
      }
    }
  },
  blog: {
    en: {
      title: "Join the discussion", intro: "Share a question or perspective about this article.", empty: "No comments yet. Start the conversation.", name: "Your name", customerName: "Customer name", customerNameHint: "Optional. Leave blank to post as yourself, or enter a customer name to display.", body: "Your comment", submit: "Send comment", sending: "Sending…", signIn: "Sign in to comment", purchase: "", purchaseHint: "", pending: "Your comment was sent for review.", approved: "Your comment is now visible.", error: "Comments could not be loaded.", submitError: "Your comment could not be sent. Try again.", more: "Load more", reply: "Author reply",
      reasons: {
        purchase: "You cannot comment on this article right now.",
        signIn: "Sign in to post a comment.",
        plainText: "Remove symbols like < or > and try again. Comments must be plain text.",
        guestName: "Enter your name to post as a guest.",
        smsRequired: "Confirm your mobile number with the SMS code first.",
        smsInvalid: "The SMS code is wrong or expired. Request a new code.",
        captcha: "Security check failed. Refresh the page and try again.",
        rateLimited: "Too many attempts. Wait a few minutes and try again.",
        noSellers: "Comments are unavailable right now.",
        network: "Could not reach the server. Check your connection and try again.",
        validation: "Check the comment fields and try again.",
        unavailable: "Commenting is temporarily unavailable. Try again shortly."
      }
    },
    fa: {
      title: "در گفت‌وگو شرکت کنید", intro: "پرسش یا دیدگاهتان درباره این مقاله را با دیگران به اشتراک بگذارید.", empty: "هنوز دیدگاهی نیست؛ شما آغازگر گفت‌وگو باشید.", name: "نام شما", customerName: "نام مشتری", customerNameHint: "اختیاری. خالی بگذارید تا با نام خودتان ثبت شود، یا نام مشتری را وارد کنید.", body: "دیدگاه شما", submit: "ثبت دیدگاه", sending: "در حال ارسال…", signIn: "برای ثبت دیدگاه وارد شوید", purchase: "", purchaseHint: "", pending: "دیدگاه شما برای بررسی فرستاده شد.", approved: "دیدگاه شما منتشر شد.", error: "دیدگاه‌ها دریافت نشدند.", submitError: "دیدگاه ثبت نشد. دوباره تلاش کنید.", more: "نمایش بیشتر", reply: "پاسخ نویسنده",
      reasons: {
        purchase: "الان امکان ثبت دیدگاه برای این مقاله نیست.",
        signIn: "برای ثبت دیدگاه وارد حساب کاربری شوید.",
        plainText: "نویسه‌هایی مثل < یا > را حذف کنید؛ متن دیدگاه باید ساده باشد.",
        guestName: "برای ثبت دیدگاه مهمان، نام خود را وارد کنید.",
        smsRequired: "ابتدا شماره موبایل را با کد پیامکی تأیید کنید.",
        smsInvalid: "کد پیامکی نادرست یا منقضی است. کد جدید بگیرید.",
        captcha: "تأیید امنیتی انجام نشد. صفحه را تازه کنید و دوباره تلاش کنید.",
        rateLimited: "تعداد تلاش‌ها زیاد است. چند دقیقه صبر کنید و دوباره تلاش کنید.",
        noSellers: "ثبت دیدگاه فعلاً ممکن نیست.",
        network: "ارتباط با سرور برقرار نشد. اتصال اینترنت را بررسی کنید.",
        validation: "اطلاعات فرم را بررسی کنید و دوباره تلاش کنید.",
        unavailable: "ثبت دیدگاه موقتاً در دسترس نیست. کمی بعد دوباره تلاش کنید."
      }
    },
    ar: {
      title: "شارك في النقاش", intro: "شارك سؤالك أو رأيك حول هذا المقال.", empty: "لا توجد تعليقات بعد. ابدأ الحوار.", name: "اسمك", customerName: "اسم العميل", customerNameHint: "اختياري. اتركه فارغًا للنشر باسمك، أو أدخل اسم عميل للعرض.", body: "تعليقك", submit: "إرسال التعليق", sending: "جار الإرسال…", signIn: "سجّل الدخول للتعليق", purchase: "", purchaseHint: "", pending: "أُرسل تعليقك للمراجعة.", approved: "تعليقك ظاهر الآن.", error: "تعذر تحميل التعليقات.", submitError: "تعذر إرسال تعليقك. حاول مجددًا.", more: "عرض المزيد", reply: "رد الكاتب",
      reasons: {
        purchase: "لا يمكن التعليق على هذا المقال الآن.",
        signIn: "سجّل الدخول لنشر تعليق.",
        plainText: "أزل رموزًا مثل < أو >؛ يجب أن يكون التعليق نصًا عاديًا.",
        guestName: "أدخل اسمك للنشر كضيف.",
        smsRequired: "أكّد رقم هاتفك برمز الرسالة أولًا.",
        smsInvalid: "رمز الرسالة غير صحيح أو منتهٍ. اطلب رمزًا جديدًا.",
        captcha: "فشل التحقق الأمني. حدّث الصفحة وحاول مجددًا.",
        rateLimited: "محاولات كثيرة. انتظر بضع دقائق ثم حاول مجددًا.",
        noSellers: "التعليقات غير متاحة حاليًا.",
        network: "تعذر الاتصال بالخادم. تحقق من اتصالك وحاول مجددًا.",
        validation: "تحقق من حقول التعليق وحاول مجددًا.",
        unavailable: "التعليق غير متاح مؤقتًا. حاول بعد قليل."
      }
    }
  }
} as const;

const verificationCopy = {
  en: { phone: "Mobile number", code: "SMS code", request: "Send code", sending: "Sending code…", sent: "Code sent. It expires in 5 minutes.", error: "Could not send a code. Check the number and try again.", guestsDisabled: "Guest comments are turned off. Sign in to comment.", rateLimited: "Too many code requests. Wait a few minutes and try again.", unavailable: "SMS verification is temporarily unavailable." },
  fa: { phone: "شماره موبایل", code: "کد پیامکی", request: "ارسال کد", sending: "در حال ارسال کد…", sent: "کد ارسال شد و تا ۵ دقیقه معتبر است.", error: "کد ارسال نشد. شماره را بررسی کنید و دوباره تلاش کنید.", guestsDisabled: "ثبت دیدگاه مهمان غیرفعال است. وارد شوید تا دیدگاه بگذارید.", rateLimited: "درخواست کد زیاد شده است. چند دقیقه صبر کنید و دوباره تلاش کنید.", unavailable: "تأیید پیامکی موقتاً در دسترس نیست." },
  ar: { phone: "رقم الهاتف", code: "رمز الرسالة", request: "إرسال الرمز", sending: "جار إرسال الرمز…", sent: "أُرسل الرمز وهو صالح لمدة ٥ دقائق.", error: "تعذر إرسال الرمز. تحقق من الرقم وحاول مرة أخرى.", guestsDisabled: "تعليقات الضيوف متوقفة. سجّل الدخول للتعليق.", rateLimited: "طلبات الرمز كثيرة. انتظر بضع دقائق ثم حاول مجددًا.", unavailable: "التحقق عبر الرسالة غير متاح مؤقتًا." }
} as const;

const asciiDigits = (value: string) => value.replace(/[۰-۹٠-٩]/g, (digit) => {
  const code = digit.charCodeAt(0);
  return String(code >= 0x06F0 ? code - 0x06F0 : code - 0x0660);
});

function apiMessage(error: unknown) {
  if (!axios.isAxiosError(error) || typeof error.response?.data !== "object" || error.response.data === null) return "";
  const message = (error.response.data as { message?: unknown }).message;
  if (typeof message === "string") return message;
  if (Array.isArray(message)) return message.filter((item): item is string => typeof item === "string").join(" ");
  return "";
}

function commentSubmitError(
  error: unknown,
  reasons: (typeof copy)["product"]["fa"]["reasons"],
  fallback: string,
  purchaseRequired: boolean
) {
  const message = apiMessage(error).toLowerCase();
  const status = axios.isAxiosError(error) ? error.response?.status : undefined;

  if (!axios.isAxiosError(error) || !error.response) return reasons.network;
  if (message.includes("completed purchase") || message.includes("purchase is required")) return reasons.purchase;
  if (message.includes("sign in to comment") || message.includes("guest comments are disabled")) return reasons.signIn;
  if (message.includes("guest name")) return reasons.guestName;
  if (message.includes("plain text")) return reasons.plainText;
  if (message.includes("sms verification required")) return reasons.smsRequired;
  if (message.includes("verification code")) return reasons.smsInvalid;
  if (message.includes("captcha")) return reasons.captcha;
  if (message.includes("no active sellers")) return reasons.noSellers;
  if (status === 429 || message.includes("too many attempts")) return reasons.rateLimited;
  if (status === 400 || status === 422) return reasons.validation;
  if (status === 401) return reasons.signIn;
  if (status === 403) return purchaseRequired ? reasons.purchase : reasons.signIn;
  if (status === 503 || (status !== undefined && status >= 500)) return reasons.unavailable;
  return fallback;
}

function guestCodeError(error: unknown, locale: Locale) {
  const c = verificationCopy[locale];
  const message = apiMessage(error).toLowerCase();
  const status = axios.isAxiosError(error) ? error.response?.status : undefined;
  if (!axios.isAxiosError(error) || !error.response) return c.error;
  if (message.includes("guest comments are disabled")) return c.guestsDisabled;
  if (status === 429 || message.includes("too many")) return c.rateLimited;
  if (status === 503 || message.includes("disabled") || message.includes("not configured")) return c.unavailable;
  return c.error;
}

const BODY_CLAMP = 220;

function CommentAvatar() {
  return (
    <span className={store.avatar} aria-hidden="true">
      <svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" focusable="false">
        <circle cx="16" cy="11.5" r="5.6" fill="currentColor" />
        <path
          fill="currentColor"
          d="M5.8 27.6C7.2 21.8 11.2 18.8 16 18.8s8.8 3 10.2 8.8A16 16 0 0 1 16 32a16 16 0 0 1-10.2-4.4Z"
        />
      </svg>
    </span>
  );
}

function ExpandableBody({
  text,
  expandLabel,
  collapseLabel
}: {
  text: string;
  expandLabel: string;
  collapseLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const long = text.length > BODY_CLAMP;
  return (
    <>
      <p className={`${store.body}${long && !open ? ` ${store.bodyClamp}` : ""}`}>{text}</p>
      {long ? (
        <button className={store.expand} type="button" onClick={() => setOpen((current) => !current)} aria-expanded={open}>
          {open ? collapseLabel : expandLabel}
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path fill="currentColor" d="M7.4 8.6 12 13.2l4.6-4.6L18 10l-6 6-6-6z" />
          </svg>
        </button>
      ) : null}
    </>
  );
}

export function CommentThread({ targetType, targetId, locale }: { targetType: "product" | "blog"; targetId: string; locale: Locale }) {
  const c = copy[targetType][locale];
  const endpoint = targetType === "product" ? `/comments/products/${targetId}` : `/comments/blog-posts/${targetId}`;
  const headingId = `${targetType}-comments-title`;
  const bodyId = `${targetType}-comment-body`;
  const [items, setItems] = useState<ProductComment[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [policy, setPolicy] = useState<CommentPostingPolicy>("purchasers");
  const [guestSmsRequired, setGuestSmsRequired] = useState(false);
  const [guestPhone, setGuestPhone] = useState("");
  const [guestCode, setGuestCode] = useState("");
  const [guestChallengeId, setGuestChallengeId] = useState("");
  const [requestingCode, setRequestingCode] = useState(false);
  const [user, setUser] = useState<AppUser | null>(null);
  const [ready, setReady] = useState(false);
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [composerOpen, setComposerOpen] = useState(false);
  const composerFormId = useId();

  const load = useCallback(async (next?: string) => {
    setLoading(true);
    try {
      const response = await api.get<CommentPage<ProductComment>>(endpoint, { params: { limit: 20, ...(next ? { cursor: next } : {}) } });
      setItems((current) => next ? [...current, ...response.data.items] : response.data.items);
      setCursor(response.data.nextCursor);
    } catch { setError(c.error); }
    finally { setLoading(false); }
  }, [endpoint, c.error]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    void Promise.allSettled([api.get<{ postingPolicy: CommentPostingPolicy; guestSmsRequired: boolean }>("/comments/settings"), api.get<AppUser>("/auth/me")]).then(([settings, account]) => {
      if (settings.status === "fulfilled") { setPolicy(settings.value.data.postingPolicy); setGuestSmsRequired(settings.value.data.guestSmsRequired); }
      if (account.status === "fulfilled") setUser(account.value.data);
      setReady(true);
    });
    return () => clearTimeout(timer);
  }, [load]);

  async function requestCode() {
    setRequestingCode(true); setError(""); setMessage("");
    try {
      const response = await api.post<{ challengeId: string }>("/comments/guest-verification", { phoneNumber: guestPhone.trim() });
      setGuestChallengeId(response.data.challengeId);
      setGuestCode("");
      setMessage(verificationCopy[locale].sent);
    } catch (cause) { setError(guestCodeError(cause, locale)); }
    finally { setRequestingCode(false); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSending(true); setError(""); setMessage("");
    try {
      const isPlatformAdmin = user?.role === "platform-admin";
      const captchaToken = user || guestSmsRequired ? undefined : await captchaTokenFor("comment_submit_guest");
      const customerName = name.trim();
      const response = await api.post<{ status: string }>(endpoint, {
        body: body.trim(),
        ...(user
          ? (isPlatformAdmin && customerName ? { guestName: customerName } : {})
          : { guestName: customerName, ...(guestSmsRequired ? { guestPhoneNumber: guestPhone.trim(), guestChallengeId, guestCode } : captchaToken ? { captchaToken } : {}) })
      });
      setBody(""); setName(""); setGuestCode(""); setGuestChallengeId(""); setMessage(response.data.status === "approved" ? c.approved : c.pending);
      if (response.data.status === "approved") await load();
    } catch (cause) { setError(commentSubmitError(cause, c.reasons, c.submitError, targetType === "product" && policy === "purchasers" && user?.role !== "platform-admin")); }
    finally { setSending(false); }
  }

  const isPlatformAdmin = user?.role === "platform-admin";
  const canPost = Boolean(user) || (!user && policy === "guests");
  const showPurchaseHint = targetType === "product" && policy === "purchasers" && Boolean(user) && !isPlatformAdmin;
  const showBuyerBadge = targetType === "product" && policy === "purchasers";
  const submitDisabled = sending || !body.trim() || (!user && guestSmsRequired && (!guestChallengeId || !/^\d{6}$/.test(guestCode)));

  const composerFields = (
    <>
      {showPurchaseHint ? <p className={targetType === "product" ? store.notice : styles.notice} role="note">{c.purchaseHint}</p> : null}
      {!user ? (
        <div className={targetType === "product" ? store.guestFields : styles.guest}>
          <label htmlFor={`${targetType}-comment-guest-name`}>{c.name}</label>
          <input id={`${targetType}-comment-guest-name`} required maxLength={100} value={name} onChange={(event) => setName(event.target.value)} />
        </div>
      ) : null}
      {isPlatformAdmin ? (
        <div className={targetType === "product" ? store.guestFields : styles.guest}>
          <label htmlFor={`${targetType}-comment-customer-name`}>{c.customerName}</label>
          <input id={`${targetType}-comment-customer-name`} maxLength={100} value={name} onChange={(event) => setName(event.target.value)} aria-describedby={`${targetType}-comment-customer-hint`} />
          <p id={`${targetType}-comment-customer-hint`} className={targetType === "product" ? store.hint : styles.meta}>{c.customerNameHint}</p>
        </div>
      ) : null}
      {!user && guestSmsRequired ? (
        <div className={targetType === "product" ? store.guestFields : styles.guest}>
          <label htmlFor={`${targetType}-comment-phone`}>{verificationCopy[locale].phone}</label>
          <input id={`${targetType}-comment-phone`} type="tel" inputMode="tel" autoComplete="tel" required value={guestPhone} onChange={(event) => { setGuestPhone(asciiDigits(event.target.value)); setGuestChallengeId(""); }} />
          <button type="button" onClick={() => void requestCode()} disabled={requestingCode || !/^(?:\+98|0098|98|0)?9\d{9}$/.test(guestPhone.trim())}>{requestingCode ? verificationCopy[locale].sending : verificationCopy[locale].request}</button>
          {guestChallengeId ? (
            <>
              <label htmlFor={`${targetType}-comment-code`}>{verificationCopy[locale].code}</label>
              <input id={`${targetType}-comment-code`} inputMode="numeric" autoComplete="one-time-code" required maxLength={6} pattern="[0-9]{6}" value={guestCode} onChange={(event) => setGuestCode(asciiDigits(event.target.value))} />
            </>
          ) : null}
        </div>
      ) : null}
      <label htmlFor={bodyId}>{c.body}</label>
      <textarea id={bodyId} required maxLength={2000} value={body} onChange={(event) => setBody(event.target.value)} />
    </>
  );

  if (targetType === "product") {
    const productCopy = c as (typeof copy)["product"]["fa"];
    const countDisplay = `${new Intl.NumberFormat(locale).format(items.length)}${cursor ? productCopy.countMore : ""}`;
    const openComposer = () => {
      setComposerOpen(true);
      requestAnimationFrame(() => {
        document.getElementById(bodyId)?.focus();
      });
    };

    return (
      <section className={store.section} dir={locale === "en" ? "ltr" : "rtl"} aria-labelledby={headingId}>
        <h2 id={headingId} className="sr-only">{c.title}</h2>
        <div className={store.layout} data-composer={composerOpen ? "open" : "closed"}>
          <aside className={store.summary} aria-label={c.title}>
            <div className={store.summaryScore}>
              <strong>{loading && !items.length ? "…" : countDisplay}</strong>
              <span>{productCopy.countLabel}</span>
            </div>
            <p className={store.summaryHint}>{productCopy.ctaPrompt}</p>
            {ready && canPost ? (
              <>
                {!composerOpen ? (
                  <button className={store.cta} type="button" onClick={openComposer}>{c.submit}</button>
                ) : null}
                {composerOpen ? (
                  <form id={composerFormId} className={store.composer} onSubmit={submit}>
                    {composerFields}
                    <button className={store.submit} type="submit" disabled={submitDisabled}>{sending ? c.sending : c.submit}</button>
                  </form>
                ) : null}
              </>
            ) : ready && !user ? (
              <Link className={store.cta} href={`/${locale}/login` as Route}>{c.signIn}</Link>
            ) : ready && policy === "purchasers" && user?.role === "buyer" ? (
              <p className={store.gate}>{c.purchase}</p>
            ) : null}
          </aside>

          <div className={store.listColumn}>
            {error ? <p className={store.error} role="alert">{error}</p> : null}
            {message ? <p className={store.success} role="status">{message}</p> : null}
            {!loading && !items.length ? <p className={store.empty}>{c.empty}</p> : (
              <div className={store.list}>
                {items.map((item) => (
                  <article className={store.item} key={item.id}>
                    <div className={store.itemHeader}>
                      <div className={store.author}>
                        <CommentAvatar />
                        <span className={store.authorName}>{item.authorName}</span>
                        {showBuyerBadge ? <span className={store.buyer}>{productCopy.buyer}</span> : null}
                      </div>
                      <time className={store.date} dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleDateString(locale)}</time>
                    </div>
                    <ExpandableBody text={item.body} expandLabel={productCopy.expand} collapseLabel={productCopy.collapse} />
                    {item.replies.map((reply, index) => (
                      <div className={store.reply} key={index}>
                        <strong>{c.reply} · {reply.authorName ?? reply.sellerName}</strong>
                        <p>{reply.body}</p>
                      </div>
                    ))}
                  </article>
                ))}
              </div>
            )}
            {cursor && !loading ? <button className={store.more} type="button" onClick={() => void load(cursor)}>{c.more}</button> : null}
          </div>
        </div>
      </section>
    );
  }

  return <section className={styles.section} dir={locale === "en" ? "ltr" : "rtl"} aria-labelledby={headingId}>
    <header className={styles.header}><h2 id={headingId}>{c.title}</h2><p>{c.intro}</p></header>
    {ready && canPost ? <form className={styles.card} onSubmit={submit}>
      {composerFields}
      <div><button className={styles.primary} type="submit" disabled={submitDisabled}>{sending ? c.sending : c.submit}</button></div>
    </form> : ready && !user ? <p><Link href={`/${locale}/login` as Route}>{c.signIn}</Link></p> : null}
    {error ? <p className={styles.error} role="alert">{error}</p> : null}{message ? <p className={styles.success} role="status">{message}</p> : null}
    {!loading && !items.length ? <p className={styles.empty}>{c.empty}</p> : <div className={styles.list}>{items.map((item) => <article className={styles.card} key={item.id}><div className={styles.meta}><strong>{item.authorName}</strong><time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleDateString(locale)}</time></div><p>{item.body}</p>{item.replies.map((reply, index) => <div className={styles.reply} key={index}><strong>{c.reply} · {reply.authorName ?? reply.sellerName}</strong><p>{reply.body}</p></div>)}</article>)}</div>}
    {cursor && !loading ? <button className={styles.more} type="button" onClick={() => void load(cursor)}>{c.more}</button> : null}
  </section>;
}
