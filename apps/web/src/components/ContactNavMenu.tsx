"use client";

import Link from "next/link";
import type { Route } from "next";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { Locale } from "@/lib/i18n";
import type { TemplateIcon } from "@topgsm/shared-types";
import { DesignIcon } from "./DesignIcon";
import styles from "./PublicHeader.module.css";

const copy = {
  fa: { contact: "تماس با ما", about: "درباره ما", complaints: "ثبت شکایات", menu: "تماس، درباره ما و شکایات" },
  en: { contact: "Contact us", about: "About us", complaints: "Complaints", menu: "Contact, about, and complaints" },
  ar: { contact: "اتصل بنا", about: "من نحن", complaints: "تقديم شكوى", menu: "التواصل ومن نحن والشكاوى" }
} as const;

export function ContactNavMenu({
  locale,
  label,
  icon,
  current
}: {
  locale: Locale;
  label: string;
  icon: TemplateIcon;
  current?: "shop" | "journal" | "cart" | "contact" | "about" | "complaints" | "experts";
}) {
  const c = copy[locale];
  const rootRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<number | null>(null);
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const contactHref = `/${locale}/contact-us`;
  const aboutHref = `/${locale}/about-us`;
  const complaintsHref = `/${locale}/complaints`;
  const active = current === "contact" || current === "about" || current === "complaints";

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current == null) return;
    window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = null;
  }, []);

  const openMenu = useCallback(() => {
    clearCloseTimer();
    setOpen(true);
  }, [clearCloseTimer]);

  const closeMenu = useCallback(() => {
    clearCloseTimer();
    setOpen(false);
  }, [clearCloseTimer]);

  const scheduleClose = useCallback(() => {
    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null;
      setOpen(false);
    }, 180);
  }, [clearCloseTimer]);

  const position = useCallback(() => {
    const root = rootRef.current;
    if (!root || !open) return;
    const trigger = root.querySelector("button");
    if (!trigger) return;
    const anchor = trigger.getBoundingClientRect();
    const width = Math.min(240, window.innerWidth - 32);
    const left = locale === "en" ? anchor.left : anchor.right - width;
    root.style.setProperty("--contact-menu-left", `${Math.max(16, Math.min(left, window.innerWidth - width - 16))}px`);
    // Keep a small visual gap; an invisible bridge on the panel covers the travel path.
    root.style.setProperty("--contact-menu-top", `${anchor.bottom + 4}px`);
    root.style.setProperty("--contact-menu-width", `${width}px`);
  }, [locale, open]);

  useLayoutEffect(() => {
    if (open) position();
  }, [open, position]);

  useEffect(() => () => clearCloseTimer(), [clearCloseTimer]);

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) closeMenu();
    };
    const close = () => closeMenu();
    document.addEventListener("pointerdown", dismiss);
    window.addEventListener("resize", position);
    window.addEventListener("scroll", close, { passive: true, capture: true });
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      window.removeEventListener("resize", position);
      window.removeEventListener("scroll", close, true);
    };
  }, [closeMenu, open, position]);

  return (
    <div
      ref={rootRef}
      className={styles.contactNav}
      data-open={open || undefined}
      data-header-contact
      onMouseEnter={openMenu}
      onMouseLeave={scheduleClose}
      onBlur={(event) => {
        if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) closeMenu();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          closeMenu();
          rootRef.current?.querySelector("button")?.focus();
          event.preventDefault();
        }
      }}
    >
      <button
        type="button"
        className={styles.contactTrigger}
        aria-expanded={open}
        aria-controls={panelId}
        aria-current={active ? "page" : undefined}
        aria-label={c.menu}
        onClick={() => {
          clearCloseTimer();
          setOpen((value) => !value);
        }}
      >
        <DesignIcon name={icon} />
        <span>{label}</span>
      </button>
      <nav id={panelId} className={styles.contactPanel} aria-label={c.menu} hidden={!open}>
        <Link href={contactHref as Route} aria-current={current === "contact" ? "page" : undefined} onClick={closeMenu}>
          {c.contact}
        </Link>
        <Link href={aboutHref as Route} aria-current={current === "about" ? "page" : undefined} onClick={closeMenu}>
          {c.about}
        </Link>
        <Link href={complaintsHref as Route} aria-current={current === "complaints" ? "page" : undefined} onClick={closeMenu}>
          {c.complaints}
        </Link>
      </nav>
    </div>
  );
}
