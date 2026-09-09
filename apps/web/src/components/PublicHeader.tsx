import Link from "next/link";
import type { Route } from "next";
import type { Locale } from "@/lib/i18n";
import { DesignIcon } from "./DesignIcon";
import styles from "./PublicHeader.module.css";

const copy = {
  fa: { tagline: "همراه متخصصان موبایل", services: "خدمات", shop: "فروشگاه", specialists: "کارشناسان", journal: "مجله", login: "ورود به حساب", account: "حساب من", nav: "ناوبری اصلی" },
  en: { tagline: "For the craft of repair", services: "Services", shop: "Shop", specialists: "Specialists", journal: "Journal", login: "Sign in", account: "My account", nav: "Main navigation" },
  ar: { tagline: "رفيق متخصصي الصيانة", services: "الخدمات", shop: "المتجر", specialists: "المتخصصون", journal: "المجلة", login: "تسجيل الدخول", account: "حسابي", nav: "التنقل الرئيسي" }
};

export function PublicHeader({ locale, accountHref, current }: { locale: Locale; accountHref?: string | null; current?: "shop" | "journal" }) {
  const c = copy[locale];
  // Locale links load a new document; native details may open before hydration.
  return <header className={styles.header}>
    <Link className={styles.brand} href={`/${locale}` as Route} aria-label="Top GSM"><span className={styles.symbol}><DesignIcon name="layers" /></span><span><strong translate="no">topgsm<span>.</span></strong><small>{c.tagline}</small></span></Link>
    <nav className={styles.navigation} aria-label={c.nav}><Link href={`/${locale}#services` as Route}>{c.services}</Link><Link href={`/${locale}/products` as Route} aria-current={current === "shop" ? "page" : undefined}>{c.shop}</Link><Link href={`/${locale}#agents` as Route}>{c.specialists}</Link><Link href={`/${locale}/blog` as Route} aria-current={current === "journal" ? "page" : undefined}>{c.journal}</Link></nav>
    <div className={styles.actions}>
      <div className={styles.languages} aria-label="Language">{(["fa", "en", "ar"] as const).map((language) => <a key={language} href={`/${language}${current === "shop" ? "/products" : current === "journal" ? "/blog" : ""}` as Route} hrefLang={language} aria-current={locale === language ? "page" : undefined}>{language.toUpperCase()}</a>)}</div>
      <details className={styles.languageMenu} suppressHydrationWarning><summary aria-label="Language">{locale.toUpperCase()}</summary><nav aria-label="Language">{(["fa", "en", "ar"] as const).map((language) => <a key={language} href={`/${language}${current === "shop" ? "/products" : current === "journal" ? "/blog" : ""}` as Route} hrefLang={language} aria-current={locale === language ? "page" : undefined}>{language === "fa" ? "فارسی" : language === "ar" ? "العربية" : "English"}</a>)}</nav></details>
      <a className={styles.account} href={accountHref ?? `/${locale}/login`}>{accountHref ? c.account : c.login}<DesignIcon name="arrow" /></a>
    </div>
  </header>;
}
