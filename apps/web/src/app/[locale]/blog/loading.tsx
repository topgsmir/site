"use client";

import { useParams } from "next/navigation";
import { BlogFooter, BlogHeader } from "@/components/blog/BlogChrome";
import { isLocale } from "@/lib/i18n";
import styles from "./loading.module.css";

const copy = {
  fa: { loading: "در حال بارگذاری مطالب…" },
  en: { loading: "Loading articles…" },
  ar: { loading: "جارٍ تحميل المقالات…" }
} as const;

export default function BlogLoading() {
  const { locale: value } = useParams<{ locale: string }>();
  const locale = isLocale(value) ? value : "fa";
  return (
    <div className="blog-shell">
      <BlogHeader locale={locale} />
      <main className={styles.main} aria-busy="true">
        <p role="status" className={styles.status}>{copy[locale].loading}</p>
        <div className={styles.columns} aria-hidden="true">
          <div className={styles.sidebar} />
          <div className={styles.feed}>
            <div className={styles.row} />
            <div className={styles.row} />
            <div className={styles.row} />
          </div>
        </div>
      </main>
      <BlogFooter locale={locale} />
    </div>
  );
}
