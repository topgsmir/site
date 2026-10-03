"use client";

import { FormEvent, useState } from "react";
import type { ProductType } from "@topgsm/shared-types";
import { splitDownloadUrls, validDownloadUrls } from "../../lib/download-urls";
import type { Locale } from "@/lib/i18n";
import styles from "./ProductTypeChange.module.css";

const COPY = {
  en: { type: "Product type", digital: "Downloadable / digital", physical: "Physical", service: "Virtual / service", bridge: "Bridge", bridgeHint: "Bridge requires a provider binding and cannot be converted here.", physicalHint: "Physical product access is required for every attached seller.", review: "Review type change", cancel: "Cancel", confirm: "Confirm type change", saving: "Changing…", warning: "Changing the type replaces existing fulfillment details for every offer. The product, listings, and offers become drafts. Prices and SKUs remain; unsaved catalog edits are saved. Review each offer before publishing. Products with sales or reservations cannot be converted.", files: "Download URLs (one per line)", downloads: "Maximum downloads per file", stock: "Stock per offer", weight: "Weight in grams per offer", serviceType: "Service type", hours: "Estimated hours", instructions: "Instructions", shared: "These values will be applied to every offer. You can edit each draft offer afterward.", invalidUrls: "Enter 1–50 valid HTTPS download URLs." },
  fa: { type: "نوع محصول", digital: "دانلودی / دیجیتال", physical: "فیزیکی", service: "مجازی / خدمت", bridge: "بریج", bridgeHint: "بریج به اتصال ارائه‌دهنده نیاز دارد و از اینجا قابل تبدیل نیست.", physicalHint: "همهٔ فروشنده‌های متصل باید مجوز محصول فیزیکی داشته باشند.", review: "بررسی تغییر نوع", cancel: "انصراف", confirm: "تأیید تغییر نوع", saving: "در حال تغییر…", warning: "با تغییر نوع، اطلاعات تحویل فعلی همهٔ پیشنهادها جایگزین می‌شود. محصول، فهرست‌ها و پیشنهادها به پیش‌نویس می‌روند. قیمت و شناسهٔ فروشنده حفظ و ویرایش‌های ذخیره‌نشدهٔ کاتالوگ ذخیره می‌شوند. پیش از انتشار، هر پیشنهاد را بررسی کنید. محصول دارای فروش یا رزرو قابل تبدیل نیست.", files: "لینک‌های دانلود (هر خط یک لینک)", downloads: "حداکثر دانلود هر فایل", stock: "موجودی هر پیشنهاد", weight: "وزن هر پیشنهاد (گرم)", serviceType: "نوع خدمت", hours: "ساعت تقریبی", instructions: "دستورالعمل", shared: "این مقادیر برای همهٔ پیشنهادها اعمال می‌شوند. سپس می‌توانید هر پیشنهاد پیش‌نویس را جداگانه ویرایش کنید.", invalidUrls: "۱ تا ۵۰ لینک معتبر HTTPS وارد کنید." },
  ar: { type: "نوع المنتج", digital: "قابل للتنزيل / رقمي", physical: "مادي", service: "افتراضي / خدمة", bridge: "بريدج", bridgeHint: "يتطلب بريدج ربط مزود ولا يمكن تحويله هنا.", physicalHint: "يحتاج كل بائع مرتبط إلى إذن المنتجات المادية.", review: "مراجعة تغيير النوع", cancel: "إلغاء", confirm: "تأكيد تغيير النوع", saving: "جارٍ التغيير…", warning: "يستبدل تغيير النوع بيانات التنفيذ الحالية لكل العروض. يصبح المنتج والقوائم والعروض مسودات. تبقى الأسعار ورموز البائع وتُحفظ تعديلات الكتالوج غير المحفوظة. راجع كل عرض قبل النشر. لا يمكن تحويل منتج له مبيعات أو حجوزات.", files: "روابط التنزيل (رابط لكل سطر)", downloads: "الحد الأقصى للتنزيل لكل ملف", stock: "المخزون لكل عرض", weight: "الوزن بالغرام لكل عرض", serviceType: "نوع الخدمة", hours: "الساعات المقدرة", instructions: "التعليمات", shared: "ستُطبّق هذه القيم على كل العروض. يمكنك تعديل كل عرض مسودة لاحقاً.", invalidUrls: "أدخل من 1 إلى 50 رابط HTTPS صالحاً." }
} as const;

export type TypeChangePayload = {
  type: ProductType;
  confirmTypeChange: true;
  typeChangeDigital?: { fileReferences: string[]; maxDownloads: number };
  typeChangePhysical?: { stock: number; weightGrams: number };
  typeChangeService?: { serviceType: string; estimatedHours: number; instructions: string };
};

