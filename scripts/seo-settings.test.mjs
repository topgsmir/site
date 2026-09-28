import assert from "node:assert/strict";
import { it } from "node:test";
import { applySeoConfiguration, filterSeoSitemap } from "../apps/web/src/lib/seo-settings-core.ts";

const configuration = () => ({ indexingEnabled: true, locales: ["fa", "en", "ar"].map((locale) => ({ locale, siteName: "Top GSM", titleTemplate: "%s | Store", description: "Fallback description", socialImage: "https://example.com/image.png" })), googleVerification: "", bingVerification: "", organizationName: "Top GSM", organizationLogo: "", sameAs: [], pages: [], redirects: [] });
it("renders overrides while preserving canonical, article fields and private-locale noindex", () => {
  const config = configuration();
  config.pages.push({ path: "/en/products/tool", title: "Custom title", description: "Custom description", socialImage: "", noIndex: false, excludeFromSitemap: false });
  const result = applySeoConfiguration(config, "en", "/en/products/tool", { title: "Original", robots: { index: false, follow: true, googleBot: { index: false } }, alternates: { canonical: "https://example.com/fa/products/tool" }, openGraph: { type: "article", publishedTime: "2026-09-27" } }, "https://example.com");
  assert.deepEqual(result.title, { absolute: "Custom title | Store" });
  assert.equal(result.robots.index, false);
  assert.equal(result.robots.googleBot.index, false);
  assert.equal(result.alternates.canonical, "https://example.com/fa/products/tool");
  assert.equal(result.openGraph.publishedTime, "2026-09-27");
  assert.equal(result.twitter.images[0], "https://example.com/image.png");
});
it("removes noindex, excluded and redirected paths and their hreflang references from sitemaps", () => {
  const config = configuration();
  config.pages.push({ path: "/en/products", noIndex: true }, { path: "/ar/products", excludeFromSitemap: true });
  config.redirects.push({ source: "/fa/blog/old", destination: "/fa/blog/new", enabled: true });
  const items = [ { path: "/fa/products", alternates: { fa: "/fa/products", en: "/en/products", ar: "/ar/products" } }, { path: "/en/products?type=physical" }, { path: "/ar/products" }, { path: "/fa/blog/old" } ];
  assert.deepEqual(filterSeoSitemap(config, items), [{ path: "/fa/products", alternates: { fa: "/fa/products" } }]);
  config.indexingEnabled = false;
  assert.deepEqual(filterSeoSitemap(config, items), []);
  const metadata = applySeoConfiguration(config, "fa", "/fa", { robots: { index: true, googleBot: { index: true } } }, "https://example.com");
  assert.equal(metadata.robots.index, false);
  assert.equal(metadata.robots.googleBot.index, false);
});
