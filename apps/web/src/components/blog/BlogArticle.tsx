import Link from "next/link";
import Image from "next/image";
import type { Route } from "next";
import type { BlogSidebarDocument, PublicBlogPost, PublicProductSummary, RelatedProductSummary } from "@topgsm/shared-types";
import type { Locale } from "@/lib/i18n";
import { currencyLabel, formatCurrencyAmount } from "@/lib/currency";
import { DesignIcon } from "@/components/DesignIcon";
import { BlogComments } from "@/components/comments/BlogComments";
import { BlogFooter, BlogHeader } from "./BlogChrome";
import { RichText } from "./RichText";
import { articleHeadings, articleText } from "./article-content";
import { ArticleContents, ArticleProductImage, ShareArticle } from "./ArticleTools";
import styles from "./BlogArticle.module.css";

const COPY = {
  fa: { journal: "مجله تاپ جی‌اس‌ام", skip: "رفتن به متن مقاله", breadcrumb: "مسیر صفحه", reading: "دقیقه مطالعه", author: "نویسنده", edit: "ویرایش مقاله", shop: "فروشگاه تاپ جی‌اس‌ام", products: "برای قدم بعدی شما", related: "محصولات مرتبط", intro: "محصولات و خدمات موبایل را ببینید و پیشنهاد فروشندگان را مقایسه کنید.", browse: "مشاهده فروشگاه", from: "از", offers: "مشاهده پیشنهادها", more: "ادامه در مجله", moreText: "راهنماها، مقایسه‌ها و تجربه‌های بیشتر از دنیای موبایل.", all: "همه مقاله‌ها", tags: "موضوعات مقاله", promotion: "معرفی محصولات" },
  en: { journal: "The Top GSM journal", skip: "Skip to article", breadcrumb: "Breadcrumb", reading: "min read", author: "Written by", edit: "Edit article", shop: "TOP GSM STORE", products: "Your next step, here.", related: "Related products", intro: "Explore mobile products and services. Compare offers from sellers.", browse: "Explore the store", from: "From", offers: "View offers", more: "Keep exploring", moreText: "More guides, comparisons and perspectives from the mobile world.", all: "All articles", tags: "Article topics", promotion: "Product spotlight" },
  ar: { journal: "مجلة توب جي إس إم", skip: "انتقل إلى المقال", breadcrumb: "مسار الصفحة", reading: "دقائق للقراءة", author: "بقلم", edit: "تعديل المقال", shop: "متجر توب جي إس إم", products: "خطوتك التالية تبدأ هنا", related: "منتجات ذات صلة", intro: "تصفّح منتجات وخدمات الهواتف وقارن عروض البائعين.", browse: "تصفّح المتجر", from: "من", offers: "عرض العروض", more: "المزيد في المجلة", moreText: "أدلة ومقارنات وتجارب أخرى من عالم الهواتف.", all: "كل المقالات", tags: "مواضيع المقال", promotion: "منتجات المتجر" }
};

type ArticleProduct = RelatedProductSummary & { image?: PublicProductSummary["image"] };

