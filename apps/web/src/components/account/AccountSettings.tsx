"use client";

import axios from "axios";
import { useEffect, useState, type FormEvent } from "react";
import type { AppUser } from "@topgsm/shared-types";
import { api } from "@/lib/api/client";
import type { Locale } from "@/lib/i18n";
import styles from "./AccountSettings.module.css";

const COPY = {
  en: { title: "Personal details", name: "Full name", email: "Email", username: "Username", usernameHint: "3–32 lowercase letters, numbers, or underscores. You can leave it empty if you don't have one.", save: "Save changes", saving: "Saving…", saved: "Your account details were saved.", error: "Could not save your details. Please try again.", conflict: "That email or username is already in use.", invalidEmail: "Enter an email to replace the current one.", invalidUsername: "Your username cannot be empty. Use 3–32 lowercase letters, numbers, or underscores.", limited: "Too many changes. Please try again later." },
  fa: { title: "اطلاعات شخصی", name: "نام و نام خانوادگی", email: "ایمیل", username: "نام کاربری", usernameHint: "۳ تا ۳۲ حرف انگلیسی کوچک، عدد یا زیرخط. اگر نام کاربری ندارید، خالی بگذارید.", save: "ذخیره تغییرات", saving: "در حال ذخیره…", saved: "اطلاعات حساب شما ذخیره شد.", error: "اطلاعات ذخیره نشد. دوباره تلاش کنید.", conflict: "این ایمیل یا نام کاربری قبلاً ثبت شده است.", invalidEmail: "برای تغییر ایمیل، ایمیل جدیدی وارد کنید.", invalidUsername: "نام کاربری نمی‌تواند خالی باشد. از ۳ تا ۳۲ حرف انگلیسی کوچک، عدد یا زیرخط استفاده کنید.", limited: "تعداد تغییرات زیاد بود. کمی بعد دوباره تلاش کنید." },
  ar: { title: "البيانات الشخصية", name: "الاسم الكامل", email: "البريد الإلكتروني", username: "اسم المستخدم", usernameHint: "من 3 إلى 32 حرفًا إنجليزيًا صغيرًا أو رقمًا أو شرطة سفلية. اتركه فارغًا إذا لم يكن لديك اسم مستخدم.", save: "حفظ التغييرات", saving: "جارٍ الحفظ…", saved: "تم حفظ بيانات حسابك.", error: "تعذر حفظ البيانات. حاول مجددًا.", conflict: "البريد الإلكتروني أو اسم المستخدم مستخدم بالفعل.", invalidEmail: "أدخل بريدًا جديدًا لتغيير البريد الحالي.", invalidUsername: "لا يمكن ترك اسم المستخدم فارغًا. استخدم 3 إلى 32 حرفًا إنجليزيًا صغيرًا أو رقمًا أو شرطة سفلية.", limited: "أُجريت تغييرات كثيرة. حاول مجددًا لاحقًا." }
} as const;

const PHONE_COPY = {
  en: { title: "Confirm your mobile number", pending: "An administrator added this number. Confirm it to use it for sign-in and account messages.", send: "Send verification code", sent: "A code was sent to your phone.", code: "Six-digit code", confirm: "Confirm number", done: "Your mobile number is confirmed.", error: "Could not verify the number. Check the code or try again.", busy: "Please wait…" },
  fa: { title: "تأیید شماره موبایل", pending: "مدیر این شماره را ثبت کرده است. برای ورود و دریافت پیام‌های حساب، آن را تأیید کنید.", send: "ارسال کد تأیید", sent: "کد برای شماره شما ارسال شد.", code: "کد شش‌رقمی", confirm: "تأیید شماره", done: "شماره موبایل شما تأیید شد.", error: "شماره تأیید نشد. کد را بررسی کنید یا دوباره تلاش کنید.", busy: "لطفاً صبر کنید…" },
  ar: { title: "تأكيد رقم الهاتف", pending: "أضاف المدير هذا الرقم. أكده لاستخدامه لتسجيل الدخول ورسائل الحساب.", send: "إرسال رمز التأكيد", sent: "أُرسل الرمز إلى هاتفك.", code: "الرمز المكون من ستة أرقام", confirm: "تأكيد الرقم", done: "تم تأكيد رقم هاتفك.", error: "تعذر تأكيد الرقم. تحقق من الرمز أو حاول مرة أخرى.", busy: "يرجى الانتظار…" }
} as const;

