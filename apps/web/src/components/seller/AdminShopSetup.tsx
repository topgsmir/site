"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { isAxiosError } from "axios";
import { api } from "@/lib/api/client";
import type { Locale } from "@/lib/i18n";
import styles from "./AdminShopSetup.module.css";

const copy = {
  en: { title: "Start selling", hint: "Create your shop to sell products from your admin account.", name: "Shop name", submit: "Create my shop", saving: "Creating…", back: "Admin panel", error: "Your shop could not be created. Please try again." },
  fa: { title: "شروع فروش", hint: "فروشگاه خود را بسازید و با همین حساب مدیریت محصول بفروشید.", name: "نام فروشگاه", submit: "ساخت فروشگاه من", saving: "در حال ساخت…", back: "پنل مدیریت", error: "فروشگاه ساخته نشد. دوباره تلاش کنید." },
  ar: { title: "ابدأ البيع", hint: "أنشئ متجرك لبيع المنتجات من حساب الإدارة نفسه.", name: "اسم المتجر", submit: "إنشاء متجري", saving: "جارٍ الإنشاء…", back: "لوحة الإدارة", error: "تعذر إنشاء المتجر. حاول مرة أخرى." }
};

export function AdminShopSetup({ locale }: { locale: Locale }) {
  const c = copy[locale];
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await api.post("/seller/own-shop", { shopName: name.trim() });
      router.refresh();
    } catch (error) {
      setError(isAxiosError<{ message?: string }>(error) && typeof error.response?.data.message === "string" ? error.response.data.message : c.error);
      setBusy(false);
    }
  }
  return <section className={styles.setup}>
    <Link href={`/${locale}/admin`}>{c.back}</Link>
    <h1>{c.title}</h1><p>{c.hint}</p>
    <form onSubmit={submit}>
      <label htmlFor="admin-shop-name">{c.name}</label>
      <input id="admin-shop-name" value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={120} required disabled={busy} autoComplete="organization" />
      {error ? <p role="alert">{error}</p> : null}
      <button type="submit" disabled={busy || name.trim().length < 2}>{busy ? c.saving : c.submit}</button>
    </form>
  </section>;
}
