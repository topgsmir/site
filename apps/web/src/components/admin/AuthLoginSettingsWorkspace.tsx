"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import type { AdminAuthLoginSettings } from "@topgsm/shared-types";
import type { Locale } from "@/lib/i18n";
import { api } from "@/lib/api/client";
import styles from "./SmsSettingsWorkspace.module.css";

const copy = {
  en: { eyebrow: "Security / Sign in", title: "Sign in methods", intro: "Choose which ways people can sign in. Keep at least one method available.", email: "Email and password", emailHint: "Also controls username and password sign in and email registration. Admins and sellers need this method for new sessions; existing sessions stay active.", phone: "Phone and SMS code", phoneHint: "Lets buyers sign in using a one time code, including during checkout. SMS and OTP must also be configured and enabled.", enabled: "Enabled", disabled: "Disabled", save: "Save sign in settings", saving: "Saving…", saved: "Sign in settings saved.", noChanges: "No unsaved changes", loadError: "Sign in settings could not be loaded.", saveError: "Sign in settings could not be saved.", oneRequired: "Keep at least one sign in method enabled.", retry: "Try again" },
  fa: { eyebrow: "امنیت / ورود", title: "روش‌های ورود", intro: "روش‌های ورود به حساب را انتخاب کنید. دست‌کم یک روش باید فعال بماند.", email: "ایمیل و رمز عبور", emailHint: "ورود با نام کاربری و رمز عبور و ثبت‌نام ایمیلی را نیز کنترل می‌کند. مدیران و فروشندگان برای ورود دوباره به این روش نیاز دارند؛ نشست‌های فعلی فعال می‌مانند.", phone: "شماره موبایل و کد پیامکی", phoneHint: "خریداران می‌توانند با کد یک‌بارمصرف، از جمله هنگام تسویه‌حساب، وارد شوند. تنظیمات پیامک و کد تأیید نیز باید فعال باشند.", enabled: "فعال", disabled: "غیرفعال", save: "ذخیره تنظیمات ورود", saving: "در حال ذخیره…", saved: "تنظیمات ورود ذخیره شد.", noChanges: "تغییری ثبت نشده است", loadError: "دریافت تنظیمات ورود انجام نشد.", saveError: "ذخیره تنظیمات ورود انجام نشد.", oneRequired: "دست‌کم یک روش ورود را فعال نگه دارید.", retry: "تلاش دوباره" },
  ar: { eyebrow: "الأمان / الدخول", title: "طرق تسجيل الدخول", intro: "اختر طرق تسجيل الدخول. يجب إبقاء طريقة واحدة على الأقل مفعلة.", email: "البريد الإلكتروني وكلمة المرور", emailHint: "يتحكم أيضًا بالدخول باسم المستخدم وكلمة المرور والتسجيل بالبريد. يحتاج المديرون والبائعون هذه الطريقة للجلسات الجديدة؛ تبقى الجلسات الحالية نشطة.", phone: "الهاتف ورمز الرسالة", phoneHint: "يمكن للمشترين الدخول برمز لمرة واحدة، بما في ذلك أثناء الدفع. يجب أيضًا تفعيل إعدادات الرسائل والرموز.", enabled: "مفعل", disabled: "معطل", save: "حفظ إعدادات الدخول", saving: "جارٍ الحفظ…", saved: "تم حفظ إعدادات الدخول.", noChanges: "لا توجد تغييرات", loadError: "تعذر تحميل إعدادات الدخول.", saveError: "تعذر حفظ إعدادات الدخول.", oneRequired: "أبقِ طريقة دخول واحدة على الأقل مفعلة.", retry: "إعادة المحاولة" }
} as const;

export function AuthLoginSettingsWorkspace({ locale }: { locale: Locale }) {
  const c = copy[locale];
  const [saved, setSaved] = useState<AdminAuthLoginSettings | null>(null);
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [phoneEnabled, setPhoneEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await api.get<AdminAuthLoginSettings>("/admin/settings/auth");
      setSaved(response.data); setEmailEnabled(response.data.emailPasswordEnabled); setPhoneEnabled(response.data.phoneOtpEnabled);
    } catch { setError(c.loadError); }
    finally { setLoading(false); }
  }, [c.loadError]);

  useEffect(() => { void load(); }, [load]);
  const dirty = saved !== null && (saved.emailPasswordEnabled !== emailEnabled || saved.phoneOtpEnabled !== phoneEnabled);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dirty) return;
    if (!emailEnabled && !phoneEnabled) { setError(c.oneRequired); return; }
    setSaving(true); setError(""); setMessage("");
    try {
      const response = await api.patch<AdminAuthLoginSettings>("/admin/settings/auth", { emailPasswordEnabled: emailEnabled, phoneOtpEnabled: phoneEnabled });
      setSaved(response.data); setEmailEnabled(response.data.emailPasswordEnabled); setPhoneEnabled(response.data.phoneOtpEnabled); setMessage(c.saved);
    } catch { setError(c.saveError); }
    finally { setSaving(false); }
  }

  return <section className={styles.workspace} aria-labelledby="auth-settings-title">
    <header className={styles.header}><span>{c.eyebrow}</span><h1 id="auth-settings-title">{c.title}</h1><p>{c.intro}</p></header>
    {loading ? <div className={styles.skeleton} aria-busy="true"><i /><i /></div> : error && !saved ?
      <div className={styles.error} role="alert"><p>{error}</p><button type="button" onClick={() => void load()}>{c.retry}</button></div> :
      <form className={styles.form} onSubmit={submit}>
        {([["email", c.email, c.emailHint, emailEnabled, setEmailEnabled], ["phone", c.phone, c.phoneHint, phoneEnabled, setPhoneEnabled]] as const).map(([key, title, hint, enabled, setter]) =>
          <div className={styles.settingRow} key={key}><div><h2>{title}</h2><p>{hint}</p><strong data-enabled={enabled}>{enabled ? c.enabled : c.disabled}</strong></div><label className={styles.toggle}><span className={styles.visuallyHidden}>{title}</span><input type="checkbox" checked={enabled} disabled={saving} onChange={(event) => { setter(event.target.checked); setError(""); setMessage(""); }} /><span aria-hidden="true"><i /></span></label></div>
        )}
        {!emailEnabled && !phoneEnabled ? <p className={styles.warning}>{c.oneRequired}</p> : null}
        <footer className={styles.actions}><div aria-live="polite">{error ? <span className={styles.errorText}>{error}</span> : message ? <span className={styles.success}>{message}</span> : !dirty ? <span>{c.noChanges}</span> : null}</div><button type="submit" disabled={!dirty || saving || (!emailEnabled && !phoneEnabled)}>{saving ? c.saving : c.save}</button></footer>
      </form>}
  </section>;
}
