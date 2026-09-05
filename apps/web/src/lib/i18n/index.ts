import { fa } from "./translations/fa";
import { en } from "./translations/en";
import { ar } from "./translations/ar";
export { defaultLocale, getDirection, isLocale, locales, localizePath } from "./locales";
export type { Locale } from "./locales";

import type { Locale } from "./locales";

type Dict = Record<string, string>;
interface NestedDict {
  [key: string]: string | NestedDict;
}

type Join<K, P> = K extends string | number
  ? P extends string | number
    ? `${K}.${P}`
    : never
  : never;

type LeafKeys<T> = T extends string
  ? never
  : {
      [K in keyof T & string]: T[K] extends string ? K : Join<K, LeafKeys<T[K]>>;
    }[keyof T & string];

export type TranslationKey = LeafKeys<typeof fa>;

const DICTIONARIES = {
  fa,
  en,
  ar
} satisfies Record<Locale, NestedDict>;

function flatten(prefix: string, obj: Record<string, unknown>, out: Dict = {}) {
  Object.keys(obj).forEach((key) => {
    const value = obj[key];
    const full = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") {
      out[full] = value;
    } else if (typeof value === "object" && value !== null) {
      flatten(full, value as Record<string, unknown>, out);
    }
  });
  return out;
}

const FLAT = {
  fa: flatten("", DICTIONARIES.fa),
  en: flatten("", DICTIONARIES.en),
  ar: flatten("", DICTIONARIES.ar)
} satisfies Record<Locale, Dict>;

export function t(locale: Locale, key: TranslationKey) {
  return FLAT[locale][key] ?? FLAT.fa[key] ?? key;
}

export function getDictionary(locale: Locale) {
  return DICTIONARIES[locale];
}