export function AccountSettings({ locale, user, onUpdated }: { locale: Locale; user: AppUser; onUpdated: (user: AppUser) => void }) {
  const c = COPY[locale];
  const [name, setName] = useState(user.fullName);
  const [email, setEmail] = useState(user.email ?? "");
  const [username, setUsername] = useState(user.username ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pendingPhone, setPendingPhone] = useState<string | null>(null);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [phoneCode, setPhoneCode] = useState("");
  const [phoneBusy, setPhoneBusy] = useState(false);
  const [phoneStatus, setPhoneStatus] = useState("");
  const pc = PHONE_COPY[locale];
  useEffect(() => {
    if (user.role !== "buyer") return;
    const controller = new AbortController();
    void api.get<{ pendingPhoneNumber: string | null }>("/auth/otp/pending-phone", { signal: controller.signal })
      .then(({ data }) => setPendingPhone(data.pendingPhoneNumber))
      .catch(() => undefined);
    return () => controller.abort();
  }, [user.role]);

  async function requestPhoneCode() {
    setPhoneBusy(true);
    setPhoneStatus("");
    try {
      const { data } = await api.post<{ challengeId: string }>("/auth/otp/request-pending-phone");
      setChallengeId(data.challengeId);
      setPhoneStatus(pc.sent);
    } catch { setPhoneStatus(pc.error); }
    finally { setPhoneBusy(false); }
  }

  async function confirmPhone(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pendingPhone || !challengeId) return;
    setPhoneBusy(true);
    setPhoneStatus("");
    try {
      await api.post("/auth/otp/confirm-pending-phone", { phoneNumber: pendingPhone, challengeId, code: phoneCode });
      setPendingPhone(null);
      setChallengeId(null);
      setPhoneCode("");
      setPhoneStatus(pc.done);
    } catch { setPhoneStatus(pc.error); }
    finally { setPhoneBusy(false); }
  }
  const dirty = name.trim() !== user.fullName || email.trim().toLowerCase() !== (user.email ?? "") || username.trim() !== (user.username ?? "");

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    const nextName = name.trim();
    const nextEmail = email.trim().toLowerCase();
    const nextUsername = username.trim();
    if (user.email && !nextEmail) { setError(c.invalidEmail); return; }
    if (user.username && !nextUsername) { setError(c.invalidUsername); return; }
    const updates = {
      ...(nextName !== user.fullName ? { fullName: nextName } : {}),
      ...(nextEmail && nextEmail !== user.email ? { email: nextEmail } : {}),
      ...(nextUsername && nextUsername !== user.username ? { username: nextUsername } : {})
    };
    if (!Object.keys(updates).length) return;
    setSaving(true);
    try {
      const response = await api.patch<AppUser>("/auth/me", updates);
      onUpdated(response.data);
      setName(response.data.fullName);
      setEmail(response.data.email ?? "");
      setUsername(response.data.username ?? "");
      setMessage(c.saved);
    } catch (cause) {
      const status = axios.isAxiosError(cause) ? cause.response?.status : undefined;
      setError(status === 409 ? c.conflict : status === 429 ? c.limited : c.error);
    } finally {
      setSaving(false);
    }
  }

  return <><section className={styles.card} aria-labelledby="personal-details">
    <h2 id="personal-details">{c.title}</h2>
    <form onSubmit={(event) => void save(event)}>
      <div className={styles.field}><label htmlFor="profile-name">{c.name}</label>
      <input id="profile-name" name="fullName" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" minLength={2} maxLength={100} required disabled={saving} /></div>
      <div className={styles.field}><label htmlFor="profile-email">{c.email}</label>
      <input id="profile-email" name="email" type="email" dir="ltr" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" maxLength={254} disabled={saving} /></div>
      <div className={styles.field}><label htmlFor="profile-username">{c.username}</label>
      <div><input id="profile-username" name="username" dir="ltr" value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" pattern="[a-z0-9_]{3,32}" aria-describedby="profile-username-hint" disabled={saving} />
      <p id="profile-username-hint" className={styles.hint}>{c.usernameHint}</p></div></div>
      {error ? <p className={styles.error} role="alert">{error}</p> : null}
      {message ? <p className={styles.success} role="status">{message}</p> : null}
      <div className={styles.actions}><button type="submit" disabled={saving || !dirty}>{saving ? c.saving : c.save}</button></div>
    </form>
  </section>
  {pendingPhone ? <section className={styles.card} aria-labelledby="pending-phone-title">
    <h2 id="pending-phone-title">{pc.title}</h2>
    <p>{pc.pending}</p>
    <p dir="ltr">{pendingPhone}</p>
    {!challengeId ? <div className={styles.actions}><button type="button" disabled={phoneBusy} onClick={() => void requestPhoneCode()}>{phoneBusy ? pc.busy : pc.send}</button></div> :
      <form onSubmit={(event) => void confirmPhone(event)}>
        <div className={styles.field}><label htmlFor="pending-phone-code">{pc.code}</label>
          <input id="pending-phone-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} minLength={6} required autoComplete="one-time-code" dir="ltr" value={phoneCode} onChange={(event) => setPhoneCode(event.target.value.replace(/\D/g, "").slice(0, 6))} disabled={phoneBusy} /></div>
        <div className={styles.actions}><button type="submit" disabled={phoneBusy || phoneCode.length !== 6}>{phoneBusy ? pc.busy : pc.confirm}</button></div>
      </form>}
    {phoneStatus ? <p role="status">{phoneStatus}</p> : null}
  </section> : phoneStatus ? <p role="status">{phoneStatus}</p> : null}</>;
}
