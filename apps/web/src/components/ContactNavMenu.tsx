"use client";

import Link from "next/link";
import type { Route } from "next";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { Locale } from "@/lib/i18n";
import type { TemplateIcon } from "@topgsm/shared-types";
import { DesignIcon } from "./DesignIcon";
import styles from "./PublicHeader.module.css";

const copy = {
  fa: { contact: "تماس با ما", complaints: "ثبت شکایات", menu: "تماس و شکایات" },
  en: { contact: "Contact us", complaints: "Complaints", menu: "Contact and complaints" },
  ar: { contact: "اتصل بنا", complaints: "تقديم شكوى", menu: "التواصل والشكاوى" }
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
  current?: "shop" | "journal" | "cart" | "contact" | "complaints";
}) {
  const c = copy[locale];
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const contactHref = `/${locale}/contact-us`;
  const complaintsHref = `/${locale}/complaints`;
  const active = current === "contact" || current === "complaints";

  const position = useCallback(() => {
    const root = rootRef.current;
    if (!root || !open) return;
    const trigger = root.querySelector("button");
    if (!trigger) return;
    const anchor = trigger.getBoundingClientRect();
    const width = Math.min(220, window.innerWidth - 32);
    const left = locale === "en" ? anchor.left : anchor.right - width;
    root.style.setProperty("--contact-menu-left", `${Math.max(16, Math.min(left, window.innerWidth - width - 16))}px`);
    root.style.setProperty("--contact-menu-top", `${anchor.bottom + 4}px`);
    root.style.setProperty("--contact-menu-width", `${width}px`);
  }, [locale, open]);

  useLayoutEffect(() => {
    if (open) position();
  }, [open, position]);

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const close = () => setOpen(false);
    document.addEventListener("pointerdown", dismiss);
    window.addEventListener("resize", position);
    window.addEventListener("scroll", close, { passive: true, capture: true });
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      window.removeEventListener("resize", position);
      window.removeEventListener("scroll", close, true);
    };
  }, [open, position]);

  return (
    <div
      ref={rootRef}
      className={styles.contactNav}
      data-open={open || undefined}
      data-header-contact
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onBlur={(event) => {
        if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          setOpen(false);
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
        onClick={() => setOpen((value) => !value)}
      >
        <DesignIcon name={icon} />
        <span>{label}</span>
      </button>
      <nav id={panelId} className={styles.contactPanel} aria-label={c.menu} hidden={!open}>
        <Link href={contactHref as Route} aria-current={current === "contact" ? "page" : undefined} onClick={() => setOpen(false)}>
          {c.contact}
        </Link>
        <Link href={complaintsHref as Route} aria-current={current === "complaints" ? "page" : undefined} onClick={() => setOpen(false)}>
          {c.complaints}
        </Link>
      </nav>
    </div>
  );
}