export function ProductTypeChange({ locale, currentType, disabled, physicalAllowed = true, onApply }: {
  locale: Locale;
  currentType: ProductType;
  disabled: boolean;
  physicalAllowed?: boolean;
  onApply: (payload: TypeChangePayload) => Promise<void>;
}) {
  const c = COPY[locale];
  const [nextType, setNextType] = useState<ProductType>(currentType);
  const [reviewing, setReviewing] = useState(false);
  const [files, setFiles] = useState("");
  const [downloads, setDownloads] = useState("0");
  const [stock, setStock] = useState("0");
  const [weight, setWeight] = useState("0");
  const [serviceType, setServiceType] = useState("");
  const [hours, setHours] = useState("1");
  const [instructions, setInstructions] = useState("");
  const [error, setError] = useState("");
  const changed = nextType !== currentType;
  const unavailable = currentType === "bridge";

  function review(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!changed || disabled || unavailable) return;
    if (nextType === "digital" && !validDownloadUrls(files)) { setError(c.invalidUrls); return; }
    setError("");
    setReviewing(true);
  }

  async function apply() {
    if (!reviewing || disabled || !changed) return;
    const payload: TypeChangePayload = { type: nextType, confirmTypeChange: true };
    if (nextType === "digital") payload.typeChangeDigital = { fileReferences: splitDownloadUrls(files), maxDownloads: Number(downloads) };
    if (nextType === "physical") payload.typeChangePhysical = { stock: Number(stock), weightGrams: Number(weight) };
    if (nextType === "service") payload.typeChangeService = { serviceType: serviceType.trim(), estimatedHours: Number(hours), instructions: instructions.trim() };
    try {
      setError("");
      await onApply(payload);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : String(requestError));
    }
  }

  return <form className={styles.form} onSubmit={review}>
    <label className={styles.field}><span>{c.type}</span><select value={nextType} disabled={disabled || unavailable} onChange={(event) => { setNextType(event.target.value as ProductType); setReviewing(false); setError(""); }}>
      <option value="digital">{c.digital}</option><option value="physical" disabled={!physicalAllowed}>{c.physical}</option><option value="service">{c.service}</option><option value="bridge" disabled>{c.bridge}</option>
    </select></label>
    {unavailable ? <p className={styles.hint}>{c.bridgeHint}</p> : null}
    {!physicalAllowed ? <p className={styles.hint}>{c.physicalHint}</p> : null}
    {changed && !reviewing ? <>
      <p className={styles.hint}>{c.shared}</p>
      {nextType === "digital" ? <div className={styles.fields}><label className={styles.field}><span>{c.files}</span><textarea required dir="ltr" rows={3} value={files} onChange={(event) => setFiles(event.target.value)} /></label><label className={styles.field}><span>{c.downloads}</span><input required type="number" min={0} max={2147483647} value={downloads} onChange={(event) => setDownloads(event.target.value)} /></label></div> : null}
      {nextType === "physical" ? <div className={styles.fields}><label className={styles.field}><span>{c.stock}</span><input required type="number" min={0} max={2147483647} value={stock} onChange={(event) => setStock(event.target.value)} /></label><label className={styles.field}><span>{c.weight}</span><input required type="number" min={0} max={2147483647} value={weight} onChange={(event) => setWeight(event.target.value)} /></label></div> : null}
      {nextType === "service" ? <div className={styles.fields}><label className={styles.field}><span>{c.serviceType}</span><input required maxLength={100} value={serviceType} onChange={(event) => setServiceType(event.target.value)} /></label><label className={styles.field}><span>{c.hours}</span><input required type="number" min={1} max={10000} value={hours} onChange={(event) => setHours(event.target.value)} /></label><label className={styles.field}><span>{c.instructions}</span><textarea maxLength={5000} rows={2} value={instructions} onChange={(event) => setInstructions(event.target.value)} /></label></div> : null}
      {error ? <p role="alert" className={styles.error}>{error}</p> : null}
      <button className={styles.button} type="submit" disabled={disabled}>{c.review}</button>
    </> : null}
    {changed && reviewing ? <div className={styles.confirm} role="group" aria-label={c.review}><p>{c.warning}</p>{error ? <p className={styles.error} role="alert">{error}</p> : null}<div className={styles.actions}><button className={styles.button} type="button" disabled={disabled} onClick={() => void apply()}>{disabled ? c.saving : c.confirm}</button><button className={styles.cancel} type="button" disabled={disabled} onClick={() => { setReviewing(false); setError(""); }}>{c.cancel}</button></div></div> : null}
  </form>;
}
