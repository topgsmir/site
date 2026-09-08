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
    headers: { accept: "application/json" }
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

export async function getBlogPosts(
  locale: Locale
) {
  return request<BlogPostsPage>(`/blog/public/${locale}/posts?limit=30`);
}

export function getBlogCollection(
  locale: Locale,
  filter: { kind: "categories" | "tags" | "sellers"; slug: string }
) {
  return request<BlogCollectionPage>(
    `/blog/public/${locale}/${filter.kind}/${encodeRouteSegment(filter.slug)}?limit=30`
  );
}

export const getProduct = cache((slug: string) =>
  request<PublicProduct>(`/products/${encodeRouteSegment(slug)}`)
);

export function getProducts() {
  return request<PublicProductSummary[]>("/products?limit=50");
}

export function isApiNotFound(error: unknown) {
  return error instanceof Error && (error as Error & { status?: number }).status === 404;
}
