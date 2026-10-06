"use client";

import type { Locale } from "@/lib/i18n";
import type { DownloadLink } from "@/lib/download-links";
import styles from "./DownloadLinkRows.module.css";

const copy = {
  en: { url: "Download URL", title: "Link title", add: "Add", remove: "Remove", hint: "Use an HTTPS link and a title for each file. Up to 50 links.", locked: "Download links are locked after product registration." },
  fa: { url: "لینک دانلود", title: "متن یا عنوان لینک", add: "افزودن", remove: "حذف", hint: "برای هر فایل، لینک HTTPS و عنوان وارد کنید. حداکثر ۵۰ لینک.", locked: "لینک‌های دانلود پس از ثبت محصول قابل ویرایش نیستند." },
  ar: { url: "رابط التنزيل", title: "نص الرابط أو عنوانه", add: "إضافة", remove: "حذف", hint: "أدخل رابط HTTPS وعنوانًا لكل ملف. حتى ٥٠ رابطًا.", locked: "لا يمكن تعديل روابط التنزيل بعد تسجيل المنتج." }
} as const;

export function DownloadLinkRows({ locale, links, onChange, disabled = false, removable = false, required = true }: {
  locale: Locale;
  links: DownloadLink[];
  onChange?: (links: DownloadLink[]) => void;
  disabled?: boolean;
  removable?: boolean;
  required?: boolean;
}) {
  const c = copy[locale];
  return <div className={styles.group}>
    <div className={styles.rows}>
      {links.map((link, index) => <div className={styles.row} data-removable={removable && !disabled} key={index}>
        <label className={styles.url}><span>{c.url} {links.length > 1 ? (index + 1).toLocaleString(locale) : ""}</span><input type="url" inputMode="url" dir="ltr" required={required && !disabled} maxLength={2048} value={link.url} disabled={disabled} onChange={(event) => onChange?.(links.map((item, position) => position === index ? { ...item, url: event.target.value } : item))} /></label>
        <label className={styles.title}><span>{c.title} {links.length > 1 ? (index + 1).toLocaleString(locale) : ""}</span><input dir={locale === "en" ? "ltr" : "rtl"} required={required && !disabled} maxLength={120} value={link.title} disabled={disabled} onChange={(event) => onChange?.(links.map((item, position) => position === index ? { ...item, title: event.target.value } : item))} /></label>
        {removable && !disabled ? <button className={styles.add} type="button" disabled={links.length === 1} onClick={() => onChange?.(links.filter((_, position) => position !== index))}>{c.remove}</button> : null}
      </div>)}
    </div>
    {!disabled ? <button className={styles.add} type="button" disabled={links.length >= 50} onClick={() => onChange?.([...links, { url: "", title: "" }])}>{c.add}</button> : null}
    <small className={styles.hint}>{disabled ? c.locked : c.hint}</small>
  </div>;
}
