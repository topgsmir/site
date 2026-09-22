import "server-only";
import { unstable_cache } from "next/cache";
import { SERVER_API_BASE } from "./api/server";
import { SITEMAP_KINDS, type SitemapFeed, type SitemapBatch } from "./sitemap-core";
import { UUID_CURSOR } from "./seo";

const record = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;
const safePath = (value: unknown): value is string => typeof value === "string" && /^\/(fa|en|ar)\//.test(value) && !/[<>\s\\]/.test(value);
async function request(path: string): Promise<unknown> {
  const response = await fetch(SERVER_API_BASE + path, { cache: "no-store", headers: { accept: "application/json" }, signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`Sitemap API returned ${response.status}`);
  return response.json();
}

export const sitemapManifest = unstable_cache(async (): Promise<SitemapFeed[]> => {
  const data = await request("/seo/sitemap/manifest");
  if (!record(data) || !Array.isArray(data.feeds) || data.feeds.length !== 15) throw new Error("Invalid sitemap manifest");
  const seen = new Set<string>();
  for (const feed of data.feeds) {
    if (!record(feed) || !SITEMAP_KINDS.includes(feed.kind as SitemapFeed["kind"]) || !["fa", "en", "ar"].includes(String(feed.locale)) || !Number.isSafeInteger(feed.count) || (feed.count as number) < 0) throw new Error("Invalid sitemap count");
    const key = `${feed.kind}:${feed.locale}`;
    if (seen.has(key)) throw new Error("Duplicate sitemap feed");
    seen.add(key);
  }
  return data.feeds as SitemapFeed[];
}, ["seo-sitemap-manifest-v1"], { revalidate: 3600 });

export const sitemapBatch = unstable_cache(async (kind: SitemapFeed["kind"], locale: SitemapFeed["locale"], cursor?: string): Promise<SitemapBatch> => {
  const query = new URLSearchParams({ kind, locale });
  if (cursor) query.set("cursor", cursor);
  const data = await request(`/seo/sitemap?${query}`);
  if (!record(data) || !Array.isArray(data.items) || data.items.length > 1000 || !(data.nextCursor === null || typeof data.nextCursor === "string" && UUID_CURSOR.test(data.nextCursor))) throw new Error("Invalid sitemap batch");
  let previous = cursor ?? "";
  for (const row of data.items) {
    if (!record(row) || typeof row.id !== "string" || !UUID_CURSOR.test(row.id) || row.id <= previous || !safePath(row.path) || typeof row.updatedAt !== "string" || !Number.isFinite(Date.parse(row.updatedAt)) ||
      row.alternates !== undefined && (!record(row.alternates) || !Object.entries(row.alternates).every(([code, path]) => ["fa", "en", "ar", "x-default"].includes(code) && safePath(path)))) throw new Error("Invalid sitemap entry");
    previous = row.id;
  }
  if (data.nextCursor !== null && data.nextCursor !== previous) throw new Error("Invalid sitemap cursor");
  return data as SitemapBatch;
}, ["seo-sitemap-batch-v1"], { revalidate: 3600 });

export function sitemapUnavailable() {
  return new Response("Sitemap temporarily unavailable", { status: 503, headers: { "Retry-After": "300", "Cache-Control": "no-store", "Content-Type": "text/plain; charset=utf-8" } });
}

export function xmlResponse(xml: string) {
  return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
