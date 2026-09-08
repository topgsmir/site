import type { MetadataRoute } from "next";
import { locales } from "@/lib/i18n";
import { SERVER_API_BASE } from "@/lib/api/server";

type PublicProductSummary = {
  id: string;
  slug: string;
  createdAt: string;
};

const PAGE_SIZE = 50;
const MAX_PAGES = 40;

function isProductSummary(value: unknown): value is PublicProductSummary {
  if (typeof value !== "object" || value === null) return false;
  const product = value as Partial<PublicProductSummary>;
  return typeof product.id === "string" && typeof product.slug === "string" && typeof product.createdAt === "string";
}

async function fetchAllProducts() {
  const products: PublicProductSummary[] = [];
  let cursor: string | undefined;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const query = new URLSearchParams({ limit: String(PAGE_SIZE) });
    if (cursor) query.set("cursor", cursor);

    const response = await fetch(`${SERVER_API_BASE}/products?${query}`, {
      headers: { accept: "application/json" },
      next: { revalidate: 3600 }
    });
    if (!response.ok) throw new Error(`Product sitemap API returned ${response.status}`);

    const payload: unknown = await response.json();
    if (!Array.isArray(payload)) throw new Error("Product sitemap API returned an invalid payload");
    const pageProducts = payload.filter(isProductSummary);
    products.push(...pageProducts);

    if (pageProducts.length < PAGE_SIZE) break;
    cursor = pageProducts.at(-1)?.id;
    if (!cursor) break;
  }

  return products;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://top-gsm.ir").replace(/\/+$/, "");

  const homeEntries: MetadataRoute.Sitemap = locales.map((locale) => ({
    url: `${siteUrl}/${locale}`,
    changeFrequency: "daily",
    priority: locale === "fa" ? 1 : 0.8,
    alternates: {
      languages: Object.fromEntries([
        ...locales.map((code) => [code, `${siteUrl}/${code}`]),
        ["x-default", `${siteUrl}/fa`]
      ])
    }
  }));

  let products: PublicProductSummary[] = [];
  try {
    products = await fetchAllProducts();
  } catch (error) {
    console.error("Could not include product routes in sitemap", error);
  }

  const productEntries: MetadataRoute.Sitemap = products.flatMap((product) =>
    locales.map((locale) => ({
      url: `${siteUrl}/${locale}/products/${encodeURIComponent(product.slug)}`,
      lastModified: product.createdAt,
      changeFrequency: "weekly" as const,
      priority: locale === "fa" ? 0.9 : 0.75,
      alternates: {
        languages: Object.fromEntries([
          ...locales.map((code) => [code, `${siteUrl}/${code}/products/${encodeURIComponent(product.slug)}`]),
          ["x-default", `${siteUrl}/fa/products/${encodeURIComponent(product.slug)}`]
        ])
      }
    }))
  );

  return [...homeEntries, ...productEntries];
}
