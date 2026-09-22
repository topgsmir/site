import type { BlogCollectionPage } from "@topgsm/shared-types";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { isLocale, locales } from "./i18n";
import { getBlogCollection, getBlogPosts } from "./public-data";
import { cursorFrom, listingHref, SITE_URL, type SearchQuery } from "./seo";
import { BlogIndex } from "@/components/blog/BlogIndex";

export type BlogListingProps = { params: Promise<{ locale: string; slug?: string; sellerId?: string }>; searchParams: Promise<SearchQuery> };
type Kind = "categories" | "tags" | "sellers";
const segments = { categories: "category", tags: "tag", sellers: "seller" };
const copy = {
  fa: { title: "مجله فنی موبایل", description: "راهنماهای فنی، مقایسه محصولات و تجربه واقعی فروشندگان تاپ جی‌اس‌ام." },
  en: { title: "Mobile technology journal", description: "Technical guides, product comparisons, and first-hand knowledge from Top GSM sellers." },
  ar: { title: "مجلة تقنية للهواتف", description: "أدلة تقنية ومقارنات منتجات وخبرة مباشرة من بائعي Top GSM." }
};

async function load(props: BlogListingProps, kind?: Kind) {
  const { locale, slug, sellerId } = await props.params;
  if (!isLocale(locale)) notFound();
  let cursor: string | undefined;
  try { cursor = cursorFrom(await props.searchParams); } catch { notFound(); }
  const page = kind ? await getBlogCollection(locale, { kind, slug: (kind === "sellers" ? sellerId : slug)! }, cursor) : await getBlogPosts(locale, cursor);
  const collection = kind ? (page as BlogCollectionPage).collection : undefined;
  const pathFor = (code: typeof locale) => `/${code}/blog${kind ? `/${segments[kind]}/${encodeURIComponent(collection!.alternateSlugs[code])}` : ""}`;
  const path = pathFor(locale);
  return { locale, cursor, page, collection, path, pathFor };
}

export async function blogListingMetadata(props: BlogListingProps, kind?: Kind): Promise<Metadata> {
  const { locale, cursor, page, collection, path, pathFor } = await load(props, kind);
  const title = collection?.name ?? copy[locale].title;
  const canonical = SITE_URL + listingHref(path, { cursor });
  return {
    title, description: copy[locale].description,
    alternates: { canonical, ...(!cursor ? { languages: Object.fromEntries([...locales.map((code) => [code, SITE_URL + pathFor(code)]), ["x-default", SITE_URL + pathFor("fa")]]) } : {}) },
    robots: { index: !collection || page.items.length > 0, follow: true },
    openGraph: { title, description: copy[locale].description, type: "website", url: canonical },
    twitter: { card: "summary_large_image", title, description: copy[locale].description }
  };
}

export async function BlogListing(props: BlogListingProps & { kind?: Kind }) {
  const { locale, cursor, page, collection, path, pathFor } = await load(props, props.kind);
  return <BlogIndex locale={locale} posts={page.items} heading={collection ? `${props.kind === "tags" ? "#" : ""}${collection.name}` : undefined}
    languageHrefs={{ fa: pathFor("fa"), en: pathFor("en"), ar: pathFor("ar") }}
    firstHref={cursor ? path : undefined} nextHref={page.nextCursor ? listingHref(path, { cursor: page.nextCursor }) : undefined} />;
}
