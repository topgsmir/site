import { ListingPagination } from "@/components/ListingPagination";
import Link from "next/link";
import Image from "next/image";
import type { Route } from "next";
import type { BlogPostSummary } from "@topgsm/shared-types";
import type { Locale } from "@/lib/i18n";
import { BlogFooter, BlogHeader } from "./BlogChrome";
import styles from "./BlogIndex.module.css";

const COPY = {
  fa: {
    eyebrow: "یادگیری، تجربه و تعمیر",
    title: "دانش فنی، از دل بازار",
    intro: "تحلیل‌های دقیق، راهنمای تعمیر و تجربه فروشندگانی که هر روز با دستگاه‌های واقعی کار می‌کنند.",
    latest: "جدیدترین مطالب",
    picks: "منتخب مجله",
    empty: "هنوز مقاله‌ای منتشر نشده است.",
    emptyHint: "مقاله‌های تأییدشده فروشندگان و تحریریه در این صفحه ظاهر می‌شوند.",
    editorial: "تحریریه تاپ جی‌اس‌ام",
    more: "مشاهده عناوین بیشتر"
  },
  en: {
    eyebrow: "Ideas for your workbench",
    title: "Technical knowledge from the market",
    intro: "Precise analysis, repair guides, and first-hand experience from sellers working with real devices every day.",
    latest: "Latest articles",
    picks: "Editor’s picks",
    empty: "No articles have been published yet.",
    emptyHint: "Approved seller and editorial articles will appear here.",
    editorial: "Top GSM Editorial",
    more: "See more titles"
  },
  ar: {
    eyebrow: "تعلم وخبرة وصيانة",
    title: "معرفة تقنية من قلب السوق",
    intro: "تحليلات دقيقة وأدلة صيانة وخبرة البائعين الذين يعملون يومياً مع أجهزة حقيقية.",
    latest: "أحدث المقالات",
    picks: "مختارات المجلة",
    empty: "لم تُنشر مقالات بعد.",
    emptyHint: "ستظهر هنا مقالات البائعين والمحررين بعد اعتمادها.",
    editorial: "تحرير Top GSM",
    more: "عرض المزيد"
  }
} as const;

const LABELS = {
  fa: { journal: "مجله تاپ جی‌اس‌ام", topics: "دسته‌بندی‌ها", tags: "برچسب‌های داغ", about: "درباره نویسندگان", all: "همه مطالب", shop: "فروشگاه تاپ جی‌اس‌ام" },
  en: { journal: "Top GSM Journal", topics: "Categories", tags: "Hot tags", about: "About the authors", all: "All articles", shop: "Top GSM store" },
  ar: { journal: "مجلة Top GSM", topics: "التصنيفات", tags: "وسوم رائجة", about: "عن الكتّاب", all: "جميع المقالات", shop: "متجر Top GSM" }
} as const;

const COLLECTION_COPY = {
  fa: {
    categories: { eyebrow: "دسته‌بندی مجله", latest: "مطالب این دسته", empty: "هنوز مطلبی در این دسته منتشر نشده است.", hint: "می‌توانید سایر مطالب مجله را بخوانید." },
    tags: { eyebrow: "برچسب مجله", latest: "مطالب با این برچسب", empty: "هنوز مطلبی با این برچسب منتشر نشده است.", hint: "می‌توانید سایر مطالب مجله را بخوانید." },
    sellers: { eyebrow: "نویسنده مجله", latest: "مطالب این نویسنده", empty: "هنوز مطلبی از این نویسنده منتشر نشده است.", hint: "می‌توانید سایر مطالب مجله را بخوانید." }
  },
  en: {
    categories: { eyebrow: "Journal category", latest: "Articles in this category", empty: "No articles have been published in this category yet.", hint: "Explore the rest of the journal." },
    tags: { eyebrow: "Journal tag", latest: "Articles with this tag", empty: "No articles have been published with this tag yet.", hint: "Explore the rest of the journal." },
    sellers: { eyebrow: "Journal author", latest: "Articles by this author", empty: "No articles have been published by this author yet.", hint: "Explore the rest of the journal." }
  },
  ar: {
    categories: { eyebrow: "تصنيف المجلة", latest: "مقالات هذا التصنيف", empty: "لم تُنشر مقالات في هذا التصنيف بعد.", hint: "يمكنك استكشاف بقية المجلة." },
    tags: { eyebrow: "وسم المجلة", latest: "مقالات بهذا الوسم", empty: "لم تُنشر مقالات بهذا الوسم بعد.", hint: "يمكنك استكشاف بقية المجلة." },
    sellers: { eyebrow: "كاتب المجلة", latest: "مقالات هذا الكاتب", empty: "لم تُنشر مقالات لهذا الكاتب بعد.", hint: "يمكنك استكشاف بقية المجلة." }
  }
} as const;

