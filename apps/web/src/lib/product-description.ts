import type { RichTextDocument, RichTextNode } from "@topgsm/shared-types";
import { PRODUCT_RICH_TEXT_PREFIX } from "@topgsm/shared-types";
export { PRODUCT_RICH_TEXT_PREFIX };

function validNode(value: unknown, depth = 0): value is RichTextNode {
  if (!value || typeof value !== "object" || depth > 12) return false;
  const node = value as Record<string, unknown>;
  if (typeof node.type !== "string" || !["doc", "paragraph", "heading", "bulletList", "orderedList", "listItem", "blockquote", "codeBlock", "hardBreak", "horizontalRule", "text", "table", "tableRow", "tableCell", "tableHeader"].includes(node.type)) return false;
  if (node.text !== undefined && typeof node.text !== "string") return false;
  if (node.marks !== undefined && (!Array.isArray(node.marks) || !node.marks.every((mark) => mark && typeof mark === "object" && typeof mark.type === "string"))) return false;
  if (node.content !== undefined && (!Array.isArray(node.content) || !node.content.every((child) => validNode(child, depth + 1)))) return false;
  return true;
}

export function productDescriptionDocument(value: string | null | undefined): RichTextDocument | null {
  if (!value?.startsWith(PRODUCT_RICH_TEXT_PREFIX)) return null;
  try {
    const parsed: unknown = JSON.parse(value.slice(PRODUCT_RICH_TEXT_PREFIX.length));
    if (validNode(parsed) && parsed.type === "doc") return parsed as RichTextDocument;
  } catch { /* Existing plain descriptions may contain this prefix. */ }
  return null;
}

function nodeText(node: RichTextNode): string {
  if (node.type === "text") return node.text ?? "";
  if (node.type === "hardBreak") return "\n";
  const children = (node.content ?? []).map(nodeText).join("");
  return ["paragraph", "heading", "listItem", "blockquote", "codeBlock"].includes(node.type) ? `${children}\n` : children;
}

export function productDescriptionText(value: string | null | undefined): string {
  const document = productDescriptionDocument(value);
  return document ? nodeText(document).trim() : value ?? "";
}

export function productDescriptionFromText(value: string): RichTextDocument {
  return { type: "doc", content: value.split(/\n{2,}/).map((paragraph) => ({
    type: "paragraph", content: paragraph.split("\n").flatMap((line, index) => [
      ...(index ? [{ type: "hardBreak" }] : []),
      ...(line ? [{ type: "text", text: line }] : [])
    ])
  })) };
}

export function mergeProductAiDescription<T extends { description: string }>(current: T, next: Partial<T>): T {
  return { ...current, ...next, description: next.description === productDescriptionText(current.description)
    ? current.description : next.description ?? current.description };
}
