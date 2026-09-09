import type { Route } from "next";
import Link from "next/link";
import type { Locale } from "@/lib/i18n";

const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL
  ?? (process.env.NODE_ENV === "development" ? "http://localhost:3000" : "https://top-gsm.ir")
).replace(/\/+$/, "");

export function blogPublicPath(locale: Locale, slug: string) {
  return `/${locale}/blog/${encodeURIComponent(slug)}`;
}

export function BlogPublicUrl({
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
  const path = blogPublicPath(locale, slug);

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
      {SITE_URL}{path}
    </Link>
  );
}
