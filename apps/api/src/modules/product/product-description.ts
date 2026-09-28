import { BadRequestException } from "@nestjs/common";
import { PRODUCT_RICH_TEXT_PREFIX } from "@topgsm/shared-types";
import { hasMeaningfulRichText, validateRichText } from "../blog/rich-text.validator";

export function normalizeProductDescription(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (!trimmed.startsWith(PRODUCT_RICH_TEXT_PREFIX)) return trimmed;
  let document: unknown;
  try { document = JSON.parse(trimmed.slice(PRODUCT_RICH_TEXT_PREFIX.length)); }
  catch { throw new BadRequestException("Product rich-text description is invalid"); }
  const validated = validateRichText(document);
  if (validated.mediaIds.length) throw new BadRequestException("Product descriptions cannot contain blog media");
  if (!hasMeaningfulRichText(validated.content)) return null;
  const normalized = `${PRODUCT_RICH_TEXT_PREFIX}${JSON.stringify(validated.content)}`;
  if (normalized.length > 10_000) throw new BadRequestException("Product description is too long");
  return normalized;
}
