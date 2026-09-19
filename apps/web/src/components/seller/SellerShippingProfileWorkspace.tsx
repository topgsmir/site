"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { SellerShippingProfile } from "@topgsm/shared-types";
import type { Locale } from "@/lib/i18n";
import { api } from "@/lib/api/client";
import styles from "./SellerShippingProfileWorkspace.module.css";

const copy = {
  en: { eyebrow: "Fulfilment / Sender", title: "Shipping profile", intro: "Use the sender details and origin address that belong to your shop. These details are reviewed by the platform and used for physical-order fulfilment.", enabled: "Enable Amadast shipping", enabledHint: "Registration becomes available after this complete profile is enabled and the platform connection is active.", senderName: "Sender name", senderMobile: "Sender mobile", province: "Province", city: "City", address: "Origin address", postalCode: "Postal code", save: "Save shipping profile", saving: "Saving…", saved: "Shipping profile saved.", loadError: "Your shipping profile could not be loaded.", saveError: "Your shipping profile could not be saved. Check the address and phone number.", retry: "Try again", grant: "Physical-product access is granted by the platform." },
  fa: { eyebrow: "ارسال / فرستنده", title: "پروفایل ارسال", intro: "مشخصات فرستنده و نشانی مبدأ متعلق به فروشگاه خود را وارد کنید. پلتفرم این اطلاعات را بررسی می‌کند و برای ارسال سفارش فیزیکی به‌کار می‌برد.", enabled: "فعال‌سازی ارسال با آمادست", enabledHint: "پس از تکمیل و فعال‌سازی این پروفایل و اتصال پلتفرم، ثبت ارسال در دسترس خواهد بود.", senderName: "نام فرستنده", senderMobile: "موبایل فرستنده", province: "استان", city: "شهر", address: "نشانی مبدأ", postalCode: "کد پستی", save: "ذخیره پروفایل ارسال", saving: "در حال ذخیره…", saved: "پروفایل ارسال ذخیره شد.", loadError: "پروفایل ارسال شما بارگذاری نشد.", saveError: "پروفایل ارسال ذخیره نشد. نشانی و شماره تماس را بررسی کنید.", retry: "تلاش دوباره", grant: "مجوز محصول فیزیکی توسط پلتفرم برای شما فعال شده است." },
  ar: { eyebrow: "الشحن / المرسل", title: "ملف الشحن", intro: "أدخل بيانات المرسل وعنوان المنشأ الخاص بمتجرك. تراجع المنصة هذه البيانات وتستخدمها لتنفيذ طلبات المنتجات المادية.", enabled: "تفعيل الشحن عبر Amadast", enabledHint: "يصبح تسجيل الشحنة متاحاً بعد إكمال هذا الملف وتفعيله وتفعيل اتصال المنصة.", senderName: "اسم المرسل", senderMobile: "جوال المرسل", province: "المحافظة", city: "المدينة", address: "عنوان المنشأ", postalCode: "الرمز البريدي", save: "حفظ ملف الشحن", saving: "جارٍ الحفظ…", saved: "تم حفظ ملف الشحن.", loadError: "تعذر تحميل ملف الشحن.", saveError: "تعذر حفظ ملف الشحن. تحقق من العنوان ورقم الجوال.", retry: "حاول مجدداً", grant: "منحتك المنصة صلاحية المنتجات المادية." }
} as const;

type Draft = { enabled: boolean; senderName: string; senderMobile: string; province: string; city: string; addressLine: string; postalCode: string };
const empty: Draft = { enabled: false, senderName: "", senderMobile: "", province: "", city: "", addressLine: "", postalCode: "" };
const fromProfile = (profile: SellerShippingProfile): Draft => ({ enabled: profile.enabled, senderName: profile.senderName ?? "", senderMobile: profile.senderMobile ?? "", province: profile.province ?? "", city: profile.city ?? "", addressLine: profile.addressLine ?? "", postalCode: profile.postalCode ?? "" });

export function SellerShippingProfileWorkspace({ locale }: { locale: Locale }) {
  const c = copy[locale];
  const [draft, setDraft] = useState<Draft>(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { const response = await api.get<SellerShippingProfile>("/shipping/profile"); setDraft(fromProfile(response.data)); }
    catch { setError(c.loadError); }
    finally { setLoading(false); }
  }, [c.loadError]);
  useEffect(() => { void load(); }, [load]);

  const change = <K extends keyof Draft>(key: K, value: Draft[K]) => { setDraft((current) => ({ ...current, [key]: value })); setMessage(""); setError(""); };
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(""); setMessage("");
    try { const response = await api.patch<SellerShippingProfile>("/shipping/profile", draft); setDraft(fromProfile(response.data)); setMessage(c.saved); }
    catch { setError(c.saveError); }
    finally { setSaving(false); }
  }

  return <section className={styles.workspace} aria-labelledby="seller-shipping-title">
    <header><span>{c.eyebrow}</span><h1 id="seller-shipping-title">{c.title}</h1><p>{c.intro}</p><small>{c.grant}</small></header>
    {loading ? <div className={styles.loading} aria-busy="true" /> : error && !draft.senderName ? <div className={styles.error} role="alert"><p>{error}</p><button type="button" onClick={() => void load()}>{c.retry}</button></div> : <form onSubmit={submit}>
      <label className={styles.toggle}><input type="checkbox" checked={draft.enabled} disabled={saving} onChange={(event) => change("enabled", event.target.checked)} /><span><strong>{c.enabled}</strong><small>{c.enabledHint}</small></span></label>
      <div className={styles.grid}>{([[
        "senderName", c.senderName, "text", ""
      ], ["senderMobile", c.senderMobile, "tel", "09xxxxxxxxx"], ["province", c.province, "text", ""], ["city", c.city, "text", ""], ["postalCode", c.postalCode, "text", "0000000000"]] as const).map(([key, label, type, placeholder]) => <label key={key}><span>{label}</span><input required type={type} placeholder={placeholder} value={draft[key]} minLength={key === "senderName" || key === "province" || key === "city" ? 2 : undefined} maxLength={key === "senderName" ? 200 : key === "province" || key === "city" ? 100 : key === "postalCode" ? 10 : 16} pattern={key === "postalCode" ? "[0-9]{10}" : undefined} disabled={saving} onChange={(event) => change(key, event.target.value)} /></label>)}</div>
      <label><span>{c.address}</span><textarea required minLength={5} maxLength={500} value={draft.addressLine} disabled={saving} onChange={(event) => change("addressLine", event.target.value)} /></label>
      <footer><span aria-live="polite" data-error={Boolean(error)}>{error || message}</span><button type="submit" disabled={saving}>{saving ? c.saving : c.save}</button></footer>
    </form>}
  </section>;
}
