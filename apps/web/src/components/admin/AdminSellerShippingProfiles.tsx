"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { AdminSellerShippingProfile, AdminSellerShippingProfilesPage } from "@topgsm/shared-types";
import type { Locale } from "@/lib/i18n";
import { api } from "@/lib/api/client";
import { CollapsibleFilters } from "@/components/dashboard/CollapsibleFilters";
import styles from "./SmsSettingsWorkspace.module.css";

const copy = {
  en: {
    title: "Seller sender profiles", intro: "Sellers granted physical-product access manage their own sender identity and origin address. Platform admins can review and correct every profile.",
    search: "Search shop, owner, or email…", noResults: "No sellers match this search.", granted: "Physical products granted", notGranted: "Physical products not granted", ready: "Profile ready", incomplete: "Profile incomplete", enabled: "Shipping enabled", disabled: "Shipping disabled",
    manage: "Manage profile", close: "Close", senderName: "Sender name", senderMobile: "Sender mobile", province: "Province", city: "City", address: "Origin address", postalCode: "Postal code", save: "Save seller profile", saving: "Saving…", saved: "Seller shipping profile saved.", loadError: "Seller profiles could not be loaded.", saveError: "The seller profile could not be saved.", grantHint: "Grant “Sell physical products” in Vendors before enabling this profile.", loadMore: "Load more"
  },
  fa: {
    title: "پروفایل فرستنده فروشندگان", intro: "فروشنده‌ای که مجوز محصول فیزیکی دارد، مشخصات فرستنده و نشانی مبدأ خود را مدیریت می‌کند. مدیر پلتفرم می‌تواند همه پروفایل‌ها را ببیند و اصلاح کند.",
    search: "جست‌وجوی فروشگاه، مالک یا ایمیل…", noResults: "فروشنده‌ای با این جست‌وجو پیدا نشد.", granted: "مجوز محصول فیزیکی دارد", notGranted: "مجوز محصول فیزیکی ندارد", ready: "پروفایل کامل", incomplete: "پروفایل تکمیل نشده", enabled: "ارسال فعال", disabled: "ارسال غیرفعال",
    manage: "مدیریت پروفایل", close: "بستن", senderName: "نام فرستنده", senderMobile: "موبایل فرستنده", province: "استان", city: "شهر", address: "نشانی مبدأ", postalCode: "کد پستی", save: "ذخیره پروفایل فروشنده", saving: "در حال ذخیره…", saved: "پروفایل ارسال فروشنده ذخیره شد.", loadError: "پروفایل‌های فروشندگان بارگذاری نشد.", saveError: "ذخیره پروفایل فروشنده انجام نشد.", grantHint: "پیش از فعال‌سازی، دسترسی «فروش محصولات فیزیکی» را در بخش فروشندگان اعطا کنید.", loadMore: "نمایش بیشتر"
  },
  ar: {
    title: "ملفات مرسلي البائعين", intro: "يدير البائع الممنوح صلاحية المنتجات المادية هوية المرسل وعنوان المنشأ. يمكن لمسؤولي المنصة مراجعة جميع الملفات وتصحيحها.",
    search: "ابحث عن المتجر أو المالك أو البريد…", noResults: "لا يوجد بائعون مطابقون.", granted: "صلاحية المنتجات المادية ممنوحة", notGranted: "صلاحية المنتجات المادية غير ممنوحة", ready: "الملف مكتمل", incomplete: "الملف غير مكتمل", enabled: "الشحن مفعّل", disabled: "الشحن معطّل",
    manage: "إدارة الملف", close: "إغلاق", senderName: "اسم المرسل", senderMobile: "جوال المرسل", province: "المحافظة", city: "المدينة", address: "عنوان المنشأ", postalCode: "الرمز البريدي", save: "حفظ ملف البائع", saving: "جارٍ الحفظ…", saved: "تم حفظ ملف شحن البائع.", loadError: "تعذر تحميل ملفات البائعين.", saveError: "تعذر حفظ ملف البائع.", grantHint: "امنح صلاحية «بيع المنتجات المادية» في قسم البائعين قبل تفعيل الملف.", loadMore: "تحميل المزيد"
  }
} as const;

type Draft = { enabled: boolean; senderName: string; senderMobile: string; province: string; city: string; addressLine: string; postalCode: string };
const draftFrom = (profile: AdminSellerShippingProfile): Draft => ({
  enabled: profile.enabled,
  senderName: profile.senderName ?? profile.shopName,
  senderMobile: profile.senderMobile ?? "",
  province: profile.province ?? "",
  city: profile.city ?? "",
  addressLine: profile.addressLine ?? "",
  postalCode: profile.postalCode ?? ""
});

