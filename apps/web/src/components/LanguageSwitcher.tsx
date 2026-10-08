"use client";

import { useCallback, useEffect, useRef } from "react";
import type { Locale } from "@/lib/i18n";
import { DesignIcon } from "./DesignIcon";
import styles from "./LanguageSwitcher.module.css";

const languages = ["fa", "en", "ar"] as const;
const names: Record<Locale, string> = { fa: "فارسی", en: "English", ar: "العربية" };
const labels: Record<Locale, string> = { fa: "زبان", en: "Language", ar: "اللغة" };

export function LanguageSwitcher({ locale, hrefs, variant = "label" }: { locale: Locale; hrefs: Record<Locale, string>; variant?: "label" | "icon" }) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const positionIconPanel = useCallback(() => {
    const details = detailsRef.current;
    if (variant !== "icon" || !details?.open) return;
    const anchor = details.querySelector("summary")!.getBoundingClientRect();
    const width = Math.min(216, window.innerWidth - 32);
    const left = locale === "en" ? anchor.right - width : anchor.left;
    details.style.setProperty("--language-menu-left", Math.max(16, Math.min(left, window.innerWidth - width - 16)) + "px");
    details.style.setProperty("--language-menu-top", anchor.bottom + 8 + "px");
  }, [locale, variant]);
  useEffect(() => {
    const dismiss = (event: PointerEvent) => {
      if (detailsRef.current && !detailsRef.current.contains(event.target as Node)) detailsRef.current.open = false;
    };
    document.addEventListener("pointerdown", dismiss);
    window.addEventListener("resize", positionIconPanel);
    window.addEventListener("scroll", positionIconPanel, { passive: true, capture: true });
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      window.removeEventListener("resize", positionIconPanel);
      window.removeEventListener("scroll", positionIconPanel, true);
    };
  }, [positionIconPanel]);
  const label = `${labels[locale]}: ${names[locale]}`;
  return <details ref={detailsRef} className={styles.root} data-variant={variant} onToggle={positionIconPanel} onBlur={(event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false;
  }} onKeyDown={(event) => {
    if (event.key === "Escape" && detailsRef.current?.open) {
      detailsRef.current.open = false;
      detailsRef.current.querySelector("summary")?.focus();
      event.preventDefault();
    }
  }}>
    <summary title={label} aria-label={label}>
      <DesignIcon name="globe" />
      <span className={styles.name} lang={locale} dir={locale === "en" ? "ltr" : "rtl"}>{names[locale]}</span>
      <span className={styles.code} aria-hidden="true">{locale.toUpperCase()}</span>
      <span className={styles.chevron} aria-hidden="true" />
    </summary>
    <nav className={styles.panel} aria-label={labels[locale]}>
      <span className={styles.heading}>{labels[locale]}</span>
      {languages.map((code) => {
        const content = <><span lang={code} dir={code === "en" ? "ltr" : "rtl"}>{names[code]}</span><span className={styles.optionEnd}><small aria-hidden="true">{code.toUpperCase()}</small>{code === locale && <DesignIcon name="check" />}</span></>;
        return code === locale ? <span key={code} className={styles.option} aria-current="page">{content}</span> : <a key={code} className={styles.option} href={hrefs[code]} hrefLang={code} aria-label={names[code]}>{content}</a>;
      })}
    </nav>
  </details>;
}