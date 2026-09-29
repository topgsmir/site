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
  "image",
  "table",
  "tableRow",
  "tableCell",
  "tableHeader"
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

  const visit = (node: unknown, depth: number, parentType?: string): JsonRecord => {
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
    if ((type === "tableRow" && parentType !== "table") ||
      ((type === "tableCell" || type === "tableHeader") && parentType !== "tableRow")) {
      throw new BadRequestException("Rich-text table structure is invalid");
    }
    if (type === "table" && (!Array.isArray(node.content) || !node.content.length || node.content.some((child) => !isRecord(child) || child.type !== "tableRow"))) {
      throw new BadRequestException("Tables must contain rows");
    }
    if (type === "tableRow" && (!Array.isArray(node.content) || !node.content.length || node.content.some((child) => !isRecord(child) || (child.type !== "tableCell" && child.type !== "tableHeader")))) {
      throw new BadRequestException("Table rows must contain cells");
    }
    if ((type === "tableCell" || type === "tableHeader") && (!Array.isArray(node.content) || !node.content.length)) {
      throw new BadRequestException("Table cells must contain content");
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
    if (type === "paragraph" || type === "heading") {
      const alignment = isRecord(node.attrs) ? node.attrs.textAlign : undefined;
      if (alignment !== undefined && alignment !== null) {
        if (alignment !== "start" && alignment !== "center" && alignment !== "end" && alignment !== "justify" && alignment !== "left" && alignment !== "right") {
          throw new BadRequestException("Rich-text alignment is invalid");
        }
        sanitized.attrs = { ...(isRecord(sanitized.attrs) ? sanitized.attrs : {}), textAlign: alignment };
      }
    }
    if (type === "image") {
      const src = isRecord(node.attrs) ? node.attrs.src : undefined;
      const match = typeof src === "string" ? MEDIA_URL.exec(src) : null;
      if (!match) {
        throw new BadRequestException("Inline images must use owned media URLs");
      }
      mediaIds.add(match[1]);
      const alt = isRecord(node.attrs) ? node.attrs.alt : undefined;
      if (alt !== undefined && (typeof alt !== "string" || alt.length > 300)) {
        throw new BadRequestException("Inline image description is invalid");
      }
      sanitized.attrs = { src, ...(typeof alt === "string" ? { alt } : {}) };
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
      sanitized.content = node.content.map((child) => visit(child, depth + 1, type));
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
