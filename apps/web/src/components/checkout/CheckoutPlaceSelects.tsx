"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ShippingPlaceOption } from "@topgsm/shared-types";
import type { Locale } from "@/lib/i18n";
import { api } from "@/lib/api/client";
import styles from "./Checkout.module.css";

const COPY = {
  en: { province: "Province", city: "City", chooseProvince: "Choose a province", chooseCity: "Choose a city", loading: "Loading Amadast locations…", error: "Delivery locations could not be loaded.", retry: "Try again" },
  fa: { province: "استان", city: "شهر", chooseProvince: "استان را انتخاب کنید", chooseCity: "شهر را انتخاب کنید", loading: "در حال دریافت استان‌ها و شهرها از آمادست…", error: "دریافت استان‌ها و شهرها انجام نشد.", retry: "تلاش دوباره" },
  ar: { province: "المحافظة", city: "المدينة", chooseProvince: "اختر المحافظة", chooseCity: "اختر المدينة", loading: "جارٍ تحميل مواقع Amadast…", error: "تعذر تحميل مواقع التسليم.", retry: "حاول مجدداً" }
} as const;

export function CheckoutPlaceSelects({ locale, offerIds }: { locale: Locale; offerIds: string[] }) {
  const c = COPY[locale];
  const [provinces, setProvinces] = useState<ShippingPlaceOption[]>([]);
  const [cities, setCities] = useState<ShippingPlaceOption[]>([]);
  const [province, setProvince] = useState("");
  const [city, setCity] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const requestId = useRef(0);
  const offerKey = useMemo(() => [...offerIds].sort().join(":"), [offerIds]);

  const request = useCallback(async (provinceId?: number) => {
    const items = offerKey.split(":").filter(Boolean).map((offerId) => ({ offerId, quantity: 1 }));
    const response = await api.post<ShippingPlaceOption[]>("/checkouts/shipping-places", {
      items,
      ...(provinceId ? { provinceId } : {})
    });
    return response.data;
  }, [offerKey]);

  const loadProvinces = useCallback(async () => {
    if (!offerKey) return;
    const activeRequest = ++requestId.current;
    setLoading(true);
    setError("");
    setProvince("");
    setCity("");
    setCities([]);
    try {
      const next = await request();
      if (activeRequest === requestId.current) setProvinces(next);
    } catch {
      if (activeRequest === requestId.current) { setProvinces([]); setError(c.error); }
    } finally {
      if (activeRequest === requestId.current) setLoading(false);
    }
  }, [c.error, offerKey, request]);

  useEffect(() => {
    void loadProvinces();
    return () => { requestId.current += 1; };
  }, [loadProvinces]);

  async function changeProvince(title: string) {
    setProvince(title);
    setCity("");
    setCities([]);
    const selected = provinces.find((item) => item.title === title);
    if (!selected) return;
    const activeRequest = ++requestId.current;
    setLoading(true);
    setError("");
    try {
      const next = await request(selected.id);
      if (activeRequest === requestId.current) setCities(next);
    } catch {
      if (activeRequest === requestId.current) setError(c.error);
    } finally {
      if (activeRequest === requestId.current) setLoading(false);
    }
  }

  return <>
    <label><span>{c.province}</span><select name="province" autoComplete="address-level1" value={province} required aria-busy={loading} onChange={(event) => void changeProvince(event.target.value)}><option value="">{c.chooseProvince}</option>{provinces.map((item) => <option key={item.id} value={item.title}>{item.title}</option>)}</select></label>
    <label><span>{c.city}</span><select name="city" autoComplete="address-level2" value={city} required aria-busy={loading} onChange={(event) => setCity(event.target.value)}><option value="">{c.chooseCity}</option>{cities.map((item) => <option key={item.id} value={item.title}>{item.title}</option>)}</select></label>
    {loading || error ? <div className={styles.placeStatus} role={error ? "alert" : "status"}><span>{error || c.loading}</span>{error ? <button type="button" onClick={() => void loadProvinces()}>{c.retry}</button> : null}</div> : null}
  </>;
}
