"use client";

import axios from "axios";
import { useState, type FormEvent } from "react";
import type { AppUser } from "@topgsm/shared-types";
import { api } from "@/lib/api/client";
import type { Locale } from "@/lib/i18n";
import styles from "./AccountSettings.module.css";

const COPY = {
  en: { title: "Personal details", name: "Full name", email: "Email", username: "Username", usernameHint: "3–32 lowercase letters, numbers, or underscores. You can leave it empty if you don't have one.", save: "Save changes", saving: "Saving…", saved: "Your account details were saved.", error: "Could not save your details. Please try again.", conflict: "That email or username is already in use.", invalidEmail: "Enter an email to replace the current one.", invalidUsername: "Your username cannot be empty. Use 3–32 lowercase letters, numbers, or underscores.", limited: "Too many changes. Please try again later." },
  fa: { title: "اطلاعات شخصی", name: "نام و نام خانوادگی", email: "ایمیل", username: "نام کاربری", usernameHint: "۳ تا ۳۲ حرف انگلیسی کوچک، عدد یا زیرخط. اگر نام کاربری ندارید، خالی بگذارید.", save: "ذخیره تغییرات", saving: "در حال ذخیره…", saved: "اطلاعات حساب شما ذخیره شد.", error: "اطلاعات ذخیره نشد. دوباره تلاش کنید.", conflict: "این ایمیل یا نام کاربری قبلاً ثبت شده است.", invalidEmail: "برای تغییر ایمیل، ایمیل جدیدی وارد کنید.", invalidUsername: "نام کاربری نمی‌تواند خالی باشد. از ۳ تا ۳۲ حرف انگلیسی کوچک، عدد یا زیرخط استفاده کنید.", limited: "تعداد تغییرات زیاد بود. کمی بعد دوباره تلاش کنید." },
  ar: { title: "البيانات الشخصية", name: "الاسم الكامل", email: "البريد الإلكتروني", username: "اسم المستخدم", usernameHint: "من 3 إلى 32 حرفًا إنجليزيًا صغيرًا أو رقمًا أو شرطة سفلية. اتركه فارغًا إذا لم يكن لديك اسم مستخدم.", save: "حفظ التغييرات", saving: "جارٍ الحفظ…", saved: "تم حفظ بيانات حسابك.", error: "تعذر حفظ البيانات. حاول مجددًا.", conflict: "البريد الإلكتروني أو اسم المستخدم مستخدم بالفعل.", invalidEmail: "أدخل بريدًا جديدًا لتغيير البريد الحالي.", invalidUsername: "لا يمكن ترك اسم المستخدم فارغًا. استخدم 3 إلى 32 حرفًا إنجليزيًا صغيرًا أو رقمًا أو شرطة سفلية.", limited: "أُجريت تغييرات كثيرة. حاول مجددًا لاحقًا." }
} as const;

export function AccountSettings({ locale, user, onUpdated }: { locale: Locale; user: AppUser; onUpdated: (user: AppUser) => void }) {
  const c = COPY[locale];
  const [name, setName] = useState(user.fullName);
  const [email, setEmail] = useState(user.email ?? "");
  const [username, setUsername] = useState(user.username ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
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

  return <section className={styles.card} aria-labelledby="personal-details">
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
  </section>;
}
