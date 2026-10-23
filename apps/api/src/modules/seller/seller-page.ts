import { BadRequestException } from "@nestjs/common";
import type { ExpertPageBlock } from "@topgsm/shared-types";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SECTION_LIMIT = 12;
const PRODUCT_LIMIT = 8;

export type SellerPageBlockInput = {
  id: string;
  type: "text" | "products";
  title: string;
  body?: string;
  productIds?: string[];
};

function cleanTitle(value: string) {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").slice(0, 120);
}

function cleanBody(value: string) {
  return value
    .normalize("NFKC")
    .replace(/\r\n?/g, "\n")
    .trim()
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .slice(0, 2000);
}

function uuid(value: string) {
  return UUID_PATTERN.test(value) ? value.toLowerCase() : null;
}

export function normalizeSellerPage(blocks: SellerPageBlockInput[]): ExpertPageBlock[] {
  if (blocks.length > SECTION_LIMIT) {
    throw new BadRequestException("A page can contain at most 12 sections");
  }
  const seenBlocks = new Set<string>();
  const seenProducts = new Set<string>();
  return blocks.map((block) => {
    const id = uuid(block.id);
    if (!id) throw new BadRequestException("Each section needs a valid identifier");
    if (seenBlocks.has(id)) throw new BadRequestException("Each section needs its own identifier");
    seenBlocks.add(id);
    if (block.type === "text") {
      const title = cleanTitle(block.title);
      const body = cleanBody(block.body ?? "");
      if (title.length < 1) throw new BadRequestException("Each text section needs a title");
      if (body.length < 1) throw new BadRequestException("Each text section needs text");
      return { id, type: "text", title, body };
    }
    const title = cleanTitle(block.title ?? "");
    const productIds = (block.productIds ?? []).map((productId) => uuid(productId));
    if (productIds.length < 1 || productIds.length > PRODUCT_LIMIT || productIds.some((productId) => productId === null)) {
      throw new BadRequestException("Each product section needs 1 to 8 of your products");
    }
    const ids = productIds as string[];
    for (const productId of ids) {
      if (seenProducts.has(productId)) throw new BadRequestException("Each product can appear once on the page");
      seenProducts.add(productId);
    }
    return { id, type: "products", title, productIds: ids };
  });
}

export function readStoredSellerPage(value: unknown): ExpertPageBlock[] {
  if (!Array.isArray(value)) return [];
  const blocks: ExpertPageBlock[] = [];
  const seenBlocks = new Set<string>();
  const seenProducts = new Set<string>();
  for (const item of value.slice(0, SECTION_LIMIT)) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const record = item as Record<string, unknown>;
    const id = typeof record.id === "string" ? uuid(record.id) : null;
    if (!id || seenBlocks.has(id)) continue;
    if (record.type === "text" && typeof record.title === "string" && typeof record.body === "string") {
      const title = cleanTitle(record.title);
      const body = cleanBody(record.body);
      if (!title || !body) continue;
      seenBlocks.add(id);
      blocks.push({ id, type: "text", title, body });
      continue;
    }
    if (record.type !== "products" || !Array.isArray(record.productIds)) continue;
    const productIds: string[] = [];
    for (const productId of record.productIds) {
      if (productIds.length >= PRODUCT_LIMIT || typeof productId !== "string") continue;
      const normalized = uuid(productId);
      if (!normalized || seenProducts.has(normalized)) continue;
      seenProducts.add(normalized);
      productIds.push(normalized);
    }
    if (!productIds.length) continue;
    seenBlocks.add(id);
    blocks.push({
      id,
      type: "products",
      title: typeof record.title === "string" ? cleanTitle(record.title) : "",
      productIds
    });
  }
  return blocks;
}
