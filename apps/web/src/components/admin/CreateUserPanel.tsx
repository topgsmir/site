"use client";

import { useState, type FormEvent } from "react";
import axios from "axios";
import type { AdminUserSummary } from "@topgsm/shared-types";
import type { Locale } from "@/lib/i18n";
import { api } from "@/lib/api/client";
import styles from "./UsersWorkspace.module.css";

const copy = {
  en: { title: "Create buyer", note: "Create a buyer account with an initial password. Seller and staff access is managed through invitations.", fullName: "Full name", email: "Email", username: "Username (optional)", phoneNumber: "Mobile number (optional)", password: "Initial password", passwordHint: "At least 12 characters. Share it with the user through a secure channel.", submit: "Create account", saving: "Creating…", cancel: "Cancel", duplicate: "This email, username, or mobile number is already in use.", error: "Account could not be created. Check the details and try again." },
  fa: { title: "ایجاد خریدار", note: "حساب خریدار را با رمز اولیه بسازید. دسترسی فروشنده و همکاران از بخش دعوت‌نامه‌ها مدیریت می‌شود.", fullName: "نام و نام خانوادگی", email: "ایمیل", username: "نام کاربری (اختیاری)", phoneNumber: "شماره موبایل (اختیاری)", password: "رمز اولیه", passwordHint: "حداقل ۱۲ نویسه. رمز را از راهی امن به کاربر برسانید.", submit: "ایجاد حساب", saving: "در حال ایجاد…", cancel: "انصراف", duplicate: "این ایمیل، نام کاربری یا شماره موبایل قبلاً ثبت شده است.", error: "حساب ایجاد نشد. اطلاعات را بررسی کنید و دوباره تلاش کنید." },
  ar: { title: "إنشاء مشترٍ", note: "أنشئ حساب مشتري بكلمة مرور أولية. تُدار صلاحيات البائع والموظفين عبر الدعوات.", fullName: "الاسم الكامل", email: "البريد الإلكتروني", username: "اسم المستخدم (اختياري)", phoneNumber: "رقم الهاتف (اختياري)", password: "كلمة المرور الأولية", passwordHint: "12 حرفاً على الأقل. أرسلها إلى المستخدم عبر قناة آمنة.", submit: "إنشاء الحساب", saving: "جارٍ الإنشاء…", cancel: "إلغاء", duplicate: "هذا البريد أو اسم المستخدم أو رقم الهاتف مستخدم بالفعل.", error: "تعذر إنشاء الحساب. راجع البيانات وحاول مجدداً." }
} as const;

export function CreateUserPanel({ locale, onCreated, onCancel }: { locale: Locale; onCreated: (user: AdminUserSummary) => void; onCancel: () => void }) {
  const c = copy[locale];
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      const response = await api.post<AdminUserSummary>("/admin/users", {
        fullName: String(data.get("fullName") ?? "").trim(),
        email: String(data.get("email") ?? "").trim(),
        username: String(data.get("username") ?? "").trim() || undefined,
        phoneNumber: String(data.get("phoneNumber") ?? "").trim() || undefined,
        password: String(data.get("password") ?? "")
      });
      form.reset();
      onCreated(response.data);
    } catch (requestError) {
      setError(axios.isAxiosError(requestError) && requestError.response?.status === 409 ? c.duplicate : c.error);
    } finally {
      setBusy(false);
    }
  }

  return <section className={styles.createPanel} aria-labelledby="create-buyer-title">
    <div><h2 id="create-buyer-title">{c.title}</h2><p>{c.note}</p></div>
    <form onSubmit={(event) => void submit(event)}>
      <div className={styles.createFields}>
        <label><span>{c.fullName}</span><input name="fullName" required minLength={2} maxLength={100} autoComplete="name" /></label>
        <label><span>{c.email}</span><input name="email" type="email" required maxLength={254} autoComplete="email" dir="ltr" /></label>
        <label><span>{c.username}</span><input name="username" minLength={3} maxLength={32} pattern="[a-z0-9_]+" autoComplete="off" dir="ltr" /></label>
        <label><span>{c.phoneNumber}</span><input name="phoneNumber" type="tel" autoComplete="tel" dir="ltr" /><small>{locale === "fa" ? "شماره تا تأیید خریدار برای ورود فعال نمی‌شود." : locale === "ar" ? "لن يُفعّل الرقم لتسجيل الدخول حتى يؤكده المشتري." : "The buyer must confirm this number before it can be used to sign in."}</small></label>
        <label><span>{c.password}</span><input name="password" type="password" required minLength={12} maxLength={128} autoComplete="new-password" aria-describedby="initial-password-hint" /></label>
      </div>
      <p id="initial-password-hint" className={styles.createHint}>{c.passwordHint}</p>
      {error ? <p className={styles.createError} role="alert">{error}</p> : null}
      <div className={styles.createActions}><button className={styles.primary} type="submit" disabled={busy}>{busy ? c.saving : c.submit}</button><button className={styles.secondaryButton} type="button" onClick={onCancel} disabled={busy}>{c.cancel}</button></div>
    </form>
  </section>;
}
