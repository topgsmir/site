"use client";

import { useSyncExternalStore } from "react";
import type { Locale } from "@/lib/i18n";

type Theme = "light" | "dark";

const storageKey = "topgsm-theme";
const themeChangeEvent = "topgsm:theme-change";

const labels: Record<Locale, { dark: string; light: string }> = {
  fa: { dark: "فعال کردن حالت تاریک", light: "فعال کردن حالت روشن" },
  en: { dark: "Switch to dark mode", light: "Switch to light mode" },
  ar: { dark: "تفعيل الوضع الداكن", light: "تفعيل الوضع الفاتح" }
};

function readTheme(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", theme === "dark" ? "#080d16" : "#f4f7fb");
}

function getServerTheme(): Theme {
  return "light";
}

function subscribeToTheme(onStoreChange: () => void) {
  function handleStorage(event: StorageEvent) {
    if (event.key !== storageKey) return;
    applyTheme(event.newValue === "dark" ? "dark" : "light");
    onStoreChange();
  }

  window.addEventListener("storage", handleStorage);
  window.addEventListener(themeChangeEvent, onStoreChange);
  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(themeChangeEvent, onStoreChange);
  };
}

export function ThemeToggle({ locale }: { locale: Locale }) {
  const theme = useSyncExternalStore(subscribeToTheme, readTheme, getServerTheme);

  function toggleTheme() {
    const nextTheme: Theme = theme === "dark" ? "light" : "dark";
    applyTheme(nextTheme);

    try {
      localStorage.setItem(storageKey, nextTheme);
    } catch {
      // The visual preference still applies when storage is unavailable.
    }

    window.dispatchEvent(new Event(themeChangeEvent));
  }

  const isDark = theme === "dark";
  const label = isDark ? labels[locale].light : labels[locale].dark;

  return (
    <button
      className="theme-toggle"
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={isDark}
      onClick={toggleTheme}
    >
      <svg className="theme-icon theme-icon-sun" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="3.5" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42" />
      </svg>
      <svg className="theme-icon theme-icon-moon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M20.25 15.31A8.5 8.5 0 0 1 8.69 3.75 8.5 8.5 0 1 0 20.25 15.31Z" />
      </svg>
    </button>
  );
}
