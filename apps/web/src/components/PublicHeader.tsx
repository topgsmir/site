"use client";
import Image from "next/image";
import { useEffect, useRef, useSyncExternalStore } from "react";
import type { TemplateConfiguration } from "@topgsm/shared-types";
import { useTemplateConfiguration } from "./TemplateSettingsProvider";
import Link from "next/link";
import type { Route } from "next";
import { getDirection, type Locale } from "@/lib/i18n";
import { DesignIcon } from "./DesignIcon";
import { HeaderAccountMenu } from "./HeaderAccountMenu";
import styles from "./PublicHeader.module.css";
import { CartLink } from "./CartLink";
import { HeaderSearch } from "./HeaderSearch";
import { HeaderCategories } from "./HeaderCategories";
import { LanguageSwitcher } from "./LanguageSwitcher";

const copy = {
  fa: { tagline: "همراه متخصصان موبایل", announcement: "فایل، آموزش و ابزار تخصصی تعمیرات موبایل", contact: "تماس با ما", services: "خدمات", shop: "فروشگاه", specialists: "کارشناسان", journal: "مجله", login: "ورود به حساب", account: "حساب من", nav: "ناوبری اصلی" },
  en: { tagline: "For the craft of repair", announcement: "Specialist files, training and mobile repair tools", contact: "Contact", services: "Services", shop: "Shop", specialists: "Experts", journal: "Journal", login: "Sign in", account: "My account", nav: "Main navigation" },
  ar: { tagline: "رفيق متخصصي الصيانة", announcement: "ملفات وتدريب وأدوات متخصصة لصيانة الجوال", contact: "اتصل بنا", services: "الخدمات", shop: "المتجر", specialists: "الخبراء", journal: "المجلة", login: "تسجيل الدخول", account: "حسابي", nav: "التنقل الرئيسي" }
};

function subscribeToHeaderScroll(update: () => void) {
  let frame = 0;
  const scroll = () => { if (!frame) frame = requestAnimationFrame(() => { frame = 0; update(); }); };
  window.addEventListener("scroll", scroll, { passive: true, capture: true });
  return () => { window.removeEventListener("scroll", scroll, true); cancelAnimationFrame(frame); };
}
const headerMenuHidden = () => Math.max(window.scrollY, document.body.scrollTop, document.documentElement.scrollTop) > 24;
const headerMenuHiddenOnServer = () => false;

export function PublicHeader({ locale, accountHref, current, languageHrefs, configuration }: { configuration?: TemplateConfiguration; locale: Locale; accountHref?: string | null; current?: "shop" | "journal" | "cart" | "contact"; languageHrefs?: Record<Locale, string> }) {
  const c = copy[locale];
  const menuHidden = useSyncExternalStore(subscribeToHeaderScroll, headerMenuHidden, headerMenuHiddenOnServer);
  const menu = useRef<HTMLDivElement>(null);
  const main = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menuHidden || !menu.current) return;
    // Close popovers before their row leaves the viewport.
    menu.current.querySelectorAll<HTMLDetailsElement>("details[open]").forEach((details) => { details.open = false; });
    if (menu.current.contains(document.activeElement)) main.current?.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true });
  }, [menuHidden]);
  const storedConfiguration = useTemplateConfiguration(locale);
  const settings = configuration ?? storedConfiguration;
  const currentPath = current === "shop" ? "/products" : current === "journal" ? "/blog" : current === "cart" ? "/cart" : current === "contact" ? "/contact-us" : "";

  return (
    <header className={styles.header} dir={getDirection(locale)}>
      {settings.banner.enabled && <Link className={styles.announcement} data-image={Boolean(settings.banner.image)} href={settings.banner.href as Route}>
        {settings.banner.image ? <Image unoptimized className={styles.bannerImage} src={settings.banner.image} alt={settings.banner.imageAlt} width={1600} height={72} /> : <><span>{settings.banner.text}</span>{settings.banner.linkLabel && <span className={styles.announcementAction}>{settings.banner.linkLabel}<DesignIcon name="arrow" /></span>}</>}
      </Link>}
      <div className={styles.mainSurface} data-site-header-main ref={main}>
        <div className={styles.mainRow}>
          <Link className={styles.brand} href={`/${locale}` as Route} aria-label="Top GSM">
            <span className={styles.symbol}><DesignIcon name="layers" /></span>
            <span><strong translate="no">topgsm<span>.</span></strong></span>
          </Link>
          <div className={styles.search}><HeaderSearch locale={locale} variant="wide" /></div>
          <div className={styles.actions}>
            <Link className={styles.support} href={`/${locale}/contact-us` as Route} aria-label={c.contact} title={c.contact}><DesignIcon name="headphones" /></Link>
            <LanguageSwitcher variant="icon" locale={locale} hrefs={languageHrefs ?? { fa: `/fa${currentPath}`, en: `/en${currentPath}`, ar: `/ar${currentPath}` }} />
            <HeaderAccountMenu locale={locale} accountHref={accountHref} />
            <span className={styles.actionDivider} aria-hidden="true" />
            <CartLink locale={locale} className={styles.cart} current={current === "cart"} />
          </div>
        </div>
      </div>
      <div ref={menu} className={styles.secondarySurface} data-hidden={menuHidden} inert={menuHidden} aria-hidden={menuHidden || undefined}>
        <div className={styles.secondaryRow}>
          <HeaderCategories locale={locale} configuration={settings.categories} />
          <nav className={styles.navigation} aria-label={c.nav}>
            {settings.navigation.filter((item) => item.enabled).map((item, index) => <Link key={index} href={item.href as Route} aria-current={currentPath && item.href === `/${locale}${currentPath}` ? "page" : undefined}><DesignIcon name={item.icon} />{item.label}</Link>)}
          </nav>
        </div>
      </div>
    </header>
  );
}
