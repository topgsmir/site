import { partitionEntries, sitemapXml, partitionCount } from "@/lib/sitemap-core";
import { sitemapManifest, sitemapBatch, sitemapUnavailable, xmlResponse } from "@/lib/sitemap-server";
import { SITE_URL } from "@/lib/seo";

export const dynamic = "force-dynamic";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^(0|[1-9]\d*)\.xml$/.test(id)) return new Response("Not found", { status: 404 });
  const page = Number(id.slice(0, -4));
  try {
    const feeds = await sitemapManifest();
    if (!Number.isSafeInteger(page) || page >= partitionCount(feeds)) return new Response("Not found", { status: 404 });
    const deadline = Date.now() + 60_000;
    const entries = await partitionEntries(feeds, page, (feed, cursor) => {
      if (Date.now() > deadline) throw new Error("Sitemap generation timed out");
      return sitemapBatch(feed.kind, feed.locale, cursor);
    });
    return xmlResponse(sitemapXml(SITE_URL, entries));
  } catch { return sitemapUnavailable(); }
}
