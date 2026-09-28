import { BadRequestException } from "@nestjs/common";
import type { SeoConfiguration } from "@topgsm/shared-types";

export function defaultSeoConfiguration(): SeoConfiguration {
  return {
    indexingEnabled: true,
    locales: ["fa", "en", "ar"].map((locale) => ({ locale: locale as "fa" | "en" | "ar", siteName: "Top GSM", titleTemplate: "%s | Top GSM", description: "", socialImage: "" })),
    googleVerification: "", bingVerification: "", organizationName: "Top GSM", organizationLogo: "", sameAs: [], pages: [], redirects: []
  };
}

/** Exact public paths only. Keep this in step with the storefront route families. */
export function normalizeSeoPath(value: string): string {
  let decoded: string;
  try { decoded = decodeURIComponent(value.trim()); } catch { throw new BadRequestException("Invalid URL encoding"); }
  if (/[.\\\s<>?#%]/u.test(decoded) || [...decoded].some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127) || decoded.includes("//")) throw new BadRequestException("Use an exact public path without dots, a query or fragment");
  decoded = decoded.replace(/\/$/, "");
  if (!/^\/(fa|en|ar)(?:\/(?:contact-us|products(?:\/[^/]+)?|blog(?:\/[^/]+|\/(?:category|tag|seller)\/[^/]+)?))?$/.test(decoded)) throw new BadRequestException("Only localized home, catalog, product, blog and contact paths are supported");
  const normalized = decoded.split("/").map(encodeURIComponent).join("/");
  if (normalized.length > 500) throw new BadRequestException("Encoded paths must be at most 500 characters");
  return normalized;
}

function httpsUrl(value: string, optional = true) {
  if (optional && !value) return "";
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || /[\s<>]/.test(value)) throw new Error();
    return url.href;
  } catch { throw new BadRequestException("Images and profile links must be absolute HTTPS URLs without credentials"); }
}

export function validateSeoConfiguration(input: SeoConfiguration): SeoConfiguration {
  const configuration = structuredClone(input);
  if (new Set(configuration.locales.map((item) => item.locale)).size !== 3) throw new BadRequestException("Provide each language exactly once");
  for (const item of configuration.locales) {
    item.siteName = item.siteName.trim(); item.description = item.description.trim();
    if (!item.siteName) throw new BadRequestException("Site name is required");
    item.socialImage = httpsUrl(item.socialImage.trim());
  }
  configuration.organizationName = configuration.organizationName.trim();
  if (!configuration.organizationName) throw new BadRequestException("Organization name is required");
  configuration.organizationLogo = httpsUrl(configuration.organizationLogo.trim());
  configuration.sameAs = [...new Set(configuration.sameAs.map((url) => httpsUrl(url.trim(), false)))];
  const pages = new Set<string>();
  for (const item of configuration.pages) {
    item.path = normalizeSeoPath(item.path);
    if (pages.has(item.path)) throw new BadRequestException("Duplicate page path");
    pages.add(item.path);
    item.title = item.title.trim(); item.description = item.description.trim();
    item.socialImage = httpsUrl(item.socialImage.trim());
  }
  const sources = new Set<string>();
  for (const item of configuration.redirects) {
    item.source = normalizeSeoPath(item.source); item.destination = normalizeSeoPath(item.destination);
    if (sources.has(item.source)) throw new BadRequestException("Duplicate redirect source");
    sources.add(item.source);
    if (item.source === item.destination) throw new BadRequestException("A redirect cannot point to itself");
    if (/\/products\/[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(item.destination)) throw new BadRequestException("Use a product slug, not a legacy product ID, as the redirect destination");
  }
  const active = new Set(configuration.redirects.filter((item) => item.enabled).map((item) => item.source));
  if (configuration.redirects.some((item) => item.enabled && active.has(item.destination))) throw new BadRequestException("Redirect chains and loops are not allowed; use the final destination");
  if (Buffer.byteLength(JSON.stringify(configuration), "utf8") > 524288) throw new BadRequestException("SEO configuration must not exceed 512 KiB");
  return configuration;
}
