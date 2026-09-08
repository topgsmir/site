import type { MetadataRoute } from "next";
import { SERVER_API_BASE } from "@/lib/api/server";
import { locales } from "@/lib/i18n";

export const SITEMAP_CHUNK_SIZE = 45_000;
export const SITEMAP_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://top-gsm.ir";

type ProductRow = { slug: string; updated_at: string };
type BlogRow = { locale: "fa" | "en" | "ar"; slug: string; post: { updated_at: string } };
type BlogProjection = {
  posts: BlogRow[];
  categories: Array<{ locale: "fa" | "en" | "ar"; slug: string; category: { updated_at: string } }>;
  tags: Array<{ locale: "fa" | "en" | "ar"; slug: string; tag: { updated_at: string } }>;
  sellers: Array<{ id: string; blog_posts: Array<{ updated_at: string }> }>;
};

const EMPTY_BLOG: BlogProjection = { posts: [], categories: [], tags: [], sellers: [] };

export async function getSitemapEntries(): Promise<MetadataRoute.Sitemap> {
  const [products, blog] = await Promise.all([
    fetch(`${SERVER_API_BASE}/products/sitemap`, { next: { revalidate: 3600 } })
      .then((response) => response.ok ? response.json() as Promise<ProductRow[]> : []),
    fetch(`${SERVER_API_BASE}/blog/public/sitemap`, { next: { revalidate: 3600 } })
      .then((response) => response.ok ? response.json() as Promise<BlogProjection> : EMPTY_BLOG)
  ]).catch(() => [[], EMPTY_BLOG] as [ProductRow[], BlogProjection]);
  return [
    ...locales.flatMap((locale) => [
      {
        url: `${SITEMAP_SITE_URL}/${locale}`,
        changeFrequency: "daily" as const,
        priority: locale === "fa" ? 1 : 0.8,
        alternates: { languages: Object.fromEntries(locales.map((code) => [code, `${SITEMAP_SITE_URL}/${code}`])) }
      },
      {
        url: `${SITEMAP_SITE_URL}/${locale}/blog`,
        changeFrequency: "daily" as const,
        priority: 0.8,
        alternates: { languages: Object.fromEntries(locales.map((code) => [code, `${SITEMAP_SITE_URL}/${code}/blog`])) }
      }
    ]),
    ...products.map((product) => ({
      url: `${SITEMAP_SITE_URL}/fa/products/${product.slug}`,
      lastModified: new Date(product.updated_at),
      changeFrequency: "weekly" as const,
      priority: 0.7
    })),
    ...blog.posts.map((post) => ({
      url: `${SITEMAP_SITE_URL}/${post.locale}/blog/${post.slug}`,
      lastModified: new Date(post.post.updated_at),
      changeFrequency: "weekly" as const,
      priority: 0.65
    })),
    ...blog.categories.map((category) => ({
      url: `${SITEMAP_SITE_URL}/${category.locale}/blog/category/${category.slug}`,
      lastModified: new Date(category.category.updated_at),
      changeFrequency: "weekly" as const,
      priority: 0.45
    })),
    ...blog.tags.map((tag) => ({
      url: `${SITEMAP_SITE_URL}/${tag.locale}/blog/tag/${tag.slug}`,
      lastModified: new Date(tag.tag.updated_at),
      changeFrequency: "weekly" as const,
      priority: 0.4
    })),
    ...blog.sellers.flatMap((seller) => locales.map((locale) => ({
      url: `${SITEMAP_SITE_URL}/${locale}/blog/seller/${seller.id}`,
      lastModified: new Date(seller.blog_posts[0]?.updated_at ?? 0),
      changeFrequency: "weekly" as const,
      priority: 0.45
    })))
  ];
}

export async function generateSitemaps() {
  const rows = await getSitemapEntries();
  return Array.from({ length: Math.max(1, Math.ceil(rows.length / SITEMAP_CHUNK_SIZE)) }, (_, id) => ({ id }));
}

export default async function sitemap({ id }: { id: Promise<number> }): Promise<MetadataRoute.Sitemap> {
  const page = await id;
  const rows = await getSitemapEntries();
  return rows.slice(page * SITEMAP_CHUNK_SIZE, (page + 1) * SITEMAP_CHUNK_SIZE);
}
