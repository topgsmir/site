import { ListingPagination } from "@/components/ListingPagination";
import Link from "next/link";
import Image from "next/image";
import type { Route } from "next";
import type { BlogPostSummary } from "@topgsm/shared-types";
import type { Locale } from "@/lib/i18n";
import { BlogFooter, BlogHeader } from "./BlogChrome";
import styles from "./BlogIndex.module.css";

const COPY = {
  fa: { eyebrow: "یادگیری، تجربه و تعمیر", title: "دانش فنی، از دل بازار", intro: "تحلیل‌های دقیق، راهنمای تعمیر و تجربه فروشندگانی که هر روز با دستگاه‌های واقعی کار می‌کنند.", latest: "تازه‌ترین مطالب", empty: "هنوز مقاله‌ای منتشر نشده است.", emptyHint: "مقاله‌های تأییدشده فروشندگان و تحریریه در این صفحه ظاهر می‌شوند.", read: "مطالعه", editorial: "تحریریه تاپ جی‌اس‌ام" },
  en: { eyebrow: "Ideas for your workbench", title: "Technical knowledge from the market", intro: "Precise analysis, repair guides, and first-hand experience from sellers working with real devices every day.", latest: "Latest documents", empty: "No articles have been published yet.", emptyHint: "Approved seller and editorial articles will appear here.", read: "Read", editorial: "Top GSM Editorial" },
  ar: { eyebrow: "تعلم وخبرة وصيانة", title: "معرفة تقنية من قلب السوق", intro: "تحليلات دقيقة وأدلة صيانة وخبرة البائعين الذين يعملون يومياً مع أجهزة حقيقية.", latest: "أحدث المقالات", empty: "لم تُنشر مقالات بعد.", emptyHint: "ستظهر هنا مقالات البائعين والمحررين بعد اعتمادها.", read: "قراءة", editorial: "تحرير Top GSM" }
} as const;

const LABELS = {
  fa: { journal: "مجله تاپ جی‌اس‌ام", topics: "موضوعات این صفحه", more: "مطالب بیشتر", about: "درباره نویسندگان", all: "همه مطالب", article: "مطلب در این صفحه" },
  en: { journal: "Top GSM Journal", topics: "Topics on this page", more: "More to read", about: "About the authors", all: "All articles", article: "articles on this page" },
  ar: { journal: "مجلة Top GSM", topics: "مواضيع هذه الصفحة", more: "المزيد للقراءة", about: "عن الكتّاب", all: "جميع المقالات", article: "مقالات في هذه الصفحة" }
} as const;