const ABOUT = {
  fa: { title: "تجربه‌ای که قابل ردیابی است", body: "هر مطلب فروشنده با نام همان فروشگاه منتشر می‌شود؛ نوشته‌های پلتفرم نیز به‌روشنی با امضای تحریریه مشخص‌اند." },
  en: { title: "Knowledge with a source", body: "Seller articles carry the shop’s public name; platform articles are clearly signed by the editorial desk." },
  ar: { title: "خبرة يمكن تتبعها", body: "يُنشر كل مقال للبائع باسم متجره، وتظهر مقالات المنصة بوضوح باسم هيئة التحرير." }
} as const;

export function BlogIndex({
  locale,
  posts,
  kind,
  heading,
  description,
  activeSlug,
  languageHrefs,
  firstHref,
  nextHref
}: {
  locale: Locale;
  posts: BlogPostSummary[];
  kind?: "categories" | "tags" | "sellers";
  heading?: string;
  description?: string;
  activeSlug?: string;
  languageHrefs?: Record<Locale, string>;
  firstHref?: string;
  nextHref?: string;
}) {
  const copy = COPY[locale];
  const labels = LABELS[locale];
  const about = ABOUT[locale];
  const collectionCopy = kind ? COLLECTION_COPY[locale][kind] : null;
  const categories = [...new Map(posts.flatMap((post) => (post.category ? [[post.category.id, post.category] as const] : []))).values()];
  const tags = [...new Map(posts.flatMap((post) => (post.tags ?? []).map((tag) => [tag.id, tag] as const))).values()].slice(0, 8);
  const mosaicPosts = posts.slice(0, 5);
  const [lead, ...sidePosts] = mosaicPosts;
  const feedPosts = posts.slice(mosaicPosts.length);
  const dateFormatter = new Intl.DateTimeFormat(locale === "fa" ? "fa-IR" : locale, { dateStyle: "medium" });

  return (
    <div className={`blog-shell ${styles.shell}`}>
      <a className="skip-link" href="#journal-content">{locale === "fa" ? "رفتن به محتوا" : locale === "ar" ? "انتقل إلى المحتوى" : "Skip to content"}</a>
      <BlogHeader locale={locale} languageHrefs={languageHrefs} />
      <main id="journal-content" className={styles.index}>
        <div className={styles.layout}>
          <aside className={styles.rail} aria-label={labels.topics}>
            <div className={styles.brand}>
              <p>{labels.journal}</p>
              <span lang="en" dir="ltr">TOP GSM / MAG</span>
            </div>
            <nav className={styles.categories}>
              <Link href={`/${locale}/blog` as Route} className={styles.cat} data-active={!kind || undefined}>
                {labels.all}
              </Link>
              {categories.map((category) => (
                <Link
                  key={category.id}
                  href={`/${locale}/blog/category/${encodeURIComponent(category.slug)}` as Route}
                  className={styles.cat}
                  data-active={activeSlug === category.slug || undefined}
                >
                  {category.name}
                </Link>
              ))}
            </nav>
            <Link href={`/${locale}/products` as Route} className={styles.shopLink}>{labels.shop}</Link>
          </aside>

          <div className={styles.main}>
            <header className={styles.pageHead}>
              {collectionCopy ? (
                <nav className={styles.breadcrumb} aria-label={labels.journal}>
                  <Link href={`/${locale}/blog` as Route}>{labels.all}</Link>
                  <span aria-hidden="true">/</span>
                  <span aria-current="page">{heading}</span>
                </nav>
              ) : null}
              <div className={styles.titleRow}>
                <div>
                  <p className={styles.eyebrow}>{collectionCopy?.eyebrow ?? copy.eyebrow}</p>
                  <h1>{heading ?? copy.title}</h1>
                </div>
                {!collectionCopy ? <p className={styles.lede}>{description ?? copy.intro}</p> : null}
              </div>
              {collectionCopy && description ? <p className={styles.lede}>{description}</p> : null}
              {tags.length ? (
                <nav className={styles.tags} aria-label={labels.tags}>
                  <span>{labels.tags}</span>
                  {tags.map((tag) => (
                    <Link key={tag.id} href={`/${locale}/blog/tag/${encodeURIComponent(tag.slug)}` as Route}>#{tag.name}</Link>
                  ))}
                </nav>
              ) : null}
            </header>

            {lead ? (
              <section className={styles.picks} aria-label={copy.picks}>
                <div className={sidePosts.length ? styles.mosaic : styles.mosaicSolo}>
                  <Tile post={lead} locale={locale} editorial={copy.editorial} className={styles.lead} heading="h2" eager />
                  {sidePosts.map((post) => (
                    <Tile key={post.id} post={post} locale={locale} editorial={copy.editorial} className={styles.tile} heading="h3" />
                  ))}
                </div>
              </section>
            ) : (
              <section className={styles.empty} aria-labelledby="empty-title">
                <h2 id="empty-title">{collectionCopy?.empty ?? copy.empty}</h2>
                <p>{collectionCopy?.hint ?? copy.emptyHint}</p>
                {collectionCopy ? <Link href={`/${locale}/blog` as Route}>{labels.all}</Link> : null}
              </section>
            )}

            {feedPosts.length ? (
              <section className={styles.feed} aria-labelledby="latest-title">
                <header className={styles.feedHead}>
                  <h2 id="latest-title">{collectionCopy?.latest ?? copy.latest}</h2>
                  {nextHref ? <Link href={nextHref as Route}>{copy.more}</Link> : null}
                </header>
                <ul className={styles.cards}>
                  {feedPosts.map((post) => (
                    <li key={post.id}>
                      <article className={styles.card}>
                        <Link className={styles.cardCover} href={`/${locale}/blog/${post.slug}` as Route} tabIndex={-1} aria-hidden="true">
                          <Cover post={post} sizes="(max-width: 540px) 40vw, 220px" />
                        </Link>
                        <div className={styles.cardBody}>
                          {post.category ? (
                            <Link className={styles.kicker} href={`/${locale}/blog/category/${encodeURIComponent(post.category.slug)}` as Route}>
                              {post.category.name}
                            </Link>
                          ) : null}
                          <h3><Link href={`/${locale}/blog/${post.slug}` as Route}>{post.title}</Link></h3>
                          {post.excerpt ? <p className={styles.excerpt}>{post.excerpt}</p> : null}
                          <div className={styles.byline}>
                            <span>{post.author?.name ?? copy.editorial}</span>
                            {post.publishedAt ? <time dateTime={post.publishedAt}>{dateFormatter.format(new Date(post.publishedAt))}</time> : null}
                          </div>
                        </div>
                      </article>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <ListingPagination locale={locale} firstHref={firstHref} nextHref={nextHref} />

            <aside id="seller-authors" className={styles.about} aria-label={labels.about}>
              <p>{labels.about}</p>
              <div>
                <h2>{about.title}</h2>
                <p>{about.body}</p>
              </div>
            </aside>
          </div>
        </div>
      </main>
      <BlogFooter locale={locale} />
    </div>
  );
}

function Tile({
  post,
  locale,
  editorial,
  className,
  heading,
  eager = false
}: {
  post: BlogPostSummary;
  locale: Locale;
  editorial: string;
  className: string;
  heading: "h2" | "h3";
  eager?: boolean;
}) {
  const Title = heading;
  return (
    <article className={className}>
      <Link href={`/${locale}/blog/${post.slug}` as Route} className={styles.tileLink}>
        <Cover post={post} eager={eager} sizes={eager ? "(max-width: 700px) 100vw, 55vw" : "(max-width: 700px) 50vw, 25vw"} />
        <div className={styles.tileShade} aria-hidden="true" />
        <div className={styles.tileCopy}>
          {post.category ? <span className={styles.tileKicker}>{post.category.name}</span> : null}
          <Title>{post.title}</Title>
          <span className={styles.tileByline}>{post.author?.name ?? editorial}</span>
        </div>
      </Link>
    </article>
  );
}

function Cover({ post, eager = false, sizes }: { post: BlogPostSummary; eager?: boolean; sizes: string }) {
  const variants = post.cover?.variants ?? [];
  const wide = variants.find((item) => item.name === "wide") ?? variants[0];
  if (!wide) return <div className={styles.placeholder} aria-hidden="true"><span>TOP GSM</span></div>;
  return <Image className={styles.cover} unoptimized src={wide.url} alt="" width={wide.width} height={wide.height} sizes={sizes} priority={eager} />;
}
