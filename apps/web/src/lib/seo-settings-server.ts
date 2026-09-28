import "server-only";
import { unstable_cache } from "next/cache";
import type { Metadata } from "next";
import type { SeoConfiguration, SeoLocale } from "@topgsm/shared-types";
import { SERVER_API_BASE } from "./api/server";
import { SITE_URL } from "./seo";
import { applySeoConfiguration } from "./seo-settings-core";

export const getSeoConfiguration = unstable_cache(async (): Promise<SeoConfiguration> => {
  const response = await fetch(`${SERVER_API_BASE}/seo/configuration`, { cache: "no-store", signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error("SEO configuration unavailable");
  return response.json() as Promise<SeoConfiguration>;
}, ["seo-configuration-v1"], { revalidate: 60 });

export async function managedSeoMetadata(locale: SeoLocale, path: string, base: Metadata) {
  return applySeoConfiguration(await getSeoConfiguration(), locale, path, base, SITE_URL);
}
