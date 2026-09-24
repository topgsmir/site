import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { partitionCount, partitionEntries, sitemapXml, sitemapIndexXml, staticEntries } from "../apps/web/src/lib/sitemap-core.ts";
import { catalogQuery, cursorFrom, listingHref } from "../apps/web/src/lib/seo.ts";
import { schemaPrice } from "../apps/web/src/lib/product-seo.ts";
import { multiplyCurrencyAmount } from "../apps/web/src/lib/currency.ts";

describe("purchase totals", () => {
  it("supports decimal prices and large amounts without rounding or BigInt crashes", () => {
    assert.equal(multiplyCurrencyAmount("1.5", 2), "3");
    assert.equal(multiplyCurrencyAmount("0.05", 3), "0.15");
    assert.equal(multiplyCurrencyAmount("9007199254740993.125", 3), "27021597764222979.375");
    assert.equal(multiplyCurrencyAmount("1.5", 0), "0");
    assert.throws(() => multiplyCurrencyAmount("10", 1.5));
  });
});

describe("product structured-data currency", () => {
  it("converts toman prices to ISO rial without precision loss", () => {
    assert.deepEqual(schemaPrice("1500000", "TOMAN"), { price: "15000000", priceCurrency: "IRR" });
    assert.equal(schemaPrice("9007199254740993.125", "TOMAN").price, "90071992547409931.25");
    assert.equal(schemaPrice("0.05", "TOMAN").price, "0.5");
    assert.deepEqual(schemaPrice("12.50", "USD"), { price: "12.50", priceCurrency: "USD" });
    assert.throws(() => schemaPrice("invalid", "TOMAN"));
  });
});

describe("crawlable catalog URLs", () => {
  it("normalizes filters/search and rejects ambiguous or malformed cursors", () => {
    assert.deepEqual(catalogQuery({ type: "all", search: "  phone  ", tracking: "ignored" }), { type: "all", search: "phone", cursor: undefined });
    assert.equal(listingHref("/fa/products", catalogQuery({ type: "service", search: "  phone  " })), "/fa/products?type=service&search=phone");
    assert.equal(catalogQuery({ search: ["  ", "  phone \t repair  "] }).search, "phone repair");
    for (const cursor of ["", "bad", ["a", "b"]]) assert.throws(() => cursorFrom({ cursor }));
  });
});

describe("sitemap partitions", () => {
  const feed = { kind: "products", locale: "fa", count: 46000 };
  const read = async (_feed, cursor) => {
    const start = Number(cursor ?? 0);
    return { items: Array.from({ length: Math.min(1000, feed.count - start) }, (_, i) => ({ id: String(start + i + 1), path: `/fa/products/p-${start + i}` })), nextCursor: start + 1000 < feed.count ? String(start + 1000) : null };
  };
  it("keeps every URL exactly once across the 45,000 boundary", async () => {
    assert.equal(partitionCount([feed]), 2);
    const first = await partitionEntries([feed], 0, read);
    const second = await partitionEntries([feed], 1, read);
    assert.equal(first.length, 45000);
    assert.equal(second.length, 1024);
    assert.equal(new Set([...first, ...second].map((entry) => entry.path)).size, 46024);
    assert.equal(second.at(-1).path, "/fa/products/p-45999");
    await assert.rejects(partitionEntries([feed], 2, read), RangeError);
  });
  it("never returns a partial success when a feed fails or shrinks", async () => {
    await assert.rejects(partitionEntries([feed], 0, async () => { throw new Error("upstream unavailable"); }), /unavailable/);
    await assert.rejects(partitionEntries([feed], 0, async () => ({ items: [], nextCursor: null })), /Incomplete/);
    await assert.rejects(partitionEntries([feed], 0, async () => ({ items: [{ id: "1", path: "/fa/products/one" }], nextCursor: null })), /changed/);
  });
  it("includes catalog/type landing pages and escapes XML", () => {
    assert.equal(staticEntries().length, 24);
    assert.ok(staticEntries().some((entry) => entry.path === "/ar/products?type=physical"));
    const xml = sitemapXml("https://shop.example", [{ path: "/fa/products?a=1&b=2", alternates: { fa: "/fa/products?a=1&b=2" } }]);
    assert.match(xml, /a=1&amp;b=2/);
    assert.match(sitemapIndexXml("https://shop.example", [feed]), /sitemap\/1.xml/);
  });
});
