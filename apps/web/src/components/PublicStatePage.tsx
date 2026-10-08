import Link from "next/link";
import type { Route } from "next";
import type { ReactNode } from "react";
import type { Locale } from "@/lib/i18n";
import styles from "./PublicStatePage.module.css";

const copy = {
  fa: {
    notFoundLabel: "خطای ۴۰۴", notFoundTitle: "این صفحه پیدا نشد", notFoundText: "ممکن است نشانی تغییر کرده باشد یا صفحه دیگر در دسترس نباشد.",
    errorLabel: "خطا در بارگذاری", errorTitle: "صفحه بارگذاری نشد", errorText: "در دریافت اطلاعات مشکلی پیش آمد. دوباره تلاش کنید.",
    home: "بازگشت به خانه", journal: "مجله", shop: "فروشگاه", retry: "تلاش دوباره", navigation: "مسیرهای پیشنهادی", skip: "رفتن به محتوا"
  },
  en: {
    notFoundLabel: "Error 404", notFoundTitle: "Page not found", notFoundText: "The address may have changed or the page may no longer be available.",
    errorLabel: "Loading error", errorTitle: "The page could not be loaded", errorText: "We could not get the information. Please try again.",
    home: "Back to home", journal: "Journal", shop: "Shop", retry: "Try again", navigation: "Suggested destinations", skip: "Skip to content"
  },
  ar: {
    notFoundLabel: "خطأ ٤٠٤", notFoundTitle: "لم نعثر على الصفحة", notFoundText: "ربما تغيّر العنوان أو لم تعد الصفحة متاحة.",
    errorLabel: "خطأ في التحميل", errorTitle: "تعذر تحميل الصفحة", errorText: "تعذر جلب المعلومات. حاول مرة أخرى.",
    home: "العودة إلى الرئيسية", journal: "المجلة", shop: "المتجر", retry: "حاول مرة أخرى", navigation: "وجهات مقترحة", skip: "انتقل إلى المحتوى"
  }
} as const;

export function PublicStatePage({ locale, kind, action }: { locale: Locale; kind: "not-found" | "error"; action?: ReactNode }) {
  const c = copy[locale];
  return <div className={styles.page}>
    <a className="skip-link" href="#state-content">{c.skip}</a>
    
    <main id="state-content" className={styles.main}>
      <section className={styles.panel} aria-labelledby="state-title">
        <p className={styles.label}>{kind === "not-found" ? c.notFoundLabel : c.errorLabel}</p>
        <h1 id="state-title">{kind === "not-found" ? c.notFoundTitle : c.errorTitle}</h1>
        <p className={styles.description}>{kind === "not-found" ? c.notFoundText : c.errorText}</p>
        <div className={styles.actions}>
          {action ?? <Link className={styles.primary} href={`/${locale}` as Route}>{c.home}<span aria-hidden="true">{locale === "en" ? "→" : "←"}</span></Link>}
          {action && <Link className={styles.secondary} href={`/${locale}` as Route}>{c.home}</Link>}
        </div>
      </section>
      <nav className={styles.destinations} aria-label={c.navigation}>
        <Link href={`/${locale}/blog` as Route}>{c.journal}<span aria-hidden="true">{locale === "en" ? "↗" : "↖"}</span></Link>
        <Link href={`/${locale}/products` as Route}>{c.shop}<span aria-hidden="true">{locale === "en" ? "↗" : "↖"}</span></Link>
      </nav>
    </main>
  </div>;
}

export function errorRetryLabel(locale: Locale) { return copy[locale].retry; }
export const publicStateActionClass = "public-state-primary";
