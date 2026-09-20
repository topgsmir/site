"use client";

import { useEffect, useRef } from "react";
import type { Locale } from "@/lib/i18n";
import { DesignIcon } from "./DesignIcon";
import styles from "./LanguageSwitcher.module.css";

const languages = ["fa", "en", "ar"] as const;
const names: Record<Locale, string> = { fa: "فارسی", en: "English", ar: "العربية" };
const labels: Record<Locale, string> = { fa: "زبان", en: "Language", ar: "اللغة" };

export function LanguageSwitcher({ locale, hrefs }: { locale: Locale; hrefs: Record<Locale, string> }) {
  const detailsRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    function dismissOnOutsideClick(event: PointerEvent) {
      if (detailsRef.current && !detailsRef.current.contains(event.target as Node)) {
        detailsRef.current.open = false;
      }
    }

    document.addEventListener("pointerdown", dismissOnOutsideClick);
    return () => document.removeEventListener("pointerdown", dismissOnOutsideClick);
  }, []);

  return (
    <details
      ref={detailsRef}
      className={styles.root}
      onKeyDown={(event) => {
        if (event.key === "Escape" && detailsRef.current?.open) {
          detailsRef.current.open = false;
          detailsRef.current.querySelector("summary")?.focus();
          event.preventDefault();
        }
      }}
    >
      <summary aria-label={`${labels[locale]}: ${names[locale]}`}>
        <DesignIcon name="globe" />
        <span className={styles.name} lang={locale} dir={locale === "en" ? "ltr" : "rtl"}>{names[locale]}</span>
        <span className={styles.code} aria-hidden="true">{locale.toUpperCase()}</span>
        <span className={styles.chevron} aria-hidden="true" />
      </summary>
      <nav className={styles.panel} aria-label={labels[locale]}>
        <span className={styles.heading}>{labels[locale]}</span>
        {languages.map((code) => {
          const content = <>
            <span lang={code} dir={code === "en" ? "ltr" : "rtl"}>{names[code]}</span>
            <span className={styles.optionEnd}>
              <small aria-hidden="true">{code.toUpperCase()}</small>
              {code === locale && <DesignIcon name="check" />}
            </span>
          </>;

          return code === locale
            ? <span key={code} className={styles.option} aria-current="page">{content}</span>
            : <a key={code} className={styles.option} href={hrefs[code]} hrefLang={code} aria-label={names[code]}>{content}</a>;
        })}
      </nav>
    </details>
  );
}
