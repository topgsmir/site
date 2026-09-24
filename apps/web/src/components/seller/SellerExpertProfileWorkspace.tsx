"use client";

import axios from "axios";
import Link from "next/link";
import Image from "next/image";
import type { Route } from "next";
import { FormEvent, useCallback, useEffect, useState } from "react";
import type { SellerProfilePicture, SellerPublicProfileSettings } from "@topgsm/shared-types";
import type { Locale } from "@/lib/i18n";
import { api } from "@/lib/api/client";
import styles from "./SellerExpertProfileWorkspace.module.css";

type Draft = { publicName: string; specialty: string; bio: string };
type State = "loading" | "ready" | "saving" | "error";

const copy = {
  fa: { title: "پروفایل عمومی کارشناس", intro: "این اطلاعات در صفحه اصلی و پروفایل عمومی شما نمایش داده می‌شود. اگر نام عمومی را خالی بگذارید، نام فروشگاه نمایش داده می‌شود.", shop: "نام فروشگاه", name: "نام نمایشی کارشناس", namePlaceholder: "مثلاً علی رضایی", specialty: "حوزه تخصص", specialtyPlaceholder: "مثلاً تعمیرات برد آیفون", bio: "درباره کارشناس", bioPlaceholder: "تجربه، مهارت‌ها و نوع خدماتی را که ارائه می‌کنید کوتاه و روشن بنویسید.", picture: "تصویر پروفایل", pictureHint: "تصویر JPG، PNG یا WebP تا ۸ مگابایت. تصویر به‌صورت مربع برش می‌خورد.", choosePicture: "انتخاب تصویر", replacePicture: "تغییر تصویر", removePicture: "حذف تصویر", uploadingPicture: "در حال بارگذاری…", removingPicture: "در حال حذف…", pictureSaved: "تصویر پروفایل ذخیره شد.", pictureRemoved: "تصویر پروفایل حذف شد.", pictureError: "تصویر پروفایل به‌روزرسانی نشد.", save: "ذخیره پروفایل", saving: "در حال ذخیره…", saved: "پروفایل کارشناس ذخیره شد.", loadError: "پروفایل بارگذاری نشد.", saveError: "پروفایل ذخیره نشد. اطلاعات را بررسی کنید.", retry: "تلاش دوباره", preview: "مشاهده پروفایل عمومی", optional: "اختیاری" },
  en: { title: "Public expert profile", intro: "This information appears on the homepage and your public profile. Your shop name is used when the public name is blank.", shop: "Shop name", name: "Expert display name", namePlaceholder: "For example, Alex Morgan", specialty: "Specialty", specialtyPlaceholder: "For example, iPhone board repair", bio: "About the expert", bioPlaceholder: "Briefly describe your experience, skills, and the services you provide.", picture: "Profile picture", pictureHint: "JPG, PNG, or WebP up to 8 MB. The image is cropped to a square.", choosePicture: "Choose picture", replacePicture: "Replace picture", removePicture: "Remove picture", uploadingPicture: "Uploading…", removingPicture: "Removing…", pictureSaved: "Profile picture saved.", pictureRemoved: "Profile picture removed.", pictureError: "The profile picture could not be updated.", save: "Save profile", saving: "Saving…", saved: "Expert profile saved.", loadError: "The profile could not be loaded.", saveError: "The profile could not be saved. Check the details.", retry: "Try again", preview: "View public profile", optional: "Optional" },
  ar: { title: "ملف الخبير العام", intro: "تظهر هذه المعلومات في الصفحة الرئيسية وملفك العام. سيظهر اسم المتجر إذا تركت الاسم العام فارغاً.", shop: "اسم المتجر", name: "اسم الخبير المعروض", namePlaceholder: "مثلاً علي رضائي", specialty: "مجال التخصص", specialtyPlaceholder: "مثلاً إصلاح لوحات آيفون", bio: "نبذة عن الخبير", bioPlaceholder: "اكتب باختصار عن خبرتك ومهاراتك والخدمات التي تقدمها.", picture: "صورة الملف الشخصي", pictureHint: "صورة JPG أو PNG أو WebP حتى 8 ميغابايت. تُقص الصورة بشكل مربع.", choosePicture: "اختيار صورة", replacePicture: "تغيير الصورة", removePicture: "حذف الصورة", uploadingPicture: "جارٍ الرفع…", removingPicture: "جارٍ الحذف…", pictureSaved: "تم حفظ صورة الملف الشخصي.", pictureRemoved: "تم حذف صورة الملف الشخصي.", pictureError: "تعذر تحديث صورة الملف الشخصي.", save: "حفظ الملف", saving: "جارٍ الحفظ…", saved: "تم حفظ ملف الخبير.", loadError: "تعذر تحميل الملف.", saveError: "تعذر حفظ الملف. تحقق من البيانات.", retry: "حاول مجدداً", preview: "عرض الملف العام", optional: "اختياري" }
} as const;

const emptyDraft: Draft = { publicName: "", specialty: "", bio: "" };
const toDraft = (profile: SellerPublicProfileSettings): Draft => ({
  publicName: profile.publicName ?? "",
  specialty: profile.specialty ?? "",
  bio: profile.bio ?? ""
});

