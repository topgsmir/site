"use client";

import Link from "next/link";
import type { Route } from "next";
import { useCallback, useEffect, useRef } from "react";
import type { Locale } from "@/lib/i18n";
import { DesignIcon } from "../../DesignIcon";
import { AccountIcon } from "../../account/AccountIcon";
import { LogoutButton } from "../../auth/LogoutButton";
import { sideMenuPosition } from "../../dashboard/menu-position";
import styles from "./HeaderAccountMenu.module.css";

const copy = {
  fa: { account: "حساب من", login: "ورود به حساب", orders: "سفارش‌ها", downloads: "دانلودها", wallet: "کیف پول", settings: "تنظیمات حساب", dashboard: "داشبورد مدیریت" },
  en: { account: "My account", login: "Sign in", orders: "Orders", downloads: "Downloads", wallet: "Wallet", settings: "Account settings", dashboard: "Management dashboard" },
  ar: { account: "حسابي", login: "تسجيل الدخول", orders: "الطلبات", downloads: "التنزيلات", wallet: "المحفظة", settings: "إعدادات الحساب", dashboard: "لوحة الإدارة" }
};

export function HeaderAccountMenu({ locale, accountHref, dashboardHref }: { locale: Locale; accountHref?: string | null; dashboardHref?: string | null }) {
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
    const height = Math.min(details.querySelector<HTMLElement>("nav")?.scrollHeight || 320, window.innerHeight / scale - 24);
    const point = sideMenuPosition({left: anchor.left / scale, right: anchor.right / scale, top: anchor.top / scale}, width, height, viewportWidth, window.innerHeight / scale);
    details.style.setProperty("--account-menu-left", point.left + "px");
    details.style.setProperty("--account-menu-top", point.top + "px");
    details.style.setProperty("--account-menu-height", (window.innerHeight / scale - point.top - 12) + "px");
  }, []);
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
        <Link href={`/${locale}/account/downloads` as Route} onClick={close}><AccountIcon name="download" /><span>{c.downloads}</span></Link>
        <Link href={`/${locale}/account/wallet` as Route} onClick={close}><AccountIcon name="wallet" /><span>{c.wallet}</span></Link>
        <Link href={`/${locale}/account/settings` as Route} onClick={close}><DesignIcon name="settings" /><span>{c.settings}</span></Link>
        {dashboardHref ? <Link href={dashboardHref as Route} onClick={close}><AccountIcon name="overview" /><span>{c.dashboard}</span></Link> : null}
        <LogoutButton locale={locale} />
      </>}
    </nav>
  </details>;
}
