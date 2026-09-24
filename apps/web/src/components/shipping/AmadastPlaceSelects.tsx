"use client";

import { useState } from "react";
import type { ShippingPlaceOption } from "@topgsm/shared-types";
import type { Locale } from "@/lib/i18n";
import { api } from "@/lib/api/client";
import styles from "./AmadastPlaceSelects.module.css";

const copy = {
  en: { province: "Province", city: "City", load: "Load provinces from Amadast", loading: "Loading Amadast locations…", chooseProvince: "Choose a province", chooseCity: "Choose a city", identity: "Enter a valid sender name and mobile first.", error: "Amadast locations could not be loaded." },
  fa: { province: "استان", city: "شهر", load: "دریافت استان‌ها از آمادست", loading: "در حال دریافت موقعیت‌ها از آمادست…", chooseProvince: "استان را انتخاب کنید", chooseCity: "شهر را انتخاب کنید", identity: "ابتدا نام و موبایل معتبر فرستنده را وارد کنید.", error: "دریافت استان‌ها و شهرها از آمادست انجام نشد." },
  ar: { province: "المحافظة", city: "المدينة", load: "تحميل المحافظات من Amadast", loading: "جارٍ تحميل مواقع Amadast…", chooseProvince: "اختر المحافظة", chooseCity: "اختر المدينة", identity: "أدخل اسم المرسل ورقم جواله الصحيح أولاً.", error: "تعذر تحميل المحافظات والمدن من Amadast." }
} as const;

type Props = {
  locale: Locale;
  sellerId?: string;
  senderName: string;
  senderMobile: string;
  province: string;
  city: string;
  disabled: boolean;
  onProvinceChange: (value: string) => void;
  onCityChange: (value: string) => void;
};

export function AmadastPlaceSelects(props: Props) {
  const c = copy[props.locale];
  const [provinces, setProvinces] = useState<ShippingPlaceOption[]>([]);
  const [cities, setCities] = useState<ShippingPlaceOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const endpoint = props.sellerId
    ? `/admin/settings/shipping/profiles/${props.sellerId}/places`
    : "/shipping/profile/places";
  const identityReady = props.senderName.trim().length >= 2 && /^(?:\+98|0098|98|0)?9\d{9}$/.test(props.senderMobile.trim());
  const selectedProvince = provinces.find((item) => item.title === props.province);
  const selectedCity = cities.find((item) => item.title === props.city);

  async function request(provinceId?: number) {
    const response = await api.post<ShippingPlaceOption[]>(endpoint, {
      senderName: props.senderName.trim(),
      senderMobile: props.senderMobile.trim(),
      ...(provinceId ? { provinceId } : {})
    });
    return response.data;
  }

  async function loadCities(province: ShippingPlaceOption, preferredCity = "") {
    const nextCities = await request(province.id);
    setCities(nextCities);
    if (preferredCity && !nextCities.some((item) => item.title === preferredCity)) props.onCityChange("");
  }

  async function loadProvinces() {
    if (!identityReady) { setError(c.identity); return; }
    setLoading(true); setError("");
    try {
      const nextProvinces = await request();
      setProvinces(nextProvinces);
      const currentProvince = nextProvinces.find((item) => item.title === props.province);
      if (currentProvince) await loadCities(currentProvince, props.city);
      else { props.onProvinceChange(""); props.onCityChange(""); setCities([]); }
    } catch { setError(c.error); }
    finally { setLoading(false); }
  }

  async function changeProvince(id: string) {
    const province = provinces.find((item) => String(item.id) === id);
    props.onProvinceChange(province?.title ?? "");
    props.onCityChange("");
    setCities([]);
    if (!province) return;
    setLoading(true); setError("");
    try { await loadCities(province); }
    catch { setError(c.error); }
    finally { setLoading(false); }
  }

  return <>
    <label><span>{c.province}</span><select required value={selectedProvince ? String(selectedProvince.id) : ""} disabled={props.disabled || loading || provinces.length === 0} onChange={(event) => void changeProvince(event.target.value)}><option value="">{c.chooseProvince}</option>{provinces.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
    <label><span>{c.city}</span><select required value={selectedCity?.title ?? ""} disabled={props.disabled || loading || !selectedProvince || cities.length === 0} onChange={(event) => props.onCityChange(event.target.value)}><option value="">{c.chooseCity}</option>{cities.map((item) => <option key={item.id} value={item.title}>{item.title}</option>)}</select></label>
    <div className={styles.action}><button type="button" disabled={props.disabled || loading || !identityReady} onClick={() => void loadProvinces()}>{loading ? c.loading : c.load}</button>{!identityReady ? <small>{c.identity}</small> : null}{error ? <small className={styles.error} role="alert">{error}</small> : null}</div>
  </>;
}
