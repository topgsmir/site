import type { CheckoutCartLine } from "@topgsm/shared-types";

export const CART_KEY = "topgsm-cart-v1";
export const CART_EVENT = "topgsm:cart-updated";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type CartItem = CheckoutCartLine & { productId: string; productName?: string };

export function isCartItem(value: unknown): value is CartItem {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Partial<CartItem>;
  return typeof item.productId === "string" && UUID_PATTERN.test(item.productId) &&
    typeof item.offerId === "string" && UUID_PATTERN.test(item.offerId) &&
    Number.isInteger(item.quantity) && Number(item.quantity) > 0 && Number(item.quantity) <= 100 &&
    (item.productName === undefined || (typeof item.productName === "string" && item.productName.length > 0 && item.productName.length <= 200)) &&
    (item.serviceNote === undefined || (typeof item.serviceNote === "string" && item.serviceNote.length <= 2000));
}

export function readCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(CART_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter(isCartItem).slice(0, 50) : [];
  } catch { return []; }
}

export function writeCart(items: CartItem[]) {
  window.localStorage.setItem(CART_KEY, JSON.stringify(items.filter(isCartItem).slice(0, 50)));
  window.dispatchEvent(new Event(CART_EVENT));
}

export function cartQuantity(items = readCart()) { return items.reduce((total, item) => total + item.quantity, 0); }

export function removePurchasedOffers(offerIds: Iterable<string>) {
  const purchased = new Set(offerIds);
  writeCart(readCart().filter((item) => !purchased.has(item.offerId)));
}
