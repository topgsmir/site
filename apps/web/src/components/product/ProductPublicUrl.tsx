import type { Locale } from "@/lib/i18n";

const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL
  ?? (process.env.NODE_ENV === "development" ? "http://localhost:3000" : "https://top-gsm.ir")
).replace(/\/+$/, "");

export function productPublicPath(locale: Locale, slug: string) {
  return `/${locale}/products/${encodeURIComponent(slug)}`;
}

export function ProductPublicUrl({
  locale,
  slug,
  label,
  className
}: {
  locale: Locale;
  slug: string;
  label: string;
  className?: string;
}) {
  const path = productPublicPath(locale, slug);
  const url = `${SITE_URL}${path}`;

  return <span className={className} dir="ltr" title={label}>{url}</span>;
}
