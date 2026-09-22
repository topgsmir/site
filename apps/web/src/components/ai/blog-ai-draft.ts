import type { BlogTaxonomyTerm, BlogTranslationDraft, ContentAiDraft, RichTextNode } from "@topgsm/shared-types";

export function articleText(node: RichTextNode): string {
  return node.text ?? (node.content ?? []).map(articleText).join(node.type === "paragraph" || node.type === "heading" ? "" : "\n");
}

function images(node: RichTextNode): RichTextNode[] {
  return node.type === "image" ? [node] : (node.content ?? []).flatMap(images);
}

export function applyBlogAiTranslation(current: BlogTranslationDraft, draft: ContentAiDraft, fields: readonly string[]): BlogTranslationDraft {
  const next = { ...current };
  for (const field of ["title", "slug", "excerpt", "seoTitle", "seoDescription", "coverAltText"] as const) {
    // An unseen cover must never erase a human-authored alt description.
    if (fields.includes(field) && draft[field]) next[field] = draft[field];
  }
  if (fields.includes("content")) {
    // Keep previously uploaded inline images when replacing prose.
    const retainedImages = images(current.content);
    next.content = { type: "doc", content: [...(draft.content.content ?? []), ...retainedImages] };
  }
  return next;
}

export function taxonomyMatch(terms: BlogTaxonomyTerm[], name: string) {
  const normalized = name.trim().normalize("NFKC").toLocaleLowerCase();
  return terms.find((term) => term.translations.some((translation) => translation.name.trim().normalize("NFKC").toLocaleLowerCase() === normalized))?.id;
}
