import { sitemapIndexXml } from "@/lib/sitemap-core";
import { sitemapManifest, sitemapUnavailable, xmlResponse } from "@/lib/sitemap-server";
import { SITE_URL } from "@/lib/seo";

export const dynamic = "force-dynamic";
export async function GET() {
  try { return xmlResponse(sitemapIndexXml(SITE_URL, await sitemapManifest())); }
  catch { return sitemapUnavailable(); }
}
