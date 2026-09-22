"use client";

import { useEffect, useId, useRef, useSyncExternalStore, type ReactNode } from "react";
import Link from "next/link";
import type { Route } from "next";
import type { Locale } from "@/lib/i18n";
import styles from "./DashboardMobileNavigation.module.css";

const query = "(max-width: 59.999rem)";
function subscribe(callback: () => void) {
  const media = window.matchMedia(query);
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}
const getSnapshot = () => window.matchMedia(query).matches;
const getServerSnapshot = () => false;
const copy = {
  en: { menu: "Menu", title: "All sections", close: "Close menu", store: "Visit store" },
  fa: { menu: "منو", title: "همه بخش‌ها", close: "بستن منو", store: "رفتن به فروشگاه" },
  ar: { menu: "القائمة", title: "كل الأقسام", close: "إغلاق القائمة", store: "زيارة المتجر" }
};

type Shortcut = { label: string; icon: ReactNode; active: boolean; count?: number } &
  ({ href: Route; onClick?: never } | { href?: never; onClick: () => void });

export function DashboardMobileNavigation({ locale, title, currentLabel, shortcuts, children }: {
  locale: Locale;
  title: string;
  currentLabel: string;
  shortcuts: Shortcut[];
  children: ReactNode;
}) {
  const mobile = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const scrollStyle = useRef<string | null>(null);
  const id = useId();
  const c = copy[locale];

  function unlockScroll() {
    if (scrollStyle.current === null) return;
    document.body.style.overflow = scrollStyle.current;
    scrollStyle.current = null;
  }
  function closeMenu() {
    dialog.current?.close();
    unlockScroll();
  }
  function openMenu() {
    if (!dialog.current || dialog.current.open) return;
    scrollStyle.current = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current.showModal();
  }
  useEffect(() => () => unlockScroll(), [mobile]);

  return <>
    <header className={styles.header} data-navigation-surface>
      <div><span>{title}</span><strong>{currentLabel}</strong></div>
      <Link href={`/${locale}`} aria-label={c.store} className={styles.brand} dir="ltr" translate="no">topgsm.</Link>
    </header>
    {!mobile ? <div className={styles.desktop}>{children}</div> : null}
    <nav className={styles.dock} data-navigation-surface aria-label={title}>
      {shortcuts.map((item) => {
        const content = <><span className={styles.icon}>{item.icon}{item.count ? <b>{item.count > 99 ? "99+" : item.count.toLocaleString(locale)}</b> : null}</span><span>{item.label}</span></>;
        const props = { className: styles.tab, "aria-current": item.active ? "page" as const : undefined };
        return item.href ? <Link key={item.label} href={item.href} {...props}>{content}</Link>
          : <button key={item.label} type="button" onClick={item.onClick} {...props}>{content}</button>;
      })}
      <button ref={trigger} type="button" className={styles.tab} onClick={openMenu} aria-haspopup="dialog" aria-controls={id} data-active={!shortcuts.some((item) => item.active)}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="6" height="6" rx="1.5" /><rect x="14" y="4" width="6" height="6" rx="1.5" /><rect x="4" y="14" width="6" height="6" rx="1.5" /><rect x="14" y="14" width="6" height="6" rx="1.5" /></svg>
        <span>{c.menu}</span>
      </button>
    </nav>
    {mobile ? <dialog ref={dialog} id={id} className={styles.sheet} data-navigation-surface aria-labelledby={`${id}-title`} dir={locale === "en" ? "ltr" : "rtl"}
      onClose={() => { unlockScroll(); trigger.current?.focus({ preventScroll: true }); }}
      onClick={(event) => { if (event.target === event.currentTarget) closeMenu(); }}>
      <div className={styles.sheetHeading}><div><span>{title}</span><h2 id={`${id}-title`}>{c.title}</h2></div><button type="button" onClick={closeMenu} aria-label={c.close}>×</button></div>
      <div className={styles.sheetBody} onClick={(event) => {
        const target = event.target as HTMLElement;
        const action = target.closest("a, button");
        if (action && !action.hasAttribute("aria-expanded")) closeMenu();
      }}>{children}</div>
    </dialog> : null}
  </>;
}
