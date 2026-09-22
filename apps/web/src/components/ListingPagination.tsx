import Link from "next/link";
import type { Route } from "next";
import type { Locale } from "@/lib/i18n";
import { catalogCopy } from "@/lib/seo";
import styles from "./ListingPagination.module.css";

export function ListingPagination({ locale, firstHref, nextHref }: { locale: Locale; firstHref?: string; nextHref?: string }) {
  if (!firstHref && !nextHref) return null;
  const copy = catalogCopy[locale];
  return <nav className={styles.pagination} aria-label={copy.pagination}>
    {firstHref && <Link href={firstHref as Route}>{copy.first}</Link>}
    {nextHref && <Link href={nextHref as Route} rel="next">{copy.next}</Link>}
  </nav>;
}
