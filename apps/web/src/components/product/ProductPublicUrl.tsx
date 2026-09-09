import type { Route } from "next";
import Link from "next/link";
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

  return (
    <Link
      className={className}
      href={path as Route}
      target="_blank"
      rel="noopener noreferrer"
      dir="ltr"
      title={label}
      aria-label={label}
    >
      {url}
    </Link>
  );
}
