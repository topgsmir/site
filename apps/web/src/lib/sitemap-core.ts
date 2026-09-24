export const SITEMAP_CHUNK_SIZE = 45_000;
export const SITEMAP_KINDS = ["products", "posts", "categories", "tags", "sellers"] as const;
export type SitemapFeed = { kind: typeof SITEMAP_KINDS[number]; locale: "fa" | "en" | "ar"; count: number };
export type SitemapEntry = { path: string; updatedAt?: string; alternates?: Record<string, string> };
export type SitemapBatch = { items: Array<SitemapEntry & { id: string }>; nextCursor: string | null };

export function staticEntries(): SitemapEntry[] {
  return (["fa", "en", "ar"] as const).flatMap((locale) => ["", "/blog", "/products", "/contact-us", ...["digital", "physical", "service", "bridge"].map((type) => `/products?type=${type}`)].map((suffix) => ({
    path: `/${locale}${suffix}`,
    alternates: Object.fromEntries(["fa", "en", "ar", "x-default"].map((code) => [code, `/${code === "x-default" ? "fa" : code}${suffix}`]))
  })));
}

export function partitionCount(feeds: SitemapFeed[]) {
  return Math.max(1, Math.ceil((staticEntries().length + feeds.reduce((sum, feed) => sum + feed.count, 0)) / SITEMAP_CHUNK_SIZE));
}

export async function partitionEntries(feeds: SitemapFeed[], id: number, read: (feed: SitemapFeed, cursor?: string) => Promise<SitemapBatch>): Promise<SitemapEntry[]> {
  if (!Number.isSafeInteger(id) || id < 0 || id >= partitionCount(feeds)) throw new RangeError("Unknown sitemap partition");
  const start = id * SITEMAP_CHUNK_SIZE;
  const end = start + SITEMAP_CHUNK_SIZE;
  const fixed = staticEntries();
  const result: SitemapEntry[] = fixed.slice(start, end);
  let offset = fixed.length;
  for (const feed of feeds) {
    const feedStart = offset;
    offset += feed.count;
    if (offset <= start || feedStart >= end || feed.count === 0) continue;
    let position = 0;
    let cursor: string | undefined;
    do {
      const batch = await read(feed, cursor);
      if (!batch.items.length || batch.nextCursor === cursor) throw new Error("Incomplete sitemap feed");
      for (const entry of batch.items) {
        if (position >= feed.count || feedStart + position >= end) break;
        if (feedStart + position >= start) result.push(entry);
        position++;
      }
      if (position >= feed.count || feedStart + position >= end) break;
      if (!batch.nextCursor) throw new Error("Sitemap changed during generation");
      cursor = batch.nextCursor;
    } while (position < feed.count && feedStart + position < end);
  }
  return result;
}

export function escapeXml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[char]!);
}

export function sitemapXml(site: string, entries: SitemapEntry[]) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${entries.map((entry) => `<url><loc>${escapeXml(site + entry.path)}</loc>${entry.updatedAt ? `<lastmod>${escapeXml(entry.updatedAt)}</lastmod>` : ""}${Object.entries(entry.alternates ?? {}).map(([locale, path]) => `<xhtml:link rel="alternate" hreflang="${escapeXml(locale)}" href="${escapeXml(site + path)}"/>`).join("")}</url>`).join("")}</urlset>`;
}

export function sitemapIndexXml(site: string, feeds: SitemapFeed[]) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${Array.from({ length: partitionCount(feeds) }, (_, id) => `<sitemap><loc>${escapeXml(site)}/sitemap/${id}.xml</loc></sitemap>`).join("")}</sitemapindex>`;
}
