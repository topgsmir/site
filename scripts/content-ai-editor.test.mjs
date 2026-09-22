import assert from "node:assert/strict";
import { it } from "node:test";
import { applyBlogAiTranslation, articleText, taxonomyMatch } from "../apps/web/src/components/ai/blog-ai-draft.ts";

const content = (text) => ({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] });
it("applies selected blog fields without losing uploaded media or human cover descriptions", () => {
  const image = { type: "image", attrs: { src: "/media/owned/inline.webp" } };
  const original = { locale: "fa", title: "Original", slug: "original", coverAltText: "Real photo", content: { type: "doc", content: [...content("Old body").content, image] } };
  const draft = { title: "New title", slug: "changed", coverAltText: "", content: content("New body") };
  const result = applyBlogAiTranslation(original, draft, ["title", "content", "coverAltText"]);
  assert.equal(result.title, "New title"); assert.equal(result.slug, "original");
  assert.equal(result.coverAltText, "Real photo"); assert.deepEqual(result.content.content.at(-1), image);
  assert.equal(original.title, "Original"); assert.equal(articleText(original.content).trim(), "Old body");
  assert.deepEqual(applyBlogAiTranslation(original, draft, []), original);
});
it("matches only existing multilingual category/tag labels", () => {
  const terms = [{ id: "repair", translations: [{ locale: "en", name: "Repair" }, { locale: "fa", name: "تعمیر" }] }];
  assert.equal(taxonomyMatch(terms, " repair "), "repair");
  assert.equal(taxonomyMatch(terms, "تعمیر"), "repair");
  assert.equal(taxonomyMatch(terms, "Invented"), undefined);
});
