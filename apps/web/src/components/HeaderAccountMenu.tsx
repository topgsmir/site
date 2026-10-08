"use client";

import Link from "next/link";
import type { Route } from "next";
import { useCallback, useEffect, useRef } from "react";
import type { Locale } from "@/lib/i18n";
import { DesignIcon } from "./DesignIcon";
import { AccountIcon } from "./account/AccountIcon";
import { LogoutButton } from "./auth/LogoutButton";
import styles from "./HeaderAccountMenu.module.css";

const copy = {
  fa: { account: "حساب من", login: "ورود به حساب", orders: "سفارش‌ها", wallet: "کیف پول", settings: "تنظیمات حساب" },
  en: { account: "My account", login: "Sign in", orders: "Orders", wallet: "Wallet", settings: "Account settings" },
  ar: { account: "حسابي", login: "تسجيل الدخول", orders: "الطلبات", wallet: "المحفظة", settings: "إعدادات الحساب" }
};

export function HeaderAccountMenu({ locale, accountHref }: { locale: Locale; accountHref?: string | null }) {
  const c = copy[locale];
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const position = useCallback(() => {
    const details = detailsRef.current;
    if (!details?.open) return;
    const summary = details.querySelector("summary")!;
    const anchor = summary.getBoundingClientRect();
    const scale = anchor.width / summary.offsetWidth;
    const viewportWidth = window.innerWidth / scale;
    const width = Math.min(224, viewportWidth - 32);
    const left = locale === "en" ? anchor.right / scale - width : anchor.left / scale;
    details.style.setProperty("--account-menu-left", Math.max(16, Math.min(left, viewportWidth - width - 16)) + "px");
    details.style.setProperty("--account-menu-top", anchor.bottom / scale + 8 + "px");
    details.style.setProperty("--account-menu-height", Math.max(44, window.innerHeight / scale - anchor.bottom / scale - 24) + "px");
  }, [locale]);
  useEffect(() => {
    const dismiss = (event: PointerEvent) => { if (detailsRef.current && !detailsRef.current.contains(event.target as Node)) detailsRef.current.open = false; };
    document.addEventListener("pointerdown", dismiss);
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, { passive: true, capture: true });
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      window.removeEventListener("resize", position);
      window.removeEventListener("scroll", position, true);
    };
  }, [position]);
  const close = () => { if (detailsRef.current) detailsRef.current.open = false; };
  const label = accountHref ? c.account : c.login;
  return <details ref={detailsRef} className={styles.root} data-header-account onToggle={position} onBlur={(event) => { if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) close(); }} onKeyDown={(event) => {
    if (event.key === "Escape" && detailsRef.current?.open) { close(); detailsRef.current.querySelector("summary")?.focus(); event.preventDefault(); }
  }}>
    <summary aria-label={label} title={label}><AccountIcon name="account" /><AccountIcon className={styles.chevron} name="chevron" /></summary>
    <nav className={styles.panel} aria-label={label}>
      <Link href={(accountHref ?? `/${locale}/login`) as Route} onClick={close}><AccountIcon name="account" /><span>{label}</span></Link>
      {accountHref && <>
        <Link href={`/${locale}/account/orders` as Route} onClick={close}><AccountIcon name="orders" /><span>{c.orders}</span></Link>
        <Link href={`/${locale}/account/wallet` as Route} onClick={close}><AccountIcon name="wallet" /><span>{c.wallet}</span></Link>
        <Link href={`/${locale}/account/settings` as Route} onClick={close}><DesignIcon name="settings" /><span>{c.settings}</span></Link>
        <LogoutButton locale={locale} />
      </>}
    </nav>
  </details>;
}