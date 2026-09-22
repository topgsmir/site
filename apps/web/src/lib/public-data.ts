import { notFound } from "next/navigation";
import { UUID_CURSOR } from "./seo";
import type { PublicProductsPage } from "@topgsm/shared-types";
import "server-only";
import { cache } from "react";
import type {
  BlogPostsPage,
  BlogCollectionPage,
  PublicBlogPost,
  PublicProduct,
  PublicProductSummary
} from "@topgsm/shared-types";
import type { Locale } from "@/lib/i18n";
import { SERVER_API_BASE } from "@/lib/api/server";

async function request<T>(path: string, revalidate = 300): Promise<T> {
  const response = await fetch(`${SERVER_API_BASE}${path}`, {
    next: { revalidate },
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(10_000)
  });
  if (!response.ok) {
    const error = new Error(`Public API returned ${response.status}`);
    Object.assign(error, { status: response.status });
    throw error;
  }
  return response.json() as Promise<T>;
}

function encodeRouteSegment(value: string) {
  try {
    return encodeURIComponent(decodeURIComponent(value));
  } catch {
    return encodeURIComponent(value);
  }
}

export const getBlogPost = cache((locale: Locale, slug: string) =>
  request<PublicBlogPost | { redirectTo: string | null; permanent: true }>(
    `/blog/public/${locale}/posts/${encodeRouteSegment(slug)}`
  )
);

export const getBlogPosts = cache(async (locale: Locale, cursor?: string) => checkedBlogPage(
  await pageRequest<BlogPostsPage>("/blog/public/" + locale + "/posts?limit=30" + (cursor ? "&cursor=" + encodeURIComponent(cursor) : "")), cursor
));

export function getBlogCollection(locale: Locale, filter: { kind: "categories" | "tags" | "sellers"; slug: string }, cursor?: string) {
  return cachedBlogCollection(locale, filter.kind, filter.slug, cursor);
}

const cachedBlogCollection = cache(async (locale: Locale, kind: "categories" | "tags" | "sellers", slug: string, cursor?: string) => {
  const page = checkedBlogPage(await pageRequest<BlogCollectionPage>("/blog/public/" + locale + "/" + kind + "/" + encodeRouteSegment(slug) + "?limit=30" + (cursor ? "&cursor=" + encodeURIComponent(cursor) : "")), cursor);
  if (!page.collection || typeof page.collection.name !== "string" || !page.collection.alternateSlugs ||
    !["fa", "en", "ar"].every((code) => typeof page.collection.alternateSlugs[code as Locale] === "string" && page.collection.alternateSlugs[code as Locale].length > 0)) throw new Error("Invalid collection payload");
  return page;
});

export const getProduct = cache((slug: string) =>
  request<PublicProduct>(`/products/${encodeRouteSegment(slug)}`)
);

export function getProducts(search = "", type = "all", locale: Locale = "fa") {
  const params = new URLSearchParams({ limit: "50", locale });
  if (search.trim()) params.set("search", search.trim().slice(0, 100));
  if (type !== "all") params.set("type", type);
  return request<PublicProductSummary[]>(`/products?${params}`);
}

export function isApiNotFound(error: unknown) {
  return error instanceof Error && (error as Error & { status?: number }).status === 404;
}


function checkedPage<T extends { items: unknown[]; nextCursor: string | null }>(value: T, cursor?: string): T {
  if (!value || !Array.isArray(value.items) || !(value.nextCursor === null || typeof value.nextCursor === "string" && UUID_CURSOR.test(value.nextCursor)) ||
    !value.items.every((item) => typeof item === "object" && item !== null && "id" in item && typeof item.id === "string" && "title" in item && typeof item.title === "string" && "slug" in item && typeof item.slug === "string")) throw new Error("Invalid public listing payload");
  if (cursor && !value.items.length) notFound();
  return value;
}

async function pageRequest<T>(path: string): Promise<T> {
  try { return await request<T>(path); }
  catch (error) { if (isApiNotFound(error)) notFound(); throw error; }
}

function validMedia(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value !== "object" || !("variants" in value) || !Array.isArray(value.variants)) return false;
  return value.variants.every((variant: unknown) => typeof variant === "object" && variant !== null &&
    "name" in variant && typeof variant.name === "string" && "url" in variant && typeof variant.url === "string" && variant.url.length > 0 &&
    "width" in variant && typeof variant.width === "number" && variant.width > 0 &&
    "height" in variant && typeof variant.height === "number" && variant.height > 0);
}

function checkedBlogPage<T extends BlogPostsPage>(value: T, cursor?: string): T {
  const page = checkedPage(value, cursor);
  if (!page.items.every((post) => (post.excerpt === null || typeof post.excerpt === "string") &&
    (post.publishedAt === null || typeof post.publishedAt === "string" && Number.isFinite(Date.parse(post.publishedAt))) &&
    (!post.author || typeof post.author.name === "string") && (!post.category || typeof post.category.name === "string") && validMedia(post.cover))) {
    throw new Error("Invalid blog listing payload");
  }
  return page;
}

export const getProductsPage = cache(async (locale: Locale, search = "", type = "all", cursor?: string) => {
  const params = new URLSearchParams({ limit: "50", locale });
  if (search) params.set("search", search);
  if (type !== "all") params.set("type", type);
  if (cursor) params.set("cursor", cursor);
  const page = checkedPage(await pageRequest<PublicProductsPage>("/products/page?" + params), cursor);
  if (!page.items.every((product) => ["digital", "physical", "service", "bridge"].includes(product.type) && validMedia(product.image) && (product.category == null || typeof product.category === "string") && Array.isArray(product.startingPrices) &&
    product.startingPrices.every((price) => typeof price.price === "string" && typeof price.currency === "string"))) throw new Error("Invalid product listing payload");
  return page;
});
