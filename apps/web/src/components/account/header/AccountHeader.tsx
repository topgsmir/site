"use client";

import Link from "next/link";
import type { Route } from "next";
import type { AppUser } from "@topgsm/shared-types";
import type { Locale } from "@/lib/i18n";
import { dashboardFor } from "@/lib/auth/dashboard-destination";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { AccountIcon } from "../AccountIcon";
import { ACCOUNT_COPY } from "../AccountCopy";
import { WORKSPACE_COPY } from "../AccountWorkspaceCopy";
import styles from "./AccountHeader.module.css";

export function AccountHeader({ locale, user, path }: { locale: Locale; user: AppUser; path: string }) {
  return <header className={styles.header}>
    <Link className={styles.brand} href={`/${locale}` as Route} aria-label="TopGSM">
      <span className={styles.mark} aria-hidden="true"><span /><span /><span /></span>
      <span dir="ltr">topgsm<span>.</span></span>
    </Link>
    <span className={styles.label}>{WORKSPACE_COPY[locale].workspace}</span>
    <div className={styles.actions}>
      <LanguageSwitcher locale={locale} hrefs={{ fa: `/fa${path}`, en: `/en${path}`, ar: `/ar${path}` }} />
      <Link className={styles.cart} href={`/${locale}/cart` as Route} aria-label={ACCOUNT_COPY[locale].cart}><AccountIcon name="cart" /><span>{ACCOUNT_COPY[locale].cart}</span></Link>
      {user.role !== "buyer" ? <Link className={styles.management} href={dashboardFor(user, locale) as Route}>{locale === "fa" ? "داشبورد مدیریت" : locale === "ar" ? "لوحة الإدارة" : "Management dashboard"}</Link> : null}
      <span className={styles.logout}><LogoutButton locale={locale} /></span>
    </div>
  </header>;
}