export function SellerExpertProfileWorkspace({ locale }: { locale: Locale }) {
  const c = copy[locale];
  const [profile, setProfile] = useState<SellerPublicProfileSettings | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [state, setState] = useState<State>("loading");
  const [message, setMessage] = useState("");
  const [pictureBusy, setPictureBusy] = useState<"uploading" | "removing" | null>(null);
  const [pictureMessage, setPictureMessage] = useState("");

  const load = useCallback(async () => {
    setState("loading");
    setMessage("");
    try {
      const response = await api.get<SellerPublicProfileSettings>("/seller/profile");
      setProfile(response.data);
      setDraft(toDraft(response.data));
      setState("ready");
    } catch {
      setState("error");
      setMessage(c.loadError);
    }
  }, [c.loadError]);

  useEffect(() => { void load(); }, [load]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("saving");
    setMessage("");
    try {
      const response = await api.patch<SellerPublicProfileSettings>("/seller/profile", {
        publicName: draft.publicName.trim() || null,
        specialty: draft.specialty.trim() || null,
        bio: draft.bio.trim() || null
      });
      setProfile(response.data);
      setDraft(toDraft(response.data));
      setState("ready");
      setMessage(c.saved);
    } catch (error) {
      const detail = axios.isAxiosError(error) ? error.response?.data?.message : null;
      setState("error");
      setMessage(Array.isArray(detail) ? detail.join(" ") : typeof detail === "string" ? detail : c.saveError);
    }
  }

  async function uploadPicture(file: File | undefined) {
    if (!file) return;
    setPictureBusy("uploading");
    setPictureMessage("");
    const body = new FormData();
    body.append("file", file);
    try {
      const response = await api.post<SellerProfilePicture>("/seller/profile/picture", body);
      setProfile((current) => current ? { ...current, profilePicture: response.data } : current);
      setPictureMessage(c.pictureSaved);
    } catch (error) {
      const detail = axios.isAxiosError(error) ? error.response?.data?.message : null;
      setPictureMessage(Array.isArray(detail) ? detail.join(" ") : typeof detail === "string" ? detail : c.pictureError);
    } finally {
      setPictureBusy(null);
    }
  }

  async function removePicture() {
    setPictureBusy("removing");
    setPictureMessage("");
    try {
      await api.delete("/seller/profile/picture");
      setProfile((current) => current ? { ...current, profilePicture: null } : current);
      setPictureMessage(c.pictureRemoved);
    } catch (error) {
      const detail = axios.isAxiosError(error) ? error.response?.data?.message : null;
      setPictureMessage(Array.isArray(detail) ? detail.join(" ") : typeof detail === "string" ? detail : c.pictureError);
    } finally {
      setPictureBusy(null);
    }
  }

  if (state === "loading") return <section className={styles.status} aria-busy="true"><p>{c.title}</p></section>;
  if (!profile) return <section className={styles.status}><p role="alert">{message || c.loadError}</p><button type="button" onClick={() => void load()}>{c.retry}</button></section>;

  return <section className={styles.workspace} aria-labelledby="expert-profile-title">
    <header className={styles.header}>
      <div><h2 id="expert-profile-title">{c.title}</h2><p>{c.intro}</p></div>
      <Link href={`/${locale}/experts/${profile.sellerId}` as Route}>{c.preview}</Link>
    </header>
    <form className={styles.form} onSubmit={save} aria-busy={state === "saving"}>
      <fieldset className={styles.pictureField} disabled={pictureBusy !== null}>
        <legend>{c.picture}</legend>
        <div className={styles.pictureRow}>
          <div className={styles.picturePreview}>
            {profile.profilePicture ? <Image src={profile.profilePicture.url} alt="" width={96} height={96} /> : <span aria-hidden="true">{(profile.publicName ?? profile.shopName).trim().slice(0, 2).toLocaleUpperCase(locale)}</span>}
          </div>
          <div className={styles.pictureControls}>
            <p>{c.pictureHint}</p>
            <div><label className={styles.pictureButton}><span>{pictureBusy === "uploading" ? c.uploadingPicture : profile.profilePicture ? c.replacePicture : c.choosePicture}</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; void uploadPicture(file); }} /></label>{profile.profilePicture ? <button className={styles.removePicture} type="button" onClick={() => void removePicture()}>{pictureBusy === "removing" ? c.removingPicture : c.removePicture}</button> : null}</div>
            <output className={styles.pictureMessage} aria-live="polite">{pictureMessage}</output>
          </div>
        </div>
      </fieldset>
      <label className={styles.readonly}><span>{c.shop}</span><strong>{profile.shopName}</strong></label>
      <label><span>{c.name} <small>{c.optional}</small></span><input value={draft.publicName} minLength={2} maxLength={120} placeholder={c.namePlaceholder} onChange={(event) => setDraft((current) => ({ ...current, publicName: event.target.value }))} /></label>
      <label><span>{c.specialty} <small>{c.optional}</small></span><input value={draft.specialty} minLength={2} maxLength={160} placeholder={c.specialtyPlaceholder} onChange={(event) => setDraft((current) => ({ ...current, specialty: event.target.value }))} /></label>
      <label><span>{c.bio} <small>{c.optional}</small></span><textarea value={draft.bio} maxLength={1000} rows={5} placeholder={c.bioPlaceholder} onChange={(event) => setDraft((current) => ({ ...current, bio: event.target.value }))} /></label>
      <div className={styles.actions}><button type="submit" disabled={state === "saving"}>{state === "saving" ? c.saving : c.save}</button><p aria-live="polite" data-error={state === "error"}>{message}</p></div>
    </form>
  </section>;
}
