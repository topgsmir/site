import Link from "next/link";
import Image from "next/image";
import type { Route } from "next";
import type { PublicBlogPost } from "@topgsm/shared-types";
import type { Locale } from "@/lib/i18n";
import { BlogFooter, BlogHeader } from "./BlogChrome";
import { RichText } from "./RichText";

export function BlogArticle({ locale, post }: { locale: Locale; post: PublicBlogPost }) {
  const date = post.publishedAt
    ? new Intl.DateTimeFormat(locale === "fa" ? "fa-IR" : locale, { dateStyle: "long" }).format(new Date(post.publishedAt))
    : null;
  const cover = post.cover?.variants.find((item) => item.name === "wide") ?? post.cover?.variants[0];
  return (
    <div className="blog-shell">
      <a className="skip-link" href="#article-content">Skip to article</a>
      <BlogHeader locale={locale} />
      <main id="article-content" className="long-document">
        <nav className="article-breadcrumbs" aria-label="Breadcrumb">
          <Link href={`/${locale}/blog` as Route}>{locale === "fa" ? "مقالات" : locale === "ar" ? "المقالات" : "Journal"}</Link>
          {post.category ? <><span aria-hidden="true">/</span><Link href={`/${locale}/blog/category/${post.category.slug}` as Route}>{post.category.name}</Link></> : null}
        </nav>
        <article>
          <header className="article-header">
            <p className="journal-kicker">{post.category?.name ?? "TOP GSM / DOCUMENT"}</p>
            <h1>{post.title}</h1>
            <p className="article-deck">{post.excerpt}</p>
            <div className="article-meta">
              <span>{post.author.name}</span>
              {date ? <time dateTime={post.publishedAt ?? undefined}>{date}</time> : null}
            </div>
          </header>
          {cover ? <Image className="article-cover" unoptimized src={cover.url} alt={post.coverAltText} width={cover.width} height={cover.height} sizes="(max-width: 840px) 100vw, 840px" priority /> : null}
          <RichText document={post.content} />
        </article>

        {post.relatedProducts.length ? (
          <aside className="article-products" aria-labelledby="related-products-title">
            <header><p>RELATED / {String(post.relatedProducts.length).padStart(2, "0")}</p><h2 id="related-products-title">{locale === "fa" ? "محصولات مرتبط با این راهنما" : locale === "ar" ? "منتجات مرتبطة بهذا الدليل" : "Products related to this guide"}</h2></header>
            <div>
              {post.relatedProducts.map((product) => (
                <Link key={product.id} href={`/${locale}/products/${product.slug}` as Route}>
                  <strong>{product.title}</strong>
                  <span>{product.startingPrices[0] ? `${product.startingPrices[0].price} ${product.startingPrices[0].currency}` : locale === "fa" ? "مشاهده پیشنهادها" : "View offers"}</span>
                </Link>
              ))}
            </div>
          </aside>
        ) : null}
      </main>
      <BlogFooter locale={locale} />
    </div>
  );
}
