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
  "horizontalRule",
  "text",
  "image"
]);
const MARK_TYPES = new Set(["bold", "italic", "strike", "code", "link"]);
const MEDIA_URL = /^\/media\/([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/[a-z0-9-]{1,80}\.webp$/i;
const MAIL_LINK = /^mailto:[^%?\s@]+@[^%?\s@]+$/i;
const PHONE_LINK = /^tel:[+0-9(). -]{1,64}$/i;

type JsonRecord = Record<string, unknown>;

export function validateRichText(value: unknown) {
  let nodes = 0;
  const mediaIds = new Set<string>();
  const encoded = JSON.stringify(value);
  if (encoded.length > 120_000) {
    throw new BadRequestException("Rich-text content is too large");
  }

  const visit = (node: unknown, depth: number): JsonRecord => {
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
    const sanitized: JsonRecord = { type };
    if (type === "text") {
      const text = node.text;
      if (typeof text !== "string") throw new BadRequestException("Rich-text text nodes must contain a string");
      if (text.length > 20_000) throw new BadRequestException("Rich-text text nodes are too large");
      sanitized.text = text;
    }
    if (type === "heading") {
      const level = isRecord(node.attrs) ? node.attrs.level : undefined;
      if (level !== 2 && level !== 3) {
        throw new BadRequestException("Only level 2 and 3 headings are allowed");
      }
      sanitized.attrs = { level };
    }
    if (type === "image") {
      const src = isRecord(node.attrs) ? node.attrs.src : undefined;
      const match = typeof src === "string" ? MEDIA_URL.exec(src) : null;
      if (!match) {
        throw new BadRequestException("Inline images must use owned media URLs");
      }
      mediaIds.add(match[1]);
      sanitized.attrs = { src };
    }
    if (node.marks !== undefined) {
      if (!Array.isArray(node.marks) || node.marks.length > 8) {
        throw new BadRequestException("Rich-text marks must be an array");
      }
      sanitized.marks = node.marks.map((mark) => {
        if (!isRecord(mark) || typeof mark.type !== "string" || !MARK_TYPES.has(mark.type)) {
          throw new BadRequestException("Rich-text document contains an unsupported mark");
        }
        if (mark.type === "link") {
          const href = isRecord(mark.attrs) ? mark.attrs.href : undefined;
          return { type: "link", attrs: { href: safeRichTextLink(href) } };
        }
        return { type: mark.type };
      });
    }
    if (node.content !== undefined) {
      if (!Array.isArray(node.content)) {
        throw new BadRequestException("Rich-text node content must be an array");
      }
      sanitized.content = node.content.map((child) => visit(child, depth + 1));
    }
    return sanitized;
  };

  const content = visit(value, 0);
  if (!isRecord(value) || value.type !== "doc") {
    throw new BadRequestException("Rich-text content must be a document");
  }
  return {
    content: content as Prisma.InputJsonValue,
    mediaIds: [...mediaIds]
  };
}

function safeRichTextLink(value: unknown) {
  if (typeof value !== "string" || !value || value.length > 2_048 || /[\p{Cc}\p{Cf}]/u.test(value)) {
    throw new BadRequestException("Rich-text link is invalid");
  }
  if (MAIL_LINK.test(value) || PHONE_LINK.test(value)) return value;
  try {
    const parsed = new URL(value);
    if ((parsed.protocol !== "http:" && parsed.protocol !== "https:") || parsed.username || parsed.password) {
      throw new Error("unsafe");
    }
    return parsed.toString();
  } catch {
    throw new BadRequestException("Rich-text link uses an unsafe URL");
  }
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
