import type { Locale } from "@/lib/i18n";
import { getBlogPosts } from "@/lib/public-data";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://top-gsm.ir";
const xml = (value: string) => value.replace(/[<>&'"]/g, (character) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[character]!);

export async function atomFeed(locale: Locale) {
  const page = await getBlogPosts(locale).catch(() => ({ items: [], nextCursor: null }));
  const updated = page.items[0]?.updatedAt ?? "1970-01-01T00:00:00.000Z";
  return `<?xml version="1.0" encoding="utf-8"?><feed xmlns="http://www.w3.org/2005/Atom" xml:lang="${locale}"><title>Top GSM Journal</title><id>${SITE_URL}/${locale}/blog</id><link href="${SITE_URL}/${locale}/blog/feed.xml" rel="self"/><link href="${SITE_URL}/${locale}/blog"/><updated>${updated}</updated>${page.items.map((post) => `<entry><title>${xml(post.title)}</title><id>${SITE_URL}/${locale}/blog/${xml(post.slug)}</id><link href="${SITE_URL}/${locale}/blog/${xml(post.slug)}"/><updated>${post.updatedAt}</updated><published>${post.publishedAt ?? post.createdAt}</published><summary>${xml(post.excerpt ?? "")}</summary><author><name>${xml(post.author?.name ?? "Top GSM Editorial")}</name></author></entry>`).join("")}</feed>`;
}

export async function rssFeed(locale: Locale) {
  const page = await getBlogPosts(locale).catch(() => ({ items: [], nextCursor: null }));
  return `<?xml version="1.0" encoding="utf-8"?><rss version="2.0"><channel><title>Top GSM Journal</title><link>${SITE_URL}/${locale}/blog</link><description>Top GSM technical journal</description><language>${locale}</language>${page.items.map((post) => `<item><title>${xml(post.title)}</title><link>${SITE_URL}/${locale}/blog/${xml(post.slug)}</link><guid>${SITE_URL}/${locale}/blog/${xml(post.slug)}</guid><pubDate>${new Date(post.publishedAt ?? post.createdAt).toUTCString()}</pubDate><description>${xml(post.excerpt ?? "")}</description></item>`).join("")}</channel></rss>`;
}
