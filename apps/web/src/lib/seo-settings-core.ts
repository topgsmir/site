import type { Metadata } from "next";
import type { SeoConfiguration, SeoLocale } from "@topgsm/shared-types";

export function seoPath(path: string) {
  try { return decodeURIComponent(path.split("?")[0]!).replace(/\/$/, "").split("/").map(encodeURIComponent).join("/"); }
  catch { return path; }
}
export function isPublicSeoPath(path: string) {
  return /^\/(fa|en|ar)(?:\/(?:contact-us|products(?:\/[^/]+)?|blog(?:\/[^/]+|\/(?:category|tag|seller)\/[^/]+)?))?\/?$/.test(path);
}
export function seoExcluded(configuration: SeoConfiguration, path: string) {
  const normalized = seoPath(path);
  return !configuration.indexingEnabled || configuration.pages.some((item) => item.path === normalized && (item.noIndex || item.excludeFromSitemap)) || configuration.redirects.some((item) => item.enabled && item.source === normalized);
}

export function applySeoConfiguration(configuration: SeoConfiguration, locale: SeoLocale, path: string, base: Metadata, siteUrl: string): Metadata {
  const defaults = configuration.locales.find((item) => item.locale === locale)!;
  const page = configuration.pages.find((item) => item.path === seoPath(path));
  const title = page?.title || (typeof base.title === "string" ? base.title : defaults.siteName);
  const description = page?.description || base.description || defaults.description;
  const image = page?.socialImage || (!base.openGraph?.images ? defaults.socialImage : "");
  const previousRobots = typeof base.robots === "object" ? base.robots : {};
  // Overrides can restrict indexing but cannot publish a translation or search result.
  const index = configuration.indexingEnabled && !page?.noIndex && previousRobots?.index !== false;
  const languages = base.alternates?.languages;
  const filteredLanguages = languages ? Object.fromEntries(Object.entries(languages).filter(([, url]) => {
    if (typeof url !== "string" && !(url instanceof URL)) return true;
    return !seoExcluded(configuration, new URL(String(url), siteUrl).pathname);
  })) : undefined;
  return {
    ...base,
    title: { absolute: defaults.titleTemplate.replace("%s", title) }, description,
    alternates: { ...base.alternates, ...(filteredLanguages ? { languages: filteredLanguages } : {}) },
    robots: { ...previousRobots, index, follow: previousRobots?.follow ?? true,
      googleBot: { ...(typeof previousRobots?.googleBot === "object" ? previousRobots.googleBot : {}), index, follow: previousRobots?.follow ?? true } },
    openGraph: { ...base.openGraph, title, description, siteName: defaults.siteName, ...(image ? { images: [{ url: image, alt: title }] } : {}) },
    twitter: { ...base.twitter, title, description, ...(image ? { card: "summary_large_image", images: [image] } : {}) }
  };
}

export function filterSeoSitemap<T extends { path: string; alternates?: Record<string, string> }>(configuration: SeoConfiguration, entries: T[]): T[] {
  return entries.filter((entry) => !seoExcluded(configuration, entry.path)).map((entry) => ({ ...entry,
    ...(entry.alternates ? { alternates: Object.fromEntries(Object.entries(entry.alternates).filter(([, path]) => !seoExcluded(configuration, path))) } : {})
  }));
}