export function BlogIndex({
  locale,
  posts,
  heading,
  description,
  languageHrefs,
  firstHref,
  nextHref
}: {
  locale: Locale;
  posts: BlogPostSummary[];
  heading?: string;
  description?: string;
  languageHrefs?: Record<Locale, string>;
  firstHref?: string;
  nextHref?: string;
}) {
  const copy = COPY[locale];
  const labels = LABELS[locale];
  const categories = [...new Map(posts.flatMap((post) => post.category ? [[post.category.id, post.category] as const] : [])).values()];
  const [featured, ...latest] = posts;
  const dateFormatter = new Intl.DateTimeFormat(locale === "fa" ? "fa-IR" : locale, { dateStyle: "long" });
  return (
    <div className={`blog-shell ${styles.shell}`}>
      <a className="skip-link" href="#journal-content">{locale === "fa" ? "رفتن به محتوا" : locale === "ar" ? "انتقل إلى المحتوى" : "Skip to content"}</a>
      <BlogHeader locale={locale} languageHrefs={languageHrefs} />
      <main id="journal-content" className={styles.index}>
        <header className={styles.intro}>
          <div className={styles.masthead}><span>{labels.journal}</span><span lang="en" dir="ltr">TOP GSM / JOURNAL</span></div>
          <div className={styles.introBody}><div>
          <p>{copy.eyebrow}</p>
          <h1>{heading ?? copy.title}</h1>
          </div>
          <p>{description ?? copy.intro}</p>
          </div>
        </header>
        <div className={styles.layout}>
        <div className={styles.feed}>
        <header className={styles.feedHeader}><h2>{copy.latest}</h2><span>{new Intl.NumberFormat(locale).format(posts.length)} {labels.article}</span></header>
        {featured ? (
          <article className={styles.feature}>
            <Link className={styles.coverLink} href={`/${locale}/blog/${featured.slug}` as Route} tabIndex={-1} aria-hidden="true"><Cover post={featured} eager /></Link>
            <div className={styles.content}>
              <p className={styles.kicker}>{featured.category?.name ?? copy.latest}</p>
              <h3><Link href={`/${locale}/blog/${featured.slug}` as Route}>{featured.title}</Link></h3>
              <p className={styles.excerpt}>{featured.excerpt}</p>
              <div className={styles.byline}>
                <span>{featured.author?.name ?? copy.editorial}</span>
                {featured.publishedAt ? <time dateTime={featured.publishedAt}>{dateFormatter.format(new Date(featured.publishedAt))}</time> : null}
              </div>
              <Link className={styles.read} href={`/${locale}/blog/${featured.slug}` as Route}>{copy.read} <span aria-hidden="true">{locale === "en" ? "→" : "←"}</span></Link>
            </div>
          </article>
        ) : (
          <section className={styles.empty} aria-labelledby="empty-title">
            <span aria-hidden="true">§</span>
            <h2 id="empty-title">{copy.empty}</h2>
            <p>{copy.emptyHint}</p>
          </section>
        )}

        {latest.length ? (
          <section className={styles.latest} aria-labelledby="latest-title">
            <header><h2 id="latest-title">{labels.more}</h2></header>
            <div className={styles.grid}>
              {latest.map((post) => (
                <article key={post.id}>
                  <Link className={styles.coverLink} href={`/${locale}/blog/${post.slug}` as Route} tabIndex={-1} aria-hidden="true"><Cover post={post} /></Link>
                  <div className={styles.content}>
                  {post.category ? <p className={styles.kicker}>{post.category.name}</p> : null}
                  <h3><Link href={`/${locale}/blog/${post.slug}` as Route}>{post.title}</Link></h3>
                  <p className={styles.excerpt}>{post.excerpt}</p>
                  <div className={styles.byline}>
                    <span>{post.author?.name ?? copy.editorial}</span>
                    {post.publishedAt ? <time dateTime={post.publishedAt}>{dateFormatter.format(new Date(post.publishedAt))}</time> : null}
                  </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        <ListingPagination locale={locale} firstHref={firstHref} nextHref={nextHref} />
        </div>
        <aside className={styles.sidebar} aria-label={labels.about}>
        {categories.length ? <nav className={styles.topics} aria-label={labels.topics}>
          <h2>{labels.topics}</h2>
          <Link href={`/${locale}/blog` as Route}>{labels.all}<span aria-hidden="true">{locale === "en" ? "↗" : "↖"}</span></Link>
          {categories.map((category) => <Link key={category.id} href={`/${locale}/blog/category/${encodeURIComponent(category.slug)}` as Route}>{category.name}<span aria-hidden="true">{locale === "en" ? "↗" : "↖"}</span></Link>)}
        </nav> : null}
        <section id="seller-authors" className={styles.sellers}>
          <div className={styles.authorMark} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 5.5c3-1 5.5-.5 8 1.5 2.5-2 5-2.5 8-1.5v13c-3-1-5.5-.5-8 1.5-2.5-2-5-2.5-8-1.5zM12 7v13" /></svg></div>
          <p className={styles.sidebarLabel}>{labels.about}</p>
          <h2>{locale === "fa" ? "تجربه‌ای که قابل ردیابی است" : locale === "ar" ? "خبرة يمكن تتبعها" : "Knowledge with a source"}</h2>
          <p>{locale === "fa" ? "هر مطلب فروشنده با نام همان فروشگاه منتشر می‌شود؛ نوشته‌های پلتفرم نیز به‌روشنی با امضای تحریریه مشخص‌اند." : locale === "ar" ? "يُنشر كل مقال للبائع باسم متجره، وتظهر مقالات المنصة بوضوح باسم هيئة التحرير." : "Seller articles carry the shop’s public name; platform articles are clearly signed by the editorial desk."}</p>
        </section>
        </aside>
        </div>
      </main>
      <BlogFooter locale={locale} />
    </div>
  );
}

function Cover({ post, eager = false }: { post: BlogPostSummary; eager?: boolean }) {
  const variants = post.cover?.variants ?? [];
  const wide = variants.find((item) => item.name === "wide") ?? variants[0];
  if (!wide) return <div className={styles.placeholder} aria-hidden="true"><span>TOP GSM</span></div>;
  return <Image className={styles.cover} unoptimized src={wide.url} alt="" width={wide.width} height={wide.height} sizes={eager ? "(max-width: 540px) 64px, 96px" : "88px"} priority={eager} />;
}
