"use client";

import axios from "axios";
import { SellerAvatar } from "@/components/seller/SellerAvatar";
import { useState } from "react";
import type { SellerProfilePicture, Vendor } from "@topgsm/shared-types";
import type { Locale } from "@/lib/i18n";
import { api } from "@/lib/api/client";
import styles from "./VendorPictureControl.module.css";

const copy = {
  en: { title: "Profile picture", hint: "WebP, up to 8 MB. Cropped to a square.", choose: "Choose picture", replace: "Replace picture", remove: "Remove picture", uploading: "Uploading…", removing: "Removing…", saved: "Picture saved.", removed: "Picture removed.", invalid: "Choose a WebP image up to 8 MB.", failed: "Could not update the picture." },
  fa: { title: "تصویر پروفایل", hint: "WebP تا ۸ مگابایت؛ تصویر مربع برش می‌خورد.", choose: "انتخاب تصویر", replace: "تغییر تصویر", remove: "حذف تصویر", uploading: "در حال بارگذاری…", removing: "در حال حذف…", saved: "تصویر ذخیره شد.", removed: "تصویر حذف شد.", invalid: "تصویر WebP تا ۸ مگابایت انتخاب کنید.", failed: "تصویر به‌روزرسانی نشد." },
  ar: { title: "صورة الملف الشخصي", hint: "WebP حتى 8 ميغابايت؛ تُقص الصورة مربعة.", choose: "اختيار صورة", replace: "تغيير الصورة", remove: "حذف الصورة", uploading: "جارٍ الرفع…", removing: "جارٍ الحذف…", saved: "تم حفظ الصورة.", removed: "تم حذف الصورة.", invalid: "اختر صورة WebP حتى 8 ميغابايت.", failed: "تعذر تحديث الصورة." }
} as const;

export function VendorPictureControl({ vendor, locale, onChange }: { vendor: Vendor; locale: Locale; onChange(picture: SellerProfilePicture | null): void }) {
  const c = copy[locale];
  const [busy, setBusy] = useState<"uploading" | "removing" | null>(null);
  const [message, setMessage] = useState("");

  function errorMessage(error: unknown) {
    const detail = axios.isAxiosError(error) ? error.response?.data?.message : null;
    return Array.isArray(detail) ? detail.join(" ") : typeof detail === "string" ? detail : c.failed;
  }

  async function upload(file: File | undefined) {
    if (!file) return;
    if (file.type !== "image/webp" || file.size > 8 * 1024 * 1024) {
      setMessage(c.invalid);
      return;
    }
    setBusy("uploading");
    setMessage("");
    const body = new FormData();
    body.append("file", file);
    try {
      const response = await api.post<SellerProfilePicture>(`/seller/vendors/${vendor.id}/picture`, body);
      onChange(response.data);
      setMessage(c.saved);
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    setBusy("removing");
    setMessage("");
    try {
      await api.delete(`/seller/vendors/${vendor.id}/picture`);
      onChange(null);
      setMessage(c.removed);
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  return <fieldset className={styles.field} disabled={busy !== null}>
    <legend>{c.title}</legend>
    <div className={styles.row}>
      <SellerAvatar className={styles.preview} name={vendor.shopName} picture={vendor.profilePicture} locale={locale} size={56} />
      <div className={styles.controls}>
        <p>{c.hint}</p>
        <div className={styles.actions}>
          <label className={styles.choose}>{busy === "uploading" ? c.uploading : vendor.profilePicture ? c.replace : c.choose}<input type="file" accept="image/webp" onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; void upload(file); }} /></label>
          {vendor.profilePicture ? <button type="button" onClick={() => void remove()}>{busy === "removing" ? c.removing : c.remove}</button> : null}
        </div>
        <output role={message ? "status" : undefined}>{message}</output>
      </div>
    </div>
  </fieldset>;
}
