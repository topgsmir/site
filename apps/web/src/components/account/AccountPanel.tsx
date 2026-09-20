"use client";

import Link from "next/link";
import Image from "next/image";
import type { Route } from "next";
import { useRef, useState } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { AppUser } from "@topgsm/shared-types";
import type { Locale } from "@/lib/i18n";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { CustomerLeaderboard } from "./CustomerLeaderboard";
import { AccountSettings } from "./AccountSettings";
import { AccountOrders } from "./AccountOrders";
import { AccountIcon } from "./AccountIcon";
import { ACCOUNT_COPY } from "./AccountCopy";
import { WORKSPACE_COPY } from "./AccountWorkspaceCopy";
import styles from "./AccountPanel.module.css";

gsap.registerPlugin(useGSAP, ScrollTrigger);

export function AccountPanel({ locale, user, view }: { locale: Locale; user: AppUser; view: "overview" | "orders" | "settings" }) {
  const c = ACCOUNT_COPY[locale];
  const w = WORKSPACE_COPY[locale];
  const [profile, setProfile] = useState(user);
  const shell = useRef<HTMLDivElement>(null);
  const path = view === "overview" ? "/account" : `/account/${view}`;
  const initials = profile.fullName.trim().split(/\s+/).slice(0, 2).map((part) => Array.from(part)[0]).join("");

  useGSAP(() => {
    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.from("[data-account-enter]", { y: 14, opacity: 0, stagger: .06, duration: .55, ease: "power3.out", clearProps: "all" });
      if (view === "overview") {
        gsap.fromTo("[data-account-art]", { scale: 1 }, { scale: 1.07, ease: "none", scrollTrigger: { trigger: "[data-account-welcome]", start: "top top", end: "bottom top", scrub: 1, scroller: locale === "en" ? window : document.body } });
      }
    });
    return () => media.revert();
  }, { scope: shell, dependencies: [view, locale], revertOnUpdate: true });

  return <div className={styles.shell} ref={shell}>
    <a className="skip-link" href="#account-content">{w.overview}</a>
    <header className={styles.topbar}>
      <Link className={styles.brand} href={`/${locale}` as Route} aria-label="TopGSM"><span className={styles.brandMark} aria-hidden="true"><span /><span /><span /></span><span dir="ltr">topgsm<span>.</span></span></Link>
      <span className={styles.topbarLabel}>{w.workspace}</span>
      <div className={styles.toplinks}>
        <LanguageSwitcher locale={locale} hrefs={{ fa: `/fa${path}`, en: `/en${path}`, ar: `/ar${path}` }} />
        <Link className={styles.cartLink} href={`/${locale}/cart` as Route} aria-label={c.cart}><AccountIcon name="cart" /><span>{c.cart}</span></Link>
        <span className={styles.logout}><LogoutButton locale={locale} /></span>
      </div>
    </header>
    <div className={styles.navbar}>
      <nav className={styles.navigation} aria-label={c.account}>
        {(["overview", "orders", "settings"] as const).map((item) => <Link key={item} href={`/${locale}/account${item === "overview" ? "" : `/${item}`}` as Route} aria-current={view === item ? "page" : undefined}><AccountIcon name={item === "settings" ? "account" : item} /><span>{item === "overview" ? c.overview : item === "orders" ? c.orders : w.settings}</span></Link>)}
      </nav>
      <Link href={`/${locale}/products` as Route} className={styles.storeLink}>{c.shop}<AccountIcon name="arrow" /></Link>
    </div>
    <main id="account-content" className={styles.main} tabIndex={-1}>
      {view === "overview" ? <section className={styles.welcome} data-account-enter data-account-welcome>
        <div className={styles.welcomeCopy}><p className={styles.greeting}>{c.greeting}{locale === "en" ? ", " : "، "}<bdi>{profile.fullName}</bdi></p><h1>{w.welcome}</h1><p>{w.intro}</p><Link className={styles.primaryLink} href={`/${locale}/products` as Route}>{w.browse}<AccountIcon name="arrow" /></Link></div>
        <div className={styles.welcomeArt} aria-hidden="true"><Image data-account-art src="/images/repair-studio.png" alt="" fill sizes="(max-width: 700px) 100vw, 480px" priority /><div className={styles.artCaption}><span className={styles.artDot} /><span dir="ltr">TOPGSM / REPAIR WORKSPACE</span></div></div>
      </section> : <header className={styles.heading} data-account-enter><p className={styles.greeting}>{c.account}</p><h1>{view === "orders" ? c.history : w.settings}</h1><p>{view === "orders" ? w.ordersIntro : w.settingsIntro}</p></header>}
      <div className={view === "orders" ? styles.fullContent : styles.content}>
        <div className={styles.primaryColumn} data-account-enter>
          {view === "settings" ? <AccountSettings locale={locale} user={profile} onUpdated={setProfile} /> : <AccountOrders locale={locale} view={view} />}
          {view === "overview" ? <Link className={styles.discover} href={`/${locale}/products` as Route}><span className={styles.discoverIcon}><AccountIcon name="file" /></span><span><strong>{w.discover}</strong><span>{w.discoverHint}</span></span><AccountIcon name="arrow" /></Link> : null}
        </div>
        {view !== "orders" ? <aside className={styles.secondaryColumn} aria-label={w.profile} data-account-enter>
          <section className={styles.profile} aria-labelledby="profile-card-title"><div className={styles.profileTop}><span className={styles.avatar} aria-hidden="true">{initials}</span><span><span className={styles.greeting}>{w.member}</span><h2 id="profile-card-title"><bdi>{profile.fullName}</bdi></h2></span></div><dl>{profile.email ? <div><dt>{c.email}</dt><dd><bdi>{profile.email}</bdi></dd></div> : null}{profile.username ? <div><dt>{locale === "fa" ? "نام کاربری" : locale === "ar" ? "اسم المستخدم" : "Username"}</dt><dd><bdi>@{profile.username}</bdi></dd></div> : null}</dl><p>{w.profileHint}</p>{view === "overview" ? <Link className={styles.editLink} href={`/${locale}/account/settings` as Route}>{w.edit}<AccountIcon name="arrow" /></Link> : <span className={styles.profileNote}><AccountIcon name="account" />{w.savedDetails}</span>}</section>
          {view === "overview" ? <CustomerLeaderboard locale={locale} /> : null}
        </aside> : null}
      </div>
      <footer className={styles.footer}><span dir="ltr">topgsm.</span><p>{w.footer}</p><Link href={`/${locale}/products` as Route}>{c.shop}<AccountIcon name="arrow" /></Link></footer>
    </main>
  </div>;
}
