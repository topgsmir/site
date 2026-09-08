import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BlogIndex } from "@/components/blog/BlogIndex";
import { isLocale } from "@/lib/i18n";
import { getBlogPosts } from "@/lib/public-data";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://top-gsm.ir";
const COPY = {
  fa: { title: "مجله فنی موبایل", description: "راهنماهای فنی، مقایسه محصولات و تجربه واقعی فروشندگان تاپ جی‌اس‌ام." },
  en: { title: "Mobile technology journal", description: "Technical guides, product comparisons, and first-hand knowledge from Top GSM sellers." },
  ar: { title: "مجلة تقنية للهواتف", description: "أدلة تقنية ومقارنات منتجات وخبرة مباشرة من بائعي Top GSM." }
} as const;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const copy = COPY[locale];
  const canonical = `${SITE_URL}/${locale}/blog`;
  return {
    title: copy.title,
    description: copy.description,
    alternates: {
      canonical,
      languages: Object.fromEntries((["fa", "en", "ar"] as const).map((code) => [code, `${SITE_URL}/${code}/blog`]))
    },
    openGraph: { type: "website", url: canonical, title: copy.title, description: copy.description },
    twitter: { card: "summary_large_image", title: copy.title, description: copy.description }
  };
}

export default async function BlogPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const page = await getBlogPosts(locale).catch(() => ({ items: [], nextCursor: null }));
  return <BlogIndex locale={locale} posts={page.items} />;
}
