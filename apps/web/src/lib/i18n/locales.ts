export const locales = ["fa", "en", "ar"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "fa";

export function isLocale(value: string): value is Locale {
  return locales.includes(value as Locale);
}

export function getDirection(locale: Locale) {
  return locale === "fa" || locale === "ar" ? "rtl" : "ltr";
}

export function localizePath(locale: Locale, path = "/") {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `/${locale}${normalizedPath === "/" ? "" : normalizedPath}`;
}