export function AdminSellerShippingProfiles({ locale }: { locale: Locale }) {
  const c = copy[locale];
  const [items, setItems] = useState<AdminSellerShippingProfile[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<AdminSellerShippingProfile | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async (cursor?: string, append = false) => {
    setLoading(true); setError("");
    try {
      const response = await api.get<AdminSellerShippingProfilesPage>("/admin/settings/shipping/profiles", { params: { limit: 50, ...(cursor ? { cursor } : {}), ...(search.trim() ? { search: search.trim() } : {}) } });
      setItems((current) => append ? [...current, ...response.data.items] : response.data.items);
      setNextCursor(response.data.nextCursor);
    } catch { setError(c.loadError); } finally { setLoading(false); }
  }, [c.loadError, search]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 250);
    return () => window.clearTimeout(timer);
  }, [load]);

  function open(profile: AdminSellerShippingProfile) {
    setEditing(profile); setDraft(draftFrom(profile)); setMessage(""); setError("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing || !draft) return;
    setSaving(true); setError(""); setMessage("");
    try {
      const response = await api.patch<AdminSellerShippingProfile>(`/admin/settings/shipping/profiles/${editing.sellerId}`, draft);
      setItems((current) => current.map((item) => item.sellerId === response.data.sellerId ? response.data : item));
      setEditing(response.data); setDraft(draftFrom(response.data)); setMessage(c.saved);
    } catch { setError(c.saveError); } finally { setSaving(false); }
  }

  const change = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((current) => current ? { ...current, [key]: value } : current);

  return <section className={styles.profiles} aria-labelledby="seller-shipping-profiles-title">
    <header><div><h2 id="seller-shipping-profiles-title">{c.title}</h2><p>{c.intro}</p></div></header>
    <CollapsibleFilters locale={locale} title={c.search} activeCount={search.trim() ? 1 : 0}><input className={styles.profileSearch} aria-label={c.search} type="search" value={search} placeholder={c.search} onChange={(event) => setSearch(event.target.value)} /></CollapsibleFilters>
    {error && !editing ? <p className={styles.errorText} role="alert">{error}</p> : null}
    {!loading && items.length === 0 ? <p className={styles.empty}>{c.noResults}</p> : null}
    <div className={styles.profileGrid}>{items.map((profile) => <article key={profile.sellerId} className={styles.profileCard}>
      <div><strong>{profile.shopName}</strong><span>{profile.ownerName} · {profile.ownerEmail}</span></div>
      <p><span data-good={profile.granted}>{profile.granted ? c.granted : c.notGranted}</span><span data-good={profile.complete}>{profile.complete ? c.ready : c.incomplete}</span><span data-good={profile.enabled}>{profile.enabled ? c.enabled : c.disabled}</span></p>
      <button type="button" onClick={() => open(profile)}>{c.manage}</button>
    </article>)}</div>
    {nextCursor ? <button className={styles.loadMore} type="button" disabled={loading} onClick={() => void load(nextCursor, true)}>{c.loadMore}</button> : null}
    {editing && draft ? <div className={styles.profileDialog} role="dialog" aria-modal="true" aria-labelledby="shipping-profile-dialog-title"><button className={styles.scrim} type="button" aria-label={c.close} onClick={() => setEditing(null)} /><form onSubmit={submit}>
      <header><div><h2 id="shipping-profile-dialog-title">{editing.shopName}</h2><p>{editing.ownerName} · {editing.ownerEmail}</p></div><button type="button" onClick={() => setEditing(null)}>{c.close}</button></header>
      {!editing.granted ? <p className={styles.warning}>{c.grantHint}</p> : null}
      <label className={styles.enableBox}><input type="checkbox" checked={draft.enabled} disabled={!editing.granted || saving} onChange={(event) => change("enabled", event.target.checked)} /><span>{draft.enabled ? c.enabled : c.disabled}</span></label>
      <fieldset>{([
        ["senderName", c.senderName, "text", ""], ["senderMobile", c.senderMobile, "tel", "09xxxxxxxxx"], ["province", c.province, "text", ""], ["city", c.city, "text", ""], ["postalCode", c.postalCode, "text", "0000000000"]
      ] as const).map(([key, label, type, placeholder]) => <label key={key}><span>{label}</span><input required type={type} placeholder={placeholder} value={draft[key]} minLength={key === "senderName" || key === "province" || key === "city" ? 2 : undefined} maxLength={key === "senderName" ? 200 : key === "province" || key === "city" ? 100 : key === "postalCode" ? 10 : 16} pattern={key === "postalCode" ? "[0-9]{10}" : undefined} disabled={saving} onChange={(event) => change(key, event.target.value)} /></label>)}</fieldset>
      <label><span>{c.address}</span><textarea required minLength={5} maxLength={500} value={draft.addressLine} disabled={saving} onChange={(event) => change("addressLine", event.target.value)} /></label>
      <footer><span aria-live="polite">{error ? <b className={styles.errorText}>{error}</b> : message}</span><button type="submit" disabled={saving}>{saving ? c.saving : c.save}</button></footer>
    </form></div> : null}
  </section>;
}
