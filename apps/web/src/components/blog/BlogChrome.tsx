import Link from "next/link";
import { PublicHeader } from "@/components/PublicHeader";
import type { Route } from "next";
import type { Locale } from "@/lib/i18n";

const COPY = {
  fa: { issue: "دفتر فنی بازار موبایل", home: "خانه", blog: "مقالات", sellers: "فروشندگان", tagline: "راهنماهای فنی، مقایسه‌ها و تجربه‌های واقعی فروشندگان." },
  en: { issue: "The mobile market technical journal", home: "Home", blog: "Journal", sellers: "Sellers", tagline: "Technical guides, comparisons, and first-hand seller knowledge." },
  ar: { issue: "المجلة التقنية لسوق الهواتف", home: "الرئيسية", blog: "المقالات", sellers: "البائعون", tagline: "أدلة تقنية ومقارنات وخبرة مباشرة من البائعين." }
} as const;

export function BlogHeader({ locale }: { locale: Locale }) { return <PublicHeader locale={locale} current="journal" />; }

export function BlogFooter({ locale }: { locale: Locale }) {
  const copy = COPY[locale];
  return (
    <footer className="journal-footer">
      <strong>TOP GSM</strong>
      <p>{copy.tagline}</p>
      <nav aria-label="Footer">
        <Link href={`/${locale}` as Route}>{copy.home}</Link>
        <Link href={`/${locale}/blog` as Route}>{copy.blog}</Link>
      </nav>
    </footer>
  );
}
