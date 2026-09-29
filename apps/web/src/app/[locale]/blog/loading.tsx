"use client";

import { useParams } from "next/navigation";
import { BlogFooter, BlogHeader } from "@/components/blog/BlogChrome";
import { isLocale } from "@/lib/i18n";
import styles from "./loading.module.css";

const copy = {
  fa: { loading: "در حال بارگذاری مطالب…", journal: "مجله تاپ جی‌اس‌ام" },
  en: { loading: "Loading articles…", journal: "Top GSM Journal" },
  ar: { loading: "جارٍ تحميل المقالات…", journal: "مجلة Top GSM" }
} as const;

export default function BlogLoading() {
  const { locale: value } = useParams<{ locale: string }>();
  const locale = isLocale(value) ? value : "fa";
  return <div className="blog-shell">
    <BlogHeader locale={locale} />
    <main className={styles.main} aria-busy="true">
      <p role="status" className={styles.status}>{copy[locale].loading}</p>
      <div className={styles.intro} aria-hidden="true"><span>{copy[locale].journal}</span><div className={styles.title} /><div className={styles.summary} /></div>
      <div className={styles.columns} aria-hidden="true"><div className={styles.feed}><div className={styles.row} /><div className={styles.row} /><div className={styles.row} /><div className={styles.row} /></div><div className={styles.sidebar} /></div>
    </main>
    <BlogFooter locale={locale} />
  </div>;
}
