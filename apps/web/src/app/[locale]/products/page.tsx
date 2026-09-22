import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale, locales } from "@/lib/i18n";
import { getProductsPage } from "@/lib/public-data";
import { PublicHeader } from "@/components/PublicHeader";
import { ProductCatalog } from "@/components/product/ProductCatalog";
import { SITE_URL, catalogCopy, catalogQuery, listingHref, type SearchQuery } from "@/lib/seo";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<SearchQuery> };
async function load({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  let query: ReturnType<typeof catalogQuery>;
  try { query = catalogQuery(await searchParams); } catch { notFound(); }
  const page = await getProductsPage(locale, query.search, query.type, query.cursor);
  return { locale, query, page };
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { locale, query } = await load(props);
  const copy = catalogCopy[locale];
  const title = query.search ? copy.search + ": " + query.search : copy[query.type as "all" | "digital" | "physical" | "service" | "bridge"];
  const canonical = SITE_URL + listingHref("/" + locale + "/products", query);
  return {
    title, description: title + ". " + copy.description,
    alternates: { canonical, ...(!query.cursor && !query.search ? { languages: Object.fromEntries([...locales.map((code) => [code, SITE_URL + listingHref("/" + code + "/products", { type: query.type })]), ["x-default", SITE_URL + listingHref("/fa/products", { type: query.type })]]) } : {}) },
    robots: { index: !query.search, follow: true },
    openGraph: { title, description: copy.description, url: canonical, type: "website" }
  };
}

export default async function ProductsPage(props: Props) {
  const { locale, query, page } = await load(props);
  return <><a className="skip-link" href="#catalog-content">{locale === "fa" ? "رفتن به محصولات" : locale === "ar" ? "انتقل إلى المنتجات" : "Skip to products"}</a><PublicHeader locale={locale} current="shop" /><ProductCatalog locale={locale} products={page.items} initialQuery={query.search} initialType={query.type} cursor={query.cursor} nextCursor={page.nextCursor} /></>;
}
