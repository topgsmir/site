import assert from "node:assert/strict";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { createWriteStream, readFileSync, existsSync, writeFileSync } from "node:fs";
import { once } from "node:events";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";

const root = resolve(import.meta.dirname, "..");
const web = resolve(root, "apps/web");
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const now = "2026-09-22T00:00:00.000Z";
const summaries = Array.from({ length: 51 }, (_, n) => ({ id: id(n + 1), title: `Product ${n}`, slug: `product-${n}`, category: "Tools", kind: "simple", type: "physical", image: null, startingPrices: [{ price: "1000", currency: "TOMAN" }], createdAt: now }));
const posts = Array.from({ length: 31 }, (_, n) => ({ id: id(n + 101), title: `Article ${n}`, slug: `article-${n}`, excerpt: "Repair guide", status: "published", cover: null, author: { id: null, name: "Editorial", type: "editorial" }, category: null, publishedAt: now, createdAt: now, updatedAt: now }));
let sitemapMode = "failure";
let productDescription = "Detailed repair product description.";
const manifest = ["fa", "en", "ar"].flatMap((locale) => ["products", "posts", "categories", "tags", "sellers"].map((kind) => ({ kind, locale, count: kind === "products" && locale === "fa" ? 51 : 0 })));
function page(items, cursor, limit) {
  const index = cursor ? items.findIndex((row) => row.id === cursor) + 1 : 0;
  if (cursor && !index) return null;
  const visible = items.slice(index, index + limit);
  return { items: visible, nextCursor: index + limit < items.length ? visible.at(-1).id : null };
}
const fixture = createServer((request, response) => {
  const url = new URL(request.url, "http://fixture");
  const json = (data, status = 200) => { response.writeHead(status, { "Content-Type": "application/json" }); response.end(JSON.stringify(data)); };
  if (url.pathname.startsWith("/api/seo/sitemap")) {
    if (sitemapMode === "failure") return json({}, 503);
    if (sitemapMode === "malformed") return json({ unexpected: true });
    if (url.pathname.endsWith("manifest")) return json({ feeds: manifest });
    return json({ items: summaries.map((row) => ({ id: row.id, path: `/fa/products/${row.slug}`, updatedAt: now })), nextCursor: null });
  }
  if (url.pathname === "/api/products/page") {
    const search = url.searchParams.get("search") ?? "";
    if (search.startsWith("outage")) return json({}, 503);
    if (search.startsWith("malformed")) return json({ items: [], nextCursor: 7 });
    if (search.startsWith("timeout")) return; // Closed with the fixture server after the timeout assertion.
    const data = page(search === "empty" ? [] : summaries, url.searchParams.get("cursor"), 50);
    return json(data ?? {}, data ? 200 : 404);
  }
  if (url.pathname === "/api/products") return json(summaries.slice(0, 20));
  if (url.pathname.startsWith("/api/products/")) {
    const slug = decodeURIComponent(url.pathname.split("/").at(-1));
    const locale = url.searchParams.get("locale") ?? "fa";
    const n = slug === "old-product" || slug === id(1) ? 0 : Number(slug.replace("product-", ""));
    const row = summaries[n];
    if (!row) return json({}, 404);
    const type = n === 1 ? "service" : n === 2 ? "bridge" : n >= 5 && n <= 7 ? "digital" : "physical";
    const fulfillment = type === "service" ? { service: { serviceType: "Device diagnostics", estimatedHours: 24, inputs: [{ key: "model", label: "Device model", type: "text", required: true, helpText: "Find the model in device settings." }] } } : type === "physical" ? { physical: { inStock: n !== 3, weightGrams: 100 } } : type === "digital" ? { digital: { maxDownloads: n === 6 ? 0 : 5 } } : {};
    return json({ ...row, type, title: locale === "en" && n === 0 ? "Translated repair tool" : row.title, description: productDescription, updatedAt: now,
      ...(type === "bridge" ? { bridge: { fields: [{ key: "imei", label: "IMEI", type: "text", required: true }], minimumQuantity: 1, maximumQuantity: 5 } } : {}),
      ...(n === 0 ? { image: { id: id(999), variants: [{ name: "large", url: `/media/${id(999)}/large.webp`, width: 1000, height: 1000 }] } } : {}),
      availableLocales: n === 0 ? ["fa", "en"] : ["fa"], contentLocale: n === 0 && locale === "en" ? "en" : "fa",
      options: [], variants: [{ id: id(500 + n), name: null, options: [], offers: n === 4 || n === 7 ? [] : [{ id: id(600 + n), price: "1000", currency: "TOMAN", seller: { id: id(700), shopName: "Repair shop" }, ...fulfillment }] }]
    });
  }
  if (/^\/api\/blog\/public\/(fa|en|ar)\//.test(url.pathname)) {
    if (url.pathname.includes("outage")) return json({}, 503);
    if (url.pathname.includes("malformed")) return json({});
    const data = page(posts, url.searchParams.get("cursor"), 30);
    if (!data) return json({}, 404);
    const collection = !url.pathname.endsWith("/posts") ? { id: id(800), kind: "category", name: "Repair guides", alternateSlugs: { fa: "repairs", en: "repairs", ar: "repairs" } } : undefined;
    return json({ ...data, ...(collection ? { collection } : {}) });
  }
  return json([]);
});
fixture.listen(0, "127.0.0.1"); await once(fixture, "listening");
const apiPort = fixture.address().port;
const portReservation = createServer(); portReservation.listen(0, "127.0.0.1"); await once(portReservation, "listening");
const webPort = portReservation.address().port; await new Promise((done) => portReservation.close(done));
const origin = `http://127.0.0.1:${webPort}`;
const output = `tmp/seo-next-${randomUUID().slice(0, 8)}`;
const environment = { ...process.env, NODE_ENV: "production", TOPGSM_NEXT_DIST_DIR: output, API_URL: `http://127.0.0.1:${apiPort}/api`, NEXT_PUBLIC_API_URL: `http://127.0.0.1:${apiPort}/api`, NEXT_PUBLIC_SITE_URL: origin, NEXT_TELEMETRY_DISABLED: "1" };
const next = resolve(web, "node_modules/next/dist/bin/next");
const nextEnv = resolve(web, "next-env.d.ts");
const originalNextEnv = existsSync(nextEnv) ? readFileSync(nextEnv, "utf8") : null;
let server;
const logFile = resolve(root, "seo-render-test.log");
const log = createWriteStream(logFile);
const run = (args) => {
  const process = spawn(globalThis.process.execPath, [next, ...args], { cwd: web, env: environment, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  process.stdout.pipe(log, { end: false }); process.stderr.pipe(log, { end: false });
  return process;
};
async function html(path, status = 200) {
  const response = await fetch(origin + path, { redirect: "manual", signal: AbortSignal.timeout(30000) });
  const body = await response.text();
  assert.equal(response.status, status, `${path}: unexpected HTTP status`);
  return { body, response };
}
try {
  console.log("Building isolated production frontend for raw-HTML SEO checks…");
  const build = run(["build"]);
  const [exit] = await once(build, "exit");
  if (exit !== 0) throw new Error("Production build failed; see seo-render-test.log");
  server = run(["start", "--hostname", "127.0.0.1", "--port", String(webPort)]);
  let ready = false;
  for (let n = 0; n < 100; n++) {
    try { await fetch(origin + "/robots.txt"); ready = true; break; } catch { await new Promise((done) => setTimeout(done, 200)); }
  }
  assert.ok(ready, "Production frontend did not start");
  console.log("Checking cold outages and sitemap responses…");
  await html("/sitemap.xml", 503);
  const unavailable = await html("/sitemap/0.xml", 503);
  assert.equal(unavailable.response.headers.get("retry-after"), "300");
  assert.equal(unavailable.response.headers.get("cache-control"), "no-store");
  sitemapMode = "malformed"; await html("/sitemap.xml", 503);
  sitemapMode = "success";
  assert.match((await html("/robots.txt")).body, /Sitemap: .*\/sitemap.xml/);
  assert.match((await html("/sitemap.xml")).body, /\/sitemap\/0.xml/);
  const xml = (await html("/sitemap/0.xml")).body;
  assert.match(xml, /\/fa\/products\?type=physical/); assert.match(xml, /product-50/);
  await html("/sitemap/999.xml", 404);
  for (const term of ["outage", "malformed", "timeout"]) {
    const failed = await html(`/fa/products?search=${term}-${randomUUID()}`, 500);
    // Next adds noindex to its HTTP 500 document; never emit our page-level noindex/follow fallback.
    assert.doesNotMatch(failed.body, /<meta[^>]*name="robots"[^>]*content="noindex, follow/);
  }
  await html("/fa/blog/category/outage", 500);
  await html("/fa/blog/tag/malformed", 500);
  console.log("Checking crawlable links, canonicals, translated pages and redirects…");
  for (const locale of ["fa", "en", "ar"]) {
    const catalog = (await html(`/${locale}/products`)).body;
    assert.match(catalog, /href="[^"]*cursor=/);
    assert.ok(catalog.includes(`rel="canonical" href="${origin}/${locale}/products"`));
    const type = (await html(`/${locale}/products?type=physical`)).body;
    assert.ok(type.includes(`rel="canonical" href="${origin}/${locale}/products?type=physical"`));
  }
  const last = (await html(`/fa/products?cursor=${id(50)}`)).body;
  assert.match(last, /product-50/); assert.doesNotMatch(last, /rel="next"/);
  assert.ok(last.includes(`rel="canonical" href="${origin}/fa/products?cursor=${id(50)}"`));
  assert.doesNotMatch(last, /rel="alternate"/);
  const search = (await html("/fa/products?search=empty")).body;
  assert.match(search, /name="robots" content="noindex, follow"/);
  await html("/fa/products?cursor=bad", 404);
  await html(`/fa/products?cursor=${id(9000)}`, 404);
  for (const suffix of ["", "/category/repairs", "/tag/repairs", `/seller/${id(800)}`]) {
    assert.match((await html(`/fa/blog${suffix}`)).body, /href="[^"]*cursor=/);
    const second = (await html(`/fa/blog${suffix}?cursor=${id(130)}`)).body;
    assert.match(second, /article-30/); assert.doesNotMatch(second, /rel="alternate"/);
  }
  const translated = (await html("/en/products/product-0")).body;
  assert.match(translated, /Translated repair tool/); assert.match(translated, /name="robots" content="index, follow"/);
  assert.ok(translated.includes(`rel="canonical" href="${origin}/en/products/product-0"`));
  assert.match(translated, /<link rel="alternate" hrefLang="en"/); assert.doesNotMatch(translated, /<link rel="alternate" hrefLang="ar"/);
  const fallback = (await html("/ar/products/product-0")).body;
  assert.match(fallback, /name="robots" content="noindex, follow"/);
  assert.ok(fallback.includes(`rel="canonical" href="${origin}/fa/products/product-0"`));
  for (const slug of ["old-product", id(1)]) {
    const redirect = await html(`/en/products/${slug}`, 308);
    assert.equal(redirect.response.headers.get("location"), "/en/products/product-0");
  }
  console.log("Checking type-specific pages, social images and truthful structured data…");
  for (const [n, type] of [[0, "physical"], [1, "service"], [2, "bridge"], [3, "physical"], [4, "physical"], [5, "digital"]]) {
    const body = (await html(`/en/products/product-${n}`)).body;
    assert.ok(body.includes(`data-product-type="${type}"`));
    assert.equal((body.match(/<h1\b/g) ?? []).length, 1);
    assert.equal((body.match(/<main\b/g) ?? []).length, 1);
    const graphs = [...body.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)].map((match) => JSON.parse(match[1]));
    const graph = graphs.find((entry) => entry["@graph"])?.["@graph"];
    assert.ok(graph);
    const entity = graph.find((entry) => entry["@id"].endsWith("#product"));
    assert.equal(entity["@type"], type === "service" || type === "bridge" ? "Service" : "Product");
    assert.equal(entity.offers.length, n === 4 ? 0 : 1);
    if (n !== 4) {
      assert.equal(entity.offers[0].priceCurrency, "IRR");
      assert.equal(entity.offers[0].price, "10000");
      assert.equal(entity.offers[0].availability, `https://schema.org/${n === 3 ? "OutOfStock" : "InStock"}`);
    }
    assert.equal(graph.find((entry) => entry["@type"] === "BreadcrumbList").itemListElement.length, 3);
    if (n === 0) {
      assert.ok(entity.image[0].endsWith("/large.webp"));
      assert.match(body, /property="og:image"/);
      assert.match(body, /name="twitter:image"/);
      assert.match(body, /Shipping &amp; delivery/);
    }
    if (n === 1) { assert.match(body, /Device model/); assert.match(body, /Estimated turnaround/); }
    if (n === 2) { assert.match(body, /IMEI/); assert.match(body, /Verify your mobile/); }
    if (n === 4) assert.match(body, /There are no active offers/);
    if (type === "digital") {
      assert.equal(entity.offers[0].availableDeliveryMethod, "http://purl.org/goodrelations/v1#DeliveryModeDirectDownload");
      // Inspect server-rendered content, excluding serialized hydration payloads.
      const main = body.match(/<main\b[\s\S]*?<\/main>/)?.[0] ?? "";
      const descriptionAt = main.indexOf('id="download-description"');
      assert.ok(descriptionAt >= 0);
      assert.ok(descriptionAt < main.indexOf('id="purchase"'));
      assert.ok(main.indexOf("Detailed repair product description.", descriptionAt) < main.indexOf(">Add to cart</button>", descriptionAt));
      assert.equal((main.match(/Detailed repair product description\./g) ?? []).length, 1);
      assert.match(main, /5 downloads/);
      assert.match(main, /From checkout to download/);
      assert.match(body, /href="#purchase"/);
    }
  }
  assert.match((await html("/en/products/product-6")).body, /Unlimited downloads/);
  const unavailableDownload = (await html("/en/products/product-7")).body;
  assert.match(unavailableDownload, /There are no active offers/);
  assert.match(unavailableDownload, /id="download-description"/);
  productDescription = "Updated repair product description.";
  const refreshedProduct = (await html("/en/products/product-5")).body;
  assert.match(refreshedProduct, /Updated repair product description\./);
  assert.doesNotMatch(refreshedProduct, /Detailed repair product description\./);
  if (process.env.PRODUCT_PREVIEW === "1") {
    console.log(`PRODUCT_PREVIEW_URL=${origin}`);
    const stopFile = resolve(web, `${output}.stop`);
    console.log(`PRODUCT_PREVIEW_STOP=${stopFile}`);
    await new Promise((done) => {
      const timer = setInterval(() => { if (existsSync(stopFile)) { clearInterval(timer); done(); } }, 500);
      process.once("SIGINT", () => { clearInterval(timer); done(); });
    });
  }
  console.log("PASS: raw HTML, pagination, indexing, redirects, translation eligibility, malformed responses, timeouts and sitemap outages");
} finally {
  if (server && server.exitCode === null) { server.kill(); await once(server, "exit"); }
  fixture.closeAllConnections(); await new Promise((done) => fixture.close(done));
  log.end();
  // Restore only the generated reference written by this isolated build.
  if (originalNextEnv !== null && readFileSync(nextEnv, "utf8").includes(output)) writeFileSync(nextEnv, originalNextEnv);
}
