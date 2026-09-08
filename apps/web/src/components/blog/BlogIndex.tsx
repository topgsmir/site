import Link from "next/link";
import Image from "next/image";
import type { BlogPostSummary } from "@topgsm/shared-types";
import type { Locale } from "@/lib/i18n";
import { BlogFooter, BlogHeader } from "./BlogChrome";

const COPY = {
  fa: { eyebrow: "ECOSYSTEM INDEX · به‌روزرسانی پیوسته", title: "دانش فنی، از دل بازار", intro: "تحلیل‌های دقیق، راهنمای تعمیر و تجربه فروشندگانی که هر روز با دستگاه‌های واقعی کار می‌کنند.", latest: "تازه‌ترین مطالب", empty: "هنوز مقاله‌ای منتشر نشده است.", emptyHint: "مقاله‌های تأییدشده فروشندگان و تحریریه در این صفحه ظاهر می‌شوند.", read: "مطالعه", editorial: "تحریریه تاپ جی‌اس‌ام" },
  en: { eyebrow: "ECOSYSTEM INDEX · CONTINUOUSLY UPDATED", title: "Technical knowledge from the market", intro: "Precise analysis, repair guides, and first-hand experience from sellers working with real devices every day.", latest: "Latest documents", empty: "No articles have been published yet.", emptyHint: "Approved seller and editorial articles will appear here.", read: "Read", editorial: "Top GSM Editorial" },
  ar: { eyebrow: "ECOSYSTEM INDEX · تحديث مستمر", title: "معرفة تقنية من قلب السوق", intro: "تحليلات دقيقة وأدلة صيانة وخبرة البائعين الذين يعملون يومياً مع أجهزة حقيقية.", latest: "أحدث المقالات", empty: "لم تُنشر مقالات بعد.", emptyHint: "ستظهر هنا مقالات البائعين والمحررين بعد اعتمادها.", read: "قراءة", editorial: "تحرير Top GSM" }
} as const;

export function BlogIndex({
  locale,
  posts,
  heading,
  description
}: {
  locale: Locale;
  posts: BlogPostSummary[];
  heading?: string;
  description?: string;
}) {
  const copy = COPY[locale];
  const [featured, ...latest] = posts;
  const dateFormatter = new Intl.DateTimeFormat(locale === "fa" ? "fa-IR" : locale, { dateStyle: "long" });
  return (
    <div className="blog-shell">
      <a className="skip-link" href="#journal-content">Skip to content</a>
      <BlogHeader locale={locale} />
      <main id="journal-content" className="journal-index">
        <header className="journal-intro">
          <p>{copy.eyebrow}</p>
          <h1>{heading ?? copy.title}</h1>
          <p>{description ?? copy.intro}</p>
        </header>

        {featured ? (
          <article className="journal-feature">
            <Cover post={featured} eager />
            <div>
              <p className="journal-kicker">{featured.category?.name ?? copy.latest}</p>
              <h2><Link href={`/${locale}/blog/${featured.slug}`}>{featured.title}</Link></h2>
              <p>{featured.excerpt}</p>
              <div className="journal-byline">
                <span>{featured.author?.name ?? copy.editorial}</span>
                {featured.publishedAt ? <time dateTime={featured.publishedAt}>{dateFormatter.format(new Date(featured.publishedAt))}</time> : null}
              </div>
              <Link className="journal-read" href={`/${locale}/blog/${featured.slug}`}>{copy.read} <span aria-hidden="true">↗</span></Link>
            </div>
          </article>
        ) : (
          <section className="journal-empty" aria-labelledby="empty-title">
            <span aria-hidden="true">§</span>
            <h2 id="empty-title">{copy.empty}</h2>
            <p>{copy.emptyHint}</p>
          </section>
        )}

        {latest.length ? (
          <section className="journal-latest" aria-labelledby="latest-title">
            <header><p>02</p><h2 id="latest-title">{copy.latest}</h2></header>
            <div className="journal-grid">
              {latest.map((post, index) => (
                <article key={post.id}>
                  <p className="journal-index-number">{String(index + 2).padStart(2, "0")}</p>
                  <Cover post={post} />
                  <p className="journal-kicker">{post.category?.name}</p>
                  <h3><Link href={`/${locale}/blog/${post.slug}`}>{post.title}</Link></h3>
                  <p>{post.excerpt}</p>
                  <div className="journal-byline"><span>{post.author?.name}</span></div>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        <section id="seller-authors" className="journal-sellers">
          <p>03 / AUTHORS</p>
          <h2>{locale === "fa" ? "تجربه‌ای که قابل ردیابی است" : locale === "ar" ? "خبرة يمكن تتبعها" : "Knowledge with a source"}</h2>
          <p>{locale === "fa" ? "هر مطلب فروشنده با نام همان فروشگاه منتشر می‌شود؛ نوشته‌های پلتفرم نیز به‌روشنی با امضای تحریریه مشخص‌اند." : locale === "ar" ? "يُنشر كل مقال للبائع باسم متجره، وتظهر مقالات المنصة بوضوح باسم هيئة التحرير." : "Seller articles carry the shop’s public name; platform articles are clearly signed by the editorial desk."}</p>
        </section>
      </main>
      <BlogFooter locale={locale} />
    </div>
  );
}

function Cover({ post, eager = false }: { post: BlogPostSummary; eager?: boolean }) {
  const variants = post.cover?.variants ?? [];
  const wide = variants.find((item) => item.name === "wide") ?? variants[0];
  if (!wide) return <div className="journal-cover-placeholder" aria-hidden="true"><span>TOP GSM</span></div>;
  return <Image className="journal-cover" unoptimized src={wide.url} alt="" width={wide.width} height={wide.height} sizes="(max-width: 760px) 100vw, 58vw" priority={eager} />;
}