export function BlogArticle({ locale, post, sidebar, storeProducts = [], editHref }: { locale: Locale; post: PublicBlogPost; sidebar?: BlogSidebarDocument | null; storeProducts?: PublicProductSummary[]; editHref?: Route }) {
  const copy = COPY[locale];
  const date = post.publishedAt
    ? new Intl.DateTimeFormat(locale === "fa" ? "fa-IR" : locale, { dateStyle: "long" }).format(new Date(post.publishedAt))
    : null;
  const cover = post.cover?.variants.find((item) => item.name === "wide") ?? post.cover?.variants[0];
  const headings = articleHeadings(post.content.content ?? []).filter((heading) => heading.level === 2);
  const minutes = Math.max(1, Math.ceil(articleText(post.content.content ?? []).trim().split(/\s+/u).filter(Boolean).length / 200));
  const promotion = sidebar?.content;
  const showPromotion = promotion?.enabled ?? true;
  const products: ArticleProduct[] = (post.relatedProducts.length ? post.relatedProducts : sidebar?.products.length ? sidebar.products : storeProducts).slice(0, 3);
  const promotionTitle = promotion?.title ?? (post.relatedProducts.length ? copy.related : copy.products);
  const promotionDescription = promotion?.description ?? copy.intro;
  const promotionLabel = promotion?.ctaLabel ?? copy.browse;
  const promotionHref = promotion?.ctaHref ?? `/${locale}/products`;
  return (
    <div className={`blog-shell ${styles.shell}`}>
      <a className="skip-link" href="#article-body">{copy.skip}</a>
      <BlogHeader locale={locale} languageHrefs={{
        fa: `/fa/blog/${encodeURIComponent(post.alternateSlugs.fa)}`,
        en: `/en/blog/${encodeURIComponent(post.alternateSlugs.en)}`,
        ar: `/ar/blog/${encodeURIComponent(post.alternateSlugs.ar)}`
      }} />
      <main id="article-content" className={styles.main}>
        <nav className={styles.breadcrumbs} aria-label={copy.breadcrumb}>
          <Link href={`/${locale}/blog` as Route}>{copy.journal}</Link>
          {post.category ? <><span aria-hidden="true">/</span><Link href={`/${locale}/blog/category/${encodeURIComponent(post.category.slug)}` as Route}>{post.category.name}</Link></> : null}
        </nav>
        <div className={`${styles.layout} ${showPromotion ? "" : styles.layoutWithoutSidebar}`}>
          <article className={styles.article}>
            <header className={styles.header}>
              <div className={styles.eyebrow}><span>{copy.journal}</span><span className={styles.reading}>{new Intl.NumberFormat(locale).format(minutes)} {copy.reading}</span></div>
              <h1>{post.title}</h1>
              {post.excerpt ? <p className={styles.deck}>{post.excerpt}</p> : null}
              <div className={styles.metadata}>
                <div className={styles.byline}>
                  <span className={styles.avatar} aria-hidden="true">{post.author.type === "editorial" ? "TG" : post.author.name.slice(0, 1)}</span>
                  <div><span className={styles.author}>{post.author.name}</span>{date ? <time dateTime={post.publishedAt ?? undefined}>{date}</time> : <span>{copy.author}</span>}</div>
                </div>
                <div className={styles.articleActions}>
                  {editHref ? <Link className={styles.editAction} href={editHref}>{copy.edit}</Link> : null}
                  <ShareArticle locale={locale} />
                </div>
              </div>
            </header>
            {cover ? <figure className={styles.cover}><Image unoptimized src={cover.url} alt={post.coverAltText} width={cover.width} height={cover.height} sizes="(max-width: 900px) 100vw, 800px" priority /></figure> : null}
            <ArticleContents locale={locale} headings={headings} />
            {showPromotion ? <a className={styles.mobileShopLink} href="#article-shop-title"><DesignIcon name="bag" /><span>{promotionTitle}</span><DesignIcon name="arrow" /></a> : null}
            <div id="article-body" className={styles.body} tabIndex={-1}><RichText document={post.content} headingAnchors /></div>
            {post.tags?.length ? <nav className={styles.tags} aria-label={copy.tags}>{post.tags.map((tag) => <Link key={tag.id} href={`/${locale}/blog/tag/${encodeURIComponent(tag.slug)}` as Route}>{tag.name}</Link>)}</nav> : null}
            <footer className={styles.articleEnd}><div><h2>{copy.more}</h2><p>{copy.moreText}</p></div><Link href={`/${locale}/blog` as Route}>{copy.all}<DesignIcon name="arrow" /></Link></footer>
          </article>
          {showPromotion ? <aside className={styles.sidebar} aria-label={copy.promotion}>
            <section className={styles.shop} aria-labelledby="article-shop-title">
              <div className={styles.shopIntro}>
                <div className={styles.shopLabel}><span>{copy.shop}</span><DesignIcon name="bag" /></div>
                <h2 id="article-shop-title">{promotionTitle}</h2>
                <p>{promotionDescription}</p>
                <a className={styles.shopCta} href={promotionHref}>{promotionLabel}<DesignIcon name="arrow" /></a>
              </div>
              {products.length ? <div className={styles.products}>{products.map((product) => {
                const image = product.image?.variants.find((variant) => variant.name === "thumb") ?? product.image?.variants[0];
                const price = product.startingPrices[0];
                return <Link className={styles.product} key={product.id} href={`/${locale}/products/${encodeURIComponent(product.slug)}` as Route}>
                  <ArticleProductImage image={image} />
                  <span className={styles.productInfo}><strong>{product.title}</strong><span>{price ? <>{copy.from} <bdi>{formatCurrencyAmount(price.price, price.currency, locale)} {currencyLabel(price.currency)}</bdi></> : copy.offers}</span></span>
                  <DesignIcon name="arrow" className={styles.productArrow} />
                </Link>;
              })}</div> : null}
            </section>
          </aside> : null}
        </div>
        <BlogComments postId={post.id} locale={locale} />
      </main>
      <BlogFooter locale={locale} />
    </div>
  );
}
