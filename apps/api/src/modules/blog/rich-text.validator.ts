import { BadRequestException } from "@nestjs/common";
import type { Prisma } from "../../prisma/client";

const NODE_TYPES = new Set([
  "doc",
  "paragraph",
  "heading",
  "bulletList",
  "orderedList",
  "listItem",
  "blockquote",
  "codeBlock",
  "hardBreak",
  "text",
  "image"
]);
const MARK_TYPES = new Set(["bold", "italic", "strike", "code", "link"]);
const MEDIA_URL = /^\/media\/([0-9a-f-]{36})\/[a-z0-9-]+\.webp$/i;
const SAFE_LINK = /^(https?:|mailto:|tel:)/i;

type JsonRecord = Record<string, unknown>;

export function validateRichText(value: unknown) {
  let nodes = 0;
  const mediaIds = new Set<string>();
  const encoded = JSON.stringify(value);
  if (encoded.length > 120_000) {
    throw new BadRequestException("Rich-text content is too large");
  }

  const visit = (node: unknown, depth: number): void => {
    if (!isRecord(node) || depth > 12 || ++nodes > 2_000) {
      throw new BadRequestException("Rich-text document is too complex");
    }
    const type = node.type;
    if (typeof type !== "string" || !NODE_TYPES.has(type)) {
      throw new BadRequestException("Rich-text document contains an unsupported node");
    }
    if (type === "doc" && depth !== 0) {
      throw new BadRequestException("Nested rich-text documents are not allowed");
    }
    if (type === "heading") {
      const level = isRecord(node.attrs) ? node.attrs.level : undefined;
      if (level !== 2 && level !== 3) {
        throw new BadRequestException("Only level 2 and 3 headings are allowed");
      }
    }
    if (type === "image") {
      const src = isRecord(node.attrs) ? node.attrs.src : undefined;
      const match = typeof src === "string" ? MEDIA_URL.exec(src) : null;
      if (!match) {
        throw new BadRequestException("Inline images must use owned media URLs");
      }
      mediaIds.add(match[1]);
    }
    if (node.marks !== undefined) {
      if (!Array.isArray(node.marks)) {
        throw new BadRequestException("Rich-text marks must be an array");
      }
      for (const mark of node.marks) {
        if (!isRecord(mark) || typeof mark.type !== "string" || !MARK_TYPES.has(mark.type)) {
          throw new BadRequestException("Rich-text document contains an unsupported mark");
        }
        if (mark.type === "link") {
          const href = isRecord(mark.attrs) ? mark.attrs.href : undefined;
          if (typeof href !== "string" || !SAFE_LINK.test(href)) {
            throw new BadRequestException("Rich-text link uses an unsafe URL protocol");
          }
        }
      }
    }
    if (node.content !== undefined) {
      if (!Array.isArray(node.content)) {
        throw new BadRequestException("Rich-text node content must be an array");
      }
      node.content.forEach((child) => visit(child, depth + 1));
    }
  };

  visit(value, 0);
  if (!isRecord(value) || value.type !== "doc") {
    throw new BadRequestException("Rich-text content must be a document");
  }
  return {
    content: JSON.parse(encoded) as Prisma.InputJsonValue,
    mediaIds: [...mediaIds]
  };
}

export function hasMeaningfulRichText(value: unknown): boolean {
  if (!isRecord(value)) return false;
  if (value.type === "image") return true;
  if (value.type === "text" && typeof value.text === "string" && value.text.trim()) {
    return true;
  }
  return Array.isArray(value.content) && value.content.some(hasMeaningfulRichText);
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
