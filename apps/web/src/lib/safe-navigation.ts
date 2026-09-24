export function safeExternalHref(value: unknown): string | null {
  if (typeof value !== "string" || !value || value.length > 2_048 || /[\p{Cc}\p{Cf}]/u.test(value)) return null;
  if (/^mailto:[^%?\s@]+@[^%?\s@]+$/i.test(value)) return value;
  if (/^tel:[+0-9(). -]{1,64}$/i.test(value)) return value;
  try {
    const url = new URL(value);
    if ((url.protocol !== "http:" && url.protocol !== "https:") || url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function safeInternalPath(value: unknown, requiredPrefix: string): string | null {
  if (
    typeof value !== "string" || !value || value.length > 2_048 ||
    /[\p{Cc}\p{Cf}\\]/u.test(value) || /%(?:00|0a|0d|2f|5c)/i.test(value)
  ) return null;
  try {
    const base = new URL("https://topgsm.invalid");
    const url = new URL(value, base);
    if (url.origin !== base.origin || !url.pathname.startsWith(requiredPrefix)) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

export function isUuidV4(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function safePaymentHref(value: unknown, locale: string): string | null {
  if (typeof value !== "string" || !value || value.length > 2_048 || /[\p{Cc}\p{Cf}\\]/u.test(value)) return null;
  if (/^\/pay\/local\/local-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    return `/${locale}${value}`;
  }
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url.toString() : null;
  } catch {
    return null;
  }
}
