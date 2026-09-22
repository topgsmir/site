import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { partitionCount, partitionEntries, sitemapXml, sitemapIndexXml, staticEntries } from "../apps/web/src/lib/sitemap-core.ts";
import { catalogQuery, cursorFrom, listingHref } from "../apps/web/src/lib/seo.ts";

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
    assert.equal(second.length, 1021);
    assert.equal(new Set([...first, ...second].map((entry) => entry.path)).size, 46021);
    assert.equal(second.at(-1).path, "/fa/products/p-45999");
    await assert.rejects(partitionEntries([feed], 2, read), RangeError);
  });
  it("never returns a partial success when a feed fails or shrinks", async () => {
    await assert.rejects(partitionEntries([feed], 0, async () => { throw new Error("upstream unavailable"); }), /unavailable/);
    await assert.rejects(partitionEntries([feed], 0, async () => ({ items: [], nextCursor: null })), /Incomplete/);
    await assert.rejects(partitionEntries([feed], 0, async () => ({ items: [{ id: "1", path: "/fa/products/one" }], nextCursor: null })), /changed/);
  });
  it("includes catalog/type landing pages and escapes XML", () => {
    assert.equal(staticEntries().length, 21);
    assert.ok(staticEntries().some((entry) => entry.path === "/ar/products?type=physical"));
    const xml = sitemapXml("https://shop.example", [{ path: "/fa/products?a=1&b=2", alternates: { fa: "/fa/products?a=1&b=2" } }]);
    assert.match(xml, /a=1&amp;b=2/);
    assert.match(sitemapIndexXml("https://shop.example", [feed]), /sitemap\/1.xml/);
  });
});
