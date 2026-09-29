"use client";

import type { Locale } from "@/lib/i18n";
import type { DownloadLink } from "@/lib/download-links";
import styles from "./DownloadLinkRows.module.css";

const copy = {
  en: { url: "Download URL", title: "Link title", add: "Add", hint: "Use an HTTPS link and a title for each file. Up to 50 links.", locked: "Download links are locked after product registration." },
  fa: { url: "لینک دانلود", title: "متن یا عنوان لینک", add: "افزودن", hint: "برای هر فایل، لینک HTTPS و عنوان وارد کنید. حداکثر ۵۰ لینک.", locked: "لینک‌های دانلود پس از ثبت محصول قابل ویرایش نیستند." },
  ar: { url: "رابط التنزيل", title: "نص الرابط أو عنوانه", add: "إضافة", hint: "أدخل رابط HTTPS وعنوانًا لكل ملف. حتى ٥٠ رابطًا.", locked: "لا يمكن تعديل روابط التنزيل بعد تسجيل المنتج." }
} as const;

export function DownloadLinkRows({ locale, links, onChange, disabled = false }: {
  locale: Locale;
  links: DownloadLink[];
  onChange?: (links: DownloadLink[]) => void;
  disabled?: boolean;
}) {
  const c = copy[locale];
  return <div className={styles.group}>
    <div className={styles.rows}>
      {links.map((link, index) => <div className={styles.row} key={index}>
        <label className={styles.url}><span>{c.url} {links.length > 1 ? (index + 1).toLocaleString(locale) : ""}</span><input type="url" inputMode="url" dir="ltr" required={!disabled} maxLength={2048} value={link.url} disabled={disabled} onChange={(event) => onChange?.(links.map((item, position) => position === index ? { ...item, url: event.target.value } : item))} /></label>
        <label className={styles.title}><span>{c.title} {links.length > 1 ? (index + 1).toLocaleString(locale) : ""}</span><input dir={locale === "en" ? "ltr" : "rtl"} required={!disabled} maxLength={120} value={link.title} disabled={disabled} onChange={(event) => onChange?.(links.map((item, position) => position === index ? { ...item, title: event.target.value } : item))} /></label>
      </div>)}
    </div>
    {!disabled ? <button className={styles.add} type="button" disabled={links.length >= 50} onClick={() => onChange?.([...links, { url: "", title: "" }])}>{c.add}</button> : null}
    <small className={styles.hint}>{disabled ? c.locked : c.hint}</small>
  </div>;
}
