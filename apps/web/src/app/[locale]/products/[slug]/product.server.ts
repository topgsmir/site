import "server-only";
import { cache } from "react";
import { SERVER_API_BASE } from "@/lib/api/server";

export type PublicProductOffer = {
  id: string;
  price: string;
  currency: string;
  seller: { id: string; shopName: string };
  digital?: { maxDownloads: number };
  physical?: { inStock: boolean; weightGrams: number };
  service?: { serviceType: string; estimatedHours: number };
};

export type PublicProductVariant = {
  id: string;
  name: string | null;
  options: Array<{ name: string; value: string }>;
  offers: PublicProductOffer[];
};

export type PublicProduct = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  category: string | null;
  kind: "simple" | "variable";
  type: "digital" | "physical" | "service";
  options: Array<{
    id: string;
    name: string;
    values: Array<{ id: string; value: string }>;
  }>;
  variants: PublicProductVariant[];
  createdAt: string;
  updatedAt: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isNullableString(value: unknown): value is string | null {
  return value === null || isString(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isNamedValue(value: unknown): value is { name: string; value: string } {
  return isRecord(value) && isString(value.name) && isString(value.value);
}

function isProductOption(value: unknown): value is PublicProduct["options"][number] {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isString(value.name) &&
    Array.isArray(value.values) &&
    value.values.every(
      (optionValue) => isRecord(optionValue) && isString(optionValue.id) && isString(optionValue.value)
    )
  );
}

function hasValidFulfillment(value: Record<string, unknown>): boolean {
  if (
    value.digital !== undefined &&
    (!isRecord(value.digital) || !isFiniteNumber(value.digital.maxDownloads))
  ) {
    return false;
  }
  if (
    value.physical !== undefined &&
    (!isRecord(value.physical) ||
      typeof value.physical.inStock !== "boolean" ||
      !isFiniteNumber(value.physical.weightGrams))
  ) {
    return false;
  }
  if (
    value.service !== undefined &&
    (!isRecord(value.service) ||
      !isString(value.service.serviceType) ||
      !isFiniteNumber(value.service.estimatedHours))
  ) {
    return false;
  }
  return true;
}

function isProductResponse(value: unknown): value is PublicProduct {
  if (!isRecord(value)) return false;
  if (
    !isString(value.id) ||
    !isString(value.title) ||
    !isString(value.slug) ||
    !isNullableString(value.description) ||
    !isNullableString(value.category) ||
    !isString(value.createdAt) ||
    !isString(value.updatedAt) ||
    !["simple", "variable"].includes(String(value.kind)) ||
    !["digital", "physical", "service"].includes(String(value.type)) ||
    !Array.isArray(value.options) ||
    !Array.isArray(value.variants)
  ) {
    return false;
  }

  if (!value.options.every(isProductOption)) return false;

  return value.variants.every((variant) => {
    if (
      !isRecord(variant) ||
      !isString(variant.id) ||
      !isNullableString(variant.name) ||
      !Array.isArray(variant.options) ||
      !variant.options.every(isNamedValue) ||
      !Array.isArray(variant.offers)
    ) {
      return false;
    }
    return variant.offers.every((offer) => {
      if (!isRecord(offer) || !isRecord(offer.seller)) return false;
      return (
        isString(offer.id) &&
        isString(offer.price) &&
        isString(offer.currency) &&
        isString(offer.seller.id) &&
        isString(offer.seller.shopName) &&
        hasValidFulfillment(offer)
      );
    });
  });
}

export const getPublicProduct = cache(async (slug: string): Promise<PublicProduct | null> => {
  let normalizedSlug: string;
  try {
    normalizedSlug = decodeURIComponent(slug);
  } catch {
    return null;
  }
  if (!normalizedSlug || normalizedSlug.length > 200) return null;

  const response = await fetch(`${SERVER_API_BASE}/products/${encodeURIComponent(normalizedSlug)}`, {
    headers: { accept: "application/json" },
    next: { revalidate: 300, tags: [`product:${normalizedSlug}`] }
  });

  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Product API returned ${response.status}`);
  }

  const payload: unknown = await response.json();
  if (!isProductResponse(payload)) {
    throw new Error("Product API returned an invalid public product payload");
  }
  return payload;
});
