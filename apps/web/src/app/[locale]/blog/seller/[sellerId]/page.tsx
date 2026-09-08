import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BlogIndex } from "@/components/blog/BlogIndex";
import { isLocale, locales } from "@/lib/i18n";
import { getBlogCollection, isApiNotFound } from "@/lib/public-data";

export async function generateMetadata({ params }: { params: Promise<{ locale: string; sellerId: string }> }): Promise<Metadata> {
  const { locale, sellerId } = await params;
  if (!isLocale(locale)) notFound();
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://top-gsm.ir";
  try {
    const page = await getBlogCollection(locale, { kind: "sellers", slug: sellerId });
    const canonical = `${site}/${locale}/blog/seller/${sellerId}`;
    return {
      title: page.collection.name,
      description: `${page.collection.name} · Top GSM seller articles`,
      alternates: {
        canonical,
        languages: Object.fromEntries(locales.map((code) => [code, `${site}/${code}/blog/seller/${sellerId}`]))
      },
      robots: { index: page.items.length > 0, follow: true },
      openGraph: { title: page.collection.name, url: canonical, type: "website" }
    };
  } catch (error) {
    if (isApiNotFound(error)) notFound();
    return { title: "Seller articles", robots: { index: false, follow: false } };
  }
}

export default async function SellerAuthorPage({ params }: { params: Promise<{ locale: string; sellerId: string }> }) {
  const { locale, sellerId } = await params;
  if (!isLocale(locale)) notFound();
  let page: Awaited<ReturnType<typeof getBlogCollection>> | null = null;
  try {
    page = await getBlogCollection(locale, { kind: "sellers", slug: sellerId });
  } catch (error) {
    if (isApiNotFound(error)) notFound();
  }
  return <BlogIndex locale={locale} posts={page?.items ?? []} heading={page?.collection.name ?? (locale === "fa" ? "نوشته‌های فروشنده" : "Seller articles")} />;
}
