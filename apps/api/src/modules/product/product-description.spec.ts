import assert from "node:assert/strict";
import { test } from "node:test";
import { PRODUCT_RICH_TEXT_PREFIX } from "@topgsm/shared-types";
import { normalizeProductDescription } from "./product-description";

test("product descriptions retain legacy plain text and normalize supported rich text", () => {
  assert.equal(normalizeProductDescription("  Existing description  "), "Existing description");
  const source = `${PRODUCT_RICH_TEXT_PREFIX}${JSON.stringify({ type: "doc", content: [
    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Details" }] },
    { type: "paragraph", content: [{ type: "text", text: "Read more", marks: [{ type: "link", attrs: { href: "https://example.com/" } }] }] }
  ] })}`;
  assert.equal(normalizeProductDescription(source), source);
});

test("product rich text rejects unsafe links and blog media", () => {
  const unsafeLink = `${PRODUCT_RICH_TEXT_PREFIX}${JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Click", marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }] }] }] })}`;
  assert.throws(() => normalizeProductDescription(unsafeLink));
  const blogImage = `${PRODUCT_RICH_TEXT_PREFIX}${JSON.stringify({ type: "doc", content: [{ type: "image", attrs: { src: "/media/00000000-0000-4000-8000-000000000000/large.webp" } }] })}`;
  assert.throws(() => normalizeProductDescription(blogImage));
});
