import type { MetadataRoute } from "next";
import { locales } from "@/lib/i18n";

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://top-gsm.ir";

  return locales.map((locale) => ({
    url: `${siteUrl}/${locale}`,
    lastModified: new Date(),
    changeFrequency: "daily",
    priority: locale === "fa" ? 1 : 0.8,
    alternates: {
      languages: Object.fromEntries(locales.map((code) => [code, `${siteUrl}/${code}`]))
    }
  }));
}
