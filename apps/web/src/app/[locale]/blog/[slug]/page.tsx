import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { PublicBlogPost } from "@topgsm/shared-types";
import { isLocale, type Locale } from "@/lib/i18n";
import { SERVER_API_BASE } from "@/lib/api/server";
import styles from "./page.module.css";

type BlogPostPageProps = {
  params: Promise<{ locale: string; slug: string }>;
};

async function getPost(slug: string): Promise<PublicBlogPost | null> {
  const response = await fetch(`${SERVER_API_BASE}/blog/posts/${encodeURIComponent(slug)}`, {
    next: { revalidate: 60 }
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("Blog post could not be loaded");
  return response.json() as Promise<PublicBlogPost>;
}

export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const post = await getPost(slug);
  if (!post) return { title: locale === "fa" ? "نوشته پیدا نشد" : "Post not found" };
  return { title: post.title, description: post.excerpt ?? undefined };
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { locale: localeParam, slug } = await params;
  if (!isLocale(localeParam)) notFound();
  const locale: Locale = localeParam;
  const post = await getPost(slug);
  if (!post) notFound();

  const dateLocale = locale === "fa" ? "fa-IR" : locale === "ar" ? "ar" : "en";
  const published = post.publishedAt
    ? new Intl.DateTimeFormat(dateLocale, { dateStyle: "long" }).format(new Date(post.publishedAt))
    : null;

  return (
    <main className={styles.shell}>
      <nav className={styles.topbar} aria-label={locale === "fa" ? "ناوبری نوشته" : "Post navigation"}>
        <Link href={`/${locale}` as Route}>TOP GSM</Link>
        <Link href={`/${locale}` as Route}>{locale === "fa" ? "بازگشت به فروشگاه" : locale === "ar" ? "العودة إلى المتجر" : "Back to store"}</Link>
      </nav>
      <article className={styles.article}>
        <header>
          <p className={styles.eyebrow}>{post.author.shopName}{published ? ` · ${published}` : ""}</p>
          <h1>{post.title}</h1>
          {post.excerpt ? <p className={styles.excerpt}>{post.excerpt}</p> : null}
        </header>
        <div className={styles.content}>{post.content}</div>
        {post.relatedProduct ? (
          <aside className={styles.related}>
            <span>{locale === "fa" ? "محصول مرتبط" : locale === "ar" ? "المنتج المرتبط" : "Related product"}</span>
            <Link href={`/${locale}/products/${encodeURIComponent(post.relatedProduct.slug)}` as Route}>{post.relatedProduct.title}</Link>
          </aside>
        ) : null}
      </article>
    </main>
  );
}
