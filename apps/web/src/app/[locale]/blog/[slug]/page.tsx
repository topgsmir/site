import type { Metadata } from "next";
import type { Route } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { BlogArticle } from "@/components/blog/BlogArticle";
import { isLocale } from "@/lib/i18n";
import { getBlogPost, isApiNotFound } from "@/lib/public-data";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://top-gsm.ir";

async function load(locale: "fa" | "en" | "ar", slug: string) {
  try { return await getBlogPost(locale, slug); }
  catch (error) { if (isApiNotFound(error)) notFound(); throw error; }
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const result = await load(locale, slug);
  if ("redirectTo" in result) return { robots: { index: false, follow: true } };
  const canonical = `${SITE_URL}/${locale}/blog/${result.slug}`;
  const images = result.cover?.variants.map((item) => ({ url: `${SITE_URL}${item.url}`, width: item.width, height: item.height, alt: result.coverAltText }));
  return {
    title: result.seoTitle,
    description: result.seoDescription,
    alternates: {
      canonical,
      languages: Object.fromEntries(Object.entries(result.alternateSlugs).map(([code, translatedSlug]) => [code, `${SITE_URL}/${code}/blog/${translatedSlug}`]))
    },
    openGraph: { type: "article", url: canonical, title: result.seoTitle, description: result.seoDescription, publishedTime: result.publishedAt ?? undefined, modifiedTime: result.updatedAt, authors: [result.author.name], images },
    twitter: { card: "summary_large_image", title: result.seoTitle, description: result.seoDescription, images: images?.map((item) => item.url) }
  };
}

export default async function BlogArticlePage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const result = await load(locale, slug);
  if ("redirectTo" in result) {
    if (!result.redirectTo) notFound();
    permanentRedirect(`/${locale}/blog/${result.redirectTo}` as Route);
  }
  const canonical = `${SITE_URL}/${locale}/blog/${result.slug}`;
  const images = result.cover?.variants.map((item) => `${SITE_URL}${item.url}`) ?? [];
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: result.title,
      description: result.excerpt,
      image: images,
      datePublished: result.publishedAt,
      dateModified: result.updatedAt,
      inLanguage: locale,
      mainEntityOfPage: canonical,
      author: result.author.type === "seller"
        ? { "@type": "Organization", name: result.author.name, url: `${SITE_URL}/${locale}/blog/seller/${result.author.id}` }
        : { "@type": "Organization", name: result.author.name, url: SITE_URL },
      publisher: { "@type": "Organization", name: "Top GSM", url: SITE_URL }
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Top GSM", item: `${SITE_URL}/${locale}` },
        { "@type": "ListItem", position: 2, name: "Blog", item: `${SITE_URL}/${locale}/blog` },
        { "@type": "ListItem", position: 3, name: result.title, item: canonical }
      ]
    }
  ];
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} /><BlogArticle locale={locale} post={result} /></>;
}
