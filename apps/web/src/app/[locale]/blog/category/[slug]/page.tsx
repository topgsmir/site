import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BlogIndex } from "@/components/blog/BlogIndex";
import { isLocale, locales } from "@/lib/i18n";
import { getBlogCollection, isApiNotFound } from "@/lib/public-data";

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://top-gsm.ir";
  try {
    const page = await getBlogCollection(locale, { kind: "categories", slug });
    const canonical = `${site}/${locale}/blog/category/${page.collection.alternateSlugs[locale]}`;
    return {
      title: page.collection.name,
      description: `${page.collection.name} · Top GSM technical journal`,
      alternates: {
        canonical,
        languages: Object.fromEntries(locales.map((code) => [code, `${site}/${code}/blog/category/${page.collection.alternateSlugs[code]}`]))
      },
      robots: { index: page.items.length > 0, follow: true },
      openGraph: { title: page.collection.name, url: canonical, type: "website" }
    };
  } catch (error) {
    if (isApiNotFound(error)) notFound();
    return { title: slug, robots: { index: false, follow: false } };
  }
}

export default async function CategoryPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  let page: Awaited<ReturnType<typeof getBlogCollection>> | null = null;
  try {
    page = await getBlogCollection(locale, { kind: "categories", slug });
  } catch (error) {
    if (isApiNotFound(error)) notFound();
  }
  return <BlogIndex locale={locale} posts={page?.items ?? []} heading={page?.collection.name ?? slug.replaceAll("-", " ")} />;
}
