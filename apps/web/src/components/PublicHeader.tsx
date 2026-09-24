import Link from "next/link";
import type { Route } from "next";
import type { Locale } from "@/lib/i18n";
import { DesignIcon } from "./DesignIcon";
import styles from "./PublicHeader.module.css";
import { CartLink } from "./CartLink";
import { HeaderSearch } from "./HeaderSearch";
import { LanguageSwitcher } from "./LanguageSwitcher";

const copy = {
  fa: { tagline: "همراه متخصصان موبایل", contact: "تماس با ما", services: "خدمات", shop: "فروشگاه", specialists: "کارشناسان", journal: "مجله", login: "ورود به حساب", account: "حساب من", nav: "ناوبری اصلی" },
  en: { tagline: "For the craft of repair", contact: "Contact", services: "Services", shop: "Shop", specialists: "Experts", journal: "Journal", login: "Sign in", account: "My account", nav: "Main navigation" },
  ar: { tagline: "رفيق متخصصي الصيانة", contact: "اتصل بنا", services: "الخدمات", shop: "المتجر", specialists: "الخبراء", journal: "المجلة", login: "تسجيل الدخول", account: "حسابي", nav: "التنقل الرئيسي" }
};

export function PublicHeader({ locale, accountHref, current, languageHrefs }: { locale: Locale; accountHref?: string | null; current?: "shop" | "journal" | "cart" | "contact"; languageHrefs?: Record<Locale, string> }) {
  const c = copy[locale];
  const currentPath = current === "shop" ? "/products" : current === "journal" ? "/blog" : current === "cart" ? "/cart" : current === "contact" ? "/contact-us" : "";
  return <header className={styles.header}>
    <Link className={styles.brand} href={`/${locale}` as Route} aria-label="Top GSM"><span className={styles.symbol}><DesignIcon name="layers" /></span><span><strong translate="no">topgsm<span>.</span></strong><small>{c.tagline}</small></span></Link>
    <nav className={styles.navigation} aria-label={c.nav}><Link href={`/${locale}#services` as Route}>{c.services}</Link><Link href={`/${locale}/products` as Route} aria-current={current === "shop" ? "page" : undefined}>{c.shop}</Link><Link href={`/${locale}#agents` as Route}>{c.specialists}</Link><Link href={`/${locale}/blog` as Route} aria-current={current === "journal" ? "page" : undefined}>{c.journal}</Link><Link href={`/${locale}/contact-us` as Route} aria-current={current === "contact" ? "page" : undefined}>{c.contact}</Link></nav>
    <div className={styles.actions}><HeaderSearch locale={locale} /><CartLink locale={locale} className={styles.cart} current={current === "cart"} />
      <LanguageSwitcher locale={locale} hrefs={languageHrefs ?? { fa: `/fa${currentPath}`, en: `/en${currentPath}`, ar: `/ar${currentPath}` }} />
      <a className={styles.account} href={accountHref ?? `/${locale}/login`}>{accountHref ? c.account : c.login}<DesignIcon name="arrow" /></a>
    </div>
  </header>;
}
