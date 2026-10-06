import type { RichTextDocument, RichTextNode } from "@topgsm/shared-types";
import { productDescriptionDocument, productDescriptionText } from "@/lib/product-description";
import { productSummary } from "@/lib/product-seo";

export type SeoInput = {
  kind: "blog" | "product";
  title: string;
  body: RichTextDocument | string;
  shortDescription?: string;
  metaTitle?: string;
  metaDescription?: string;
  keyword: string;
  hasCover?: boolean;
  coverAlt?: string;
};

export type SeoCheck = {
  id: string;
  status: "good" | "improve";
  detail: string;
  suggestion: string;
};

export type SeoAnalysis = {
  words: number;
  characters: number;
  headings: number;
  links: number;
  images: number;
  score: number;
  checks: SeoCheck[];
};

const words = (value: string) => value.match(/[\p{L}\p{N}]+(?:[\u200c'’-][\p{L}\p{N}]+)*/gu) ?? [];
const length = (value: string) => Array.from(value.trim()).length;
const normalized = (value: string) => value.toLocaleLowerCase().replace(/\s+/g, " ").trim();

function documentDetails(document: RichTextDocument) {
  const text: string[] = [];
  const headings: string[] = [];
  let links = 0;
  let images = 0;
  const visit = (node: RichTextNode) => {
    if (node.type === "heading") headings.push(nodeText(node));
    if (node.type === "image") images += 1;
    if (node.type === "text") {
      text.push(node.text ?? "");
      links += (node.marks ?? []).filter((mark) => mark.type === "link").length;
    }
    node.content?.forEach(visit);
  };
  document.content?.forEach(visit);
  return { text: text.join(" ").trim(), headings, links, images };
}

function nodeText(node: RichTextNode): string {
  return node.type === "text" ? node.text ?? "" : (node.content ?? []).map(nodeText).join(" ");
}

export function seoDetailsFromHtml(html: string) {
  // Analyze draft source as text. Building DOM nodes could fetch remote image URLs.
  const safeSource = html.replace(/<(script|style|iframe)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ").replace(/<!--[\s\S]*?-->/g, " ");
  const textOnly = (value: string) => value.replace(/<[^>]*>/g, " ").replace(/&(nbsp|amp|lt|gt|quot|#39);/gi, (_, entity: string) => ({ nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'" })[entity.toLowerCase()] ?? " ").replace(/\s+/g, " ").trim();
  return {
    text: textOnly(safeSource),
    headings: Array.from(safeSource.matchAll(/<h[23]\b[^>]*>([\s\S]*?)<\/h[23]\s*>/gi), (match) => textOnly(match[1])),
    links: Array.from(safeSource.matchAll(/<a\b[^>]*\bhref\s*=/gi)).length,
    images: Array.from(safeSource.matchAll(/<img\b[^>]*\bsrc\s*=/gi)).length
  };
}

export function analyzeSeo(input: SeoInput, htmlSource?: string): SeoAnalysis {
  const content = htmlSource === undefined
    ? typeof input.body === "string"
      ? documentDetails(productDescriptionDocument(input.body) ?? { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: productDescriptionText(input.body) }] }] })
      : documentDetails(input.body)
    : seoDetailsFromHtml(htmlSource);
  const body = content.text.trim();
  const title = input.title.trim();
  const short = input.kind === "product" && typeof input.body === "string"
    ? productSummary(productDescriptionText(input.body))
    : input.shortDescription?.trim() ?? "";
  const metaTitle = (input.metaTitle ?? title).trim();
  const metaDescription = (input.metaDescription ?? (input.kind === "product" ? short : body.slice(0, 158))).trim();
  const keyword = normalized(input.keyword);
  const contains = (value: string) => Boolean(keyword && normalized(value).includes(keyword));
  const checks: SeoCheck[] = [];
  const add = (id: string, good: boolean, detail: string, suggestion: string) => checks.push({ id, status: good ? "good" : "improve", detail, suggestion });
  const wordCount = words(body).length;

  add("title", length(title) >= 30 && length(title) <= 70, `${length(title)} / 30–70`, length(title) < 30 ? "titleShort" : "titleLong");
  add("body", wordCount >= (input.kind === "blog" ? 300 : 80), `${wordCount}`, "bodyShort");
  const shortMin = input.kind === "blog" ? 70 : 50;
  const shortMax = input.kind === "blog" ? 250 : 200;
  add("short", length(short) >= shortMin && length(short) <= shortMax, `${length(short)} / ${shortMin}–${shortMax}`, length(short) < shortMin ? "shortShort" : "shortLong");
  if (input.kind === "blog") add("metaTitle", length(metaTitle) >= 30 && length(metaTitle) <= 70, `${length(metaTitle)} / 30–70`, length(metaTitle) < 30 ? "metaTitleShort" : "metaTitleLong");
  add("metaDescription", length(metaDescription) >= 70 && length(metaDescription) <= 160, `${length(metaDescription)} / 70–160`, length(metaDescription) < 70 ? "metaShort" : "metaLong");
  add("keyword", Boolean(keyword), keyword || "—", "keywordMissing");
  if (keyword) {
    add("keywordTitle", contains(title), title, "keywordTitle");
    add("keywordBody", contains(body), `${normalized(body).split(keyword).length - 1}`, "keywordBody");
    if (input.kind === "blog") add("keywordMeta", contains(metaDescription), metaDescription, "keywordMeta");
  }
  add("headings", content.headings.length > 0, `${content.headings.length}`, "headingsMissing");
  if (keyword && content.headings.length) add("keywordHeading", content.headings.some(contains), `${content.headings.length}`, "keywordHeading");
  add("links", content.links > 0, `${content.links}`, "linksMissing");
  const imageCount = content.images + Number(Boolean(input.hasCover));
  add("images", imageCount > 0, `${imageCount}`, "imagesMissing");
  if (input.kind === "blog" && input.hasCover) add("coverAlt", Boolean(input.coverAlt?.trim()), input.coverAlt?.trim() || "—", "coverAltMissing");
  return {
    words: wordCount,
    characters: length(body),
    headings: content.headings.length,
    links: content.links,
    images: imageCount,
    score: Math.round(100 * checks.filter((check) => check.status === "good").length / checks.length),
    checks
  };
}
