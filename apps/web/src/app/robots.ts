import type { MetadataRoute } from "next";
import { generateSitemaps, SITEMAP_SITE_URL } from "./sitemap";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const partitions = await generateSitemaps();

  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/*/admin", "/*/seller-dashboard"] },
    sitemap: partitions.map(({ id }) => `${SITEMAP_SITE_URL}/sitemap/${id}.xml`),
    host: SITEMAP_SITE_URL
  };
}
