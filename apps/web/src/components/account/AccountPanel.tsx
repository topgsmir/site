"use client";

import Link from "next/link";
import type { Route } from "next";
import { useRef, useState } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import type { AppUser } from "@topgsm/shared-types";
import type { Locale } from "@/lib/i18n";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { AccountSettings } from "./AccountSettings";
import { AccountOrders } from "./AccountOrders";
import { WalletPanel } from "./WalletPanel";
import { ClubPanel } from "./ClubPanel";
import { AccountIcon } from "./AccountIcon";
import { UserAvatar } from "./UserAvatar";
import { ACCOUNT_COPY } from "./AccountCopy";
import { WORKSPACE_COPY } from "./AccountWorkspaceCopy";
import { AccountDashboard } from "./dashboard/AccountDashboard";
import styles from "./AccountPanel.module.css";

gsap.registerPlugin(useGSAP);

export function AccountPanel({
  locale,
  user,
  view,
}: {
  locale: Locale;
  user: AppUser;
  view: "overview" | "orders" | "settings" | "wallet" | "club";
}) {
  const c = ACCOUNT_COPY[locale];
  const w = WORKSPACE_COPY[locale];
  const [profile, setProfile] = useState(user);
  const shell = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const media = gsap.matchMedia();
      media.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.from("[data-account-enter]", {
          y: 14,
          opacity: 0,
          stagger: 0.06,
          duration: 0.55,
          ease: "power3.out",
          clearProps: "all",
        });
      });
      return () => media.revert();
    },
    { scope: shell, dependencies: [view, locale], revertOnUpdate: true },
  );

  return (
    <div className={styles.shell} ref={shell}>
      <a className="skip-link" href="#account-content">
        {w.overview}
      </a>
      <aside className={styles.sidebar} aria-label={w.profile} data-account-enter>
        <section
          className={styles.profile}
          aria-labelledby="profile-card-title"
        >
          <div className={styles.profileTop}>
                  <UserAvatar className={styles.avatar} name={profile.fullName} url={profile.profilePictureUrl} />
            <span>
              <span className={styles.greeting}>{w.member}</span>
              <h2 id="profile-card-title">
                <bdi>{profile.fullName}</bdi>
              </h2>
            </span>
          </div>
          <dl>
            {profile.supportCode ? (
              <div>
                <dt>
                  {locale === "fa"
                    ? "کد اشتراک"
                    : locale === "ar"
                      ? "معرّف الدعم"
                      : "Support code"}
                </dt>
                <dd>
                  <code dir="ltr" className={styles.supportCode}>
                    {locale === "fa" ? profile.supportCode.replace(/[0-9]/g, digit => "۰۱۲۳۴۵۶۷۸۹"[Number(digit)]) : profile.supportCode}
                  </code>
                </dd>
              </div>
            ) : null}
            {profile.createdAt ? (
              <div>
                <dt>{w.joinedAt}</dt>
                <dd>
                  <time dateTime={profile.createdAt}>
                    {new Intl.DateTimeFormat(locale === "fa" ? "fa-IR-u-ca-persian" : locale, {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                      timeZone: "Asia/Tehran",
                    }).format(new Date(profile.createdAt))}
                  </time>
                </dd>
              </div>
            ) : null}
          </dl>
          <p>{w.profileHint}</p>
          {view === "overview" ? (
            <Link
              className={styles.editLink}
              href={`/${locale}/account/settings` as Route}
            >
              {w.edit}
              <AccountIcon name="arrow" />
            </Link>
          ) : (
            <span className={styles.profileNote}>
              <AccountIcon name="account" />
              {w.savedDetails}
            </span>
          )}
        </section>
        <div className={styles.navbar}>
          <nav className={styles.navigation} aria-label={c.account}>
            {(["overview", "orders", "wallet", "club", "settings"] as const).map((item) => (
              <Link
                key={item}
                href={
                  `/${locale}/account${item === "overview" ? "" : `/${item}`}` as Route
                }
                aria-current={view === item ? "page" : undefined}
              >
                <AccountIcon name={item === "settings" ? "account" : item === "club" ? "wallet" : item} />
                <span>
                  {item === "overview"
                    ? c.overview
                    : item === "orders"
                      ? c.orders
                      : item === "wallet"
                      ? (locale === "fa" ? "کیف پول" : locale === "ar" ? "المحفظة" : "Wallet")
                      : item === "club"
                        ? (locale === "fa" ? "باشگاه مشتریان" : locale === "ar" ? "نادي العملاء" : "Customer club")
                        : w.settings}
                </span>
                <AccountIcon className={styles.navChevron} name="chevron" />
              </Link>
            ))}
          </nav>
          <div className={styles.sidebarActions}>
            <Link href={("/" + locale) as Route} className={styles.homeLink}>
              <AccountIcon name="overview" />
              {locale === "fa" ? "صفحه اصلی" : locale === "ar" ? "الرئيسية" : "Home"}
            </Link>
            <span className={styles.sidebarLogout}><LogoutButton locale={locale} /></span>
          </div>
        </div>
      </aside>
      <main id="account-content" className={styles.main} tabIndex={-1}>
        {view === "overview" ? (
          <h1 className="sr-only">{w.overview}</h1>
        ) : (
          <header className={styles.heading} data-account-enter>
            <p className={styles.greeting}>{c.account}</p>
            <h1>{view === "orders" ? c.history : view === "wallet" ? (locale === "fa" ? "کیف پول" : locale === "ar" ? "المحفظة" : "Wallet") : view === "club" ? (locale === "fa" ? "باشگاه مشتریان" : locale === "ar" ? "نادي العملاء" : "Customer club") : w.settings}</h1>
            <p>{view === "orders" ? w.ordersIntro : view === "wallet" ? (locale === "fa" ? "موجودی و تراکنش‌های خود را مدیریت کنید." : locale === "ar" ? "أدر رصيدك ومعاملاتك." : "Manage your balance and transactions.") : view === "club" ? (locale === "fa" ? "امتیازها، سطح و جوایز خود را ببینید." : locale === "ar" ? "راجع نقاطك ومستواك ومكافآتك." : "Review your points, tier and rewards.") : w.settingsIntro}</p>
          </header>
        )}
        {view === "overview" ? (
          <AccountDashboard locale={locale} />
        ) : (
          <div className={styles.fullContent}>
            {view === "wallet" ? <WalletPanel locale={locale} /> : view === "club" ? <ClubPanel locale={locale} /> : view === "settings" ? (
              <AccountSettings locale={locale} user={profile} onUpdated={setProfile} />
            ) : (
              <AccountOrders locale={locale} view="orders" />
            )}
          </div>
        )}
      </main>
      <footer className={styles.footer}>
        <span dir="ltr">topgsm.</span>
        <p>{w.footer}</p>
        <Link href={`/${locale}/products` as Route}>
          {c.shop}
          <AccountIcon name="arrow" />
        </Link>
      </footer>
    </div>
  );
}
