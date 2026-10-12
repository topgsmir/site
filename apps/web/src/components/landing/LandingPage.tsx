import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";
import type { HomepageContent, HomepageStory, PublicExpertSummary, PublicProductSummary } from "@topgsm/shared-types";
import { DesignIcon, type DesignIconName } from "@/components/DesignIcon";
import { PublicFooter } from "@/components/PublicFooter";
import { getDirection, type Locale } from "@/lib/i18n";
import { currencyLabel, formatCurrencyAmount } from "@/lib/currency";
import { defaultHomepage, homepageExpertsTitle, homepageHeroAds } from "./homepage-defaults";
import { ExpertGrid } from "./ExpertGrid";
import { OfferCarousel } from "./OfferCarousel";
import styles from "./LandingPage.module.css";

export type HomepageProduct = PublicProductSummary;
export type HomepageExpert = PublicExpertSummary;
export const HOMEPAGE_LATEST_PRODUCT_LIMIT = 5;

export type LandingPageProps = {
  locale: Locale;
  products: HomepageProduct[];
  experts: HomepageExpert[];
  stories: HomepageStory[];
  content?: HomepageContent;
  editable?: boolean;
  productsUnavailable?: boolean;
  expertsUnavailable?: boolean;
};

const copy = {
  fa: { skip: "رفتن به محتوا", all: "همه محصولات", explore: "مشاهده مجموعه", details: "مشاهده جزئیات", expert: "کارشناس تأییدشده", profile: "مشاهده پروفایل", active: "محصول فعال", emptyExperts: "پروفایل کارشناسان به‌زودی در این بخش نمایش داده می‌شود.", emptyProducts: "محصولات تازه پس از انتشار، اینجا نمایش داده می‌شوند.", contact: "ارتباط با پشتیبانی", digital: "فایل و آموزش", physical: "ابزار و تجهیزات", service: "خدمات آنلاین", featured: "منتخب تاپ جی‌اس‌ام", latest: "تازه منتشرشده", people: "متخصصان، کنار شما", links: "دسترسی سریع", stories: "دسترسی‌های ویژه", since: "برای حرفه‌ای‌های دنیای موبایل", edit: "ویرایش صفحه اصلی", more: "مشاهده فروشگاه" },
  en: { skip: "Skip to content", all: "All products", explore: "Explore collection", details: "View details", expert: "Verified expert", profile: "View profile", active: "active products", emptyExperts: "Expert profiles will appear here when available.", emptyProducts: "New products will appear here when published.", contact: "Contact support", digital: "Files & training", physical: "Tools & equipment", service: "Online services", featured: "THE TOP GSM EDIT", latest: "JUST ADDED", people: "EXPERTISE, WITH A HUMAN SIDE", links: "Quick access", stories: "Featured links", since: "FOR THE CRAFT OF REPAIR", edit: "Edit homepage", more: "Browse the shop" },
  ar: { skip: "انتقل إلى المحتوى", all: "جميع المنتجات", explore: "اكتشف المجموعة", details: "عرض التفاصيل", expert: "خبير معتمد", profile: "عرض الملف", active: "منتج نشط", emptyExperts: "ستظهر ملفات الخبراء هنا عند توفرها.", emptyProducts: "ستظهر المنتجات الجديدة هنا بعد نشرها.", contact: "تواصل مع الدعم", digital: "ملفات وتدريب", physical: "أدوات ومعدات", service: "خدمات عن بعد", featured: "مختارات Top GSM", latest: "أضيف حديثًا", people: "متخصصون بجانبك", links: "وصول سريع", stories: "روابط مميزة", since: "لمحترفي صيانة الجوال", edit: "تعديل الصفحة الرئيسية", more: "تصفح المتجر" }
} as const;
const shortcutIcons: DesignIconName[] = ["headphones", "file", "layers"];
const adActions = { fa: "مشاهده سرویس", en: "Explore service", ar: "استكشف الخدمة" } as const;
const partnershipEyebrow = { fa: "همکاری با کسب‌وکارها", en: "Business collaboration", ar: "التعاون مع الشركات" } as const;
const unavailableCopy = {
  fa: { products: "فهرست محصولات در حال حاضر در دسترس نیست. کمی بعد دوباره تلاش کنید.", experts: "فهرست کارشناسان در حال حاضر در دسترس نیست. کمی بعد دوباره تلاش کنید.", retry: "تلاش دوباره" },
  en: { products: "Products are temporarily unavailable. Please try again shortly.", experts: "Expert profiles are temporarily unavailable. Please try again shortly.", retry: "Try again" },
  ar: { products: "المنتجات غير متاحة مؤقتًا. يرجى المحاولة بعد قليل.", experts: "ملفات الخبراء غير متاحة مؤقتًا. يرجى المحاولة بعد قليل.", retry: "حاول مجددًا" }
} as const;

function productImage(product: HomepageProduct, preferred: "thumb" | "large" = "thumb") {
  return product.image?.variants.find((variant) => variant.name === preferred) ?? product.image?.variants[0];
}
function price(product: HomepageProduct, locale: Locale) {
  if (product.price === undefined || !product.currency) return copy[locale].details;
  return `${formatCurrencyAmount(product.price, product.currency, locale)} ${currencyLabel(product.currency)}`;
}
export function LandingPage({ locale, products, experts, stories, content, editable = false, productsUnavailable = false, expertsUnavailable = false }: LandingPageProps) {
  const c = copy[locale];
  const home = content ?? defaultHomepage(locale);
  const heroAds = home.heroAds?.length ? home.heroAds : homepageHeroAds(locale);
  const hasCollections = home.collections.enabled && home.collections.items.length > 0;
  const solutionCards = [
    ...heroAds.map((item, index) => ({ item, action: adActions[locale], key: `featured-${index}` })),
    ...(hasCollections ? home.collections.items.map((item, index) => ({ item, action: c.explore, key: `collection-${index}` })) : [])
  ];
  const shop = `/${locale}/products`;
  const labels = { digital: c.digital, physical: c.physical, service: c.service, bridge: c.service };
  const latestProducts = products.slice(0, HOMEPAGE_LATEST_PRODUCT_LIMIT);
  const featuredExperts = [...experts].sort((a, b) =>
    Number(Boolean(b.specialty?.trim())) - Number(Boolean(a.specialty?.trim()))
  );
  return (
    <div className={styles.page} dir={getDirection(locale)} data-home-page>
      <a className="skip-link" href="#main-content">{c.skip}</a>
      
      <main id="main-content">
        {home.shortcuts.length > 0 && <nav className={styles.shortcuts} id="services" aria-label={c.service}>
          {home.shortcuts.map((item, index) => <a className={styles.shortcut} key={index} href={item.href}>
            <span className={styles.shortcutVisual}>{item.image ? <Image src={item.image} alt="" fill sizes="(max-width: 760px) 164px, (max-width: 1050px) 174px, (max-width: 1280px) 16vw, 204px" /> : <DesignIcon name={shortcutIcons[index % 3]} />}</span>
            <span className={styles.shortcutContent}><strong>{item.title}</strong><small>{item.description}</small></span>
            <span className={styles.shortcutArrow} aria-hidden="true"><DesignIcon name="arrow" /></span>
          </a>)}
        </nav>}

        {stories.length > 0 && <nav className={styles.storyShelf} aria-label={c.stories}>
          {stories.map((story) => <a className={styles.story} href={story.targetUrl} key={story.id}>
            <span className={styles.storyImage}><Image src={story.image.url} alt="" width={64} height={64} /></span>
            <span>{story.title}</span>
          </a>)}
        </nav>}

        <section className={`${styles.section} ${styles.solutionsSection}`} aria-labelledby="solutions-title">
          <div className={styles.sectionHeading}><div><p className={styles.sectionLabel}>{c.featured}</p><h1 id="solutions-title">{hasCollections ? home.collections.title : c.service}</h1>{hasCollections && <p>{home.collections.description}</p>}</div></div>
          <div className={styles.collections} data-count={solutionCards.length}>{solutionCards.map(({ item, action, key }, index) => <a className={styles.collection} href={item.href} key={key}>
            <div className={styles.collectionImage}>
              {item.image ? <Image src={item.image} alt="" fill priority={index === 0} sizes={index === 0 ? "(max-width: 760px) 100vw, 66vw" : "(max-width: 760px) 100vw, 33vw"} /> : <DesignIcon name="layers" />}
            </div>
            {item.label ? <span className={styles.imageLabel} dir="auto">{item.label}</span> : null}
            <div className={styles.collectionBody}><h2>{item.title}</h2><p>{item.description}</p><span className={styles.cardLink}>{action}<DesignIcon name="arrow" /></span></div>
          </a>)}</div>
        </section>

        {home.latest.enabled && <section className={`${styles.section} ${styles.latestSection}`} id="products" aria-labelledby="products-title" aria-description={home.latest.description}>
          <div className={styles.latestHeading}><h2 id="products-title">{home.latest.title}</h2><Link className={styles.textLink} href={shop as Route}>{c.more}<DesignIcon name="arrow" /></Link></div>
          {latestProducts.length ? <div className={styles.latestProducts} data-count={latestProducts.length}>
            {latestProducts.slice(0, 1).map((product) => {
              const thumbnail = productImage(product, "large");
              return <Link className={`${styles.product} ${styles.featuredProduct}`} key={product.id} href={`/${locale}/products/${product.slug || product.id}` as Route}>
                <span className={styles.productImage}>{thumbnail ? <Image src={thumbnail.url} alt="" fill sizes="(max-width: 760px) 130px, 260px" /> : <DesignIcon name={product.type === "digital" ? "file" : product.type === "physical" ? "layers" : "headphones"} />}</span>
                <div className={styles.productText}><span className={styles.productMeta}><span className={styles.productType}>{labels[product.type]}</span>{product.category && product.category !== labels[product.type] && <span className={styles.productCategory} dir="auto">{product.category}</span>}</span><h3 className={styles.productTitle} dir="auto">{product.title}</h3>{product.price !== undefined && <span className={styles.productPrice} dir="auto">{price(product, locale)}</span>}<span className={styles.productAction}>{c.details}<DesignIcon name="arrow" /></span></div>
              </Link>;
            })}
            {latestProducts.length > 1 && <div className={styles.latestSecondary}>{latestProducts.slice(1).map((product) => {
              const thumbnail = productImage(product, latestProducts.length <= 3 ? "large" : "thumb");
              return <Link className={styles.product} key={product.id} href={`/${locale}/products/${product.slug || product.id}` as Route}>
                <span className={styles.productImage}>{thumbnail ? <Image src={thumbnail.url} alt="" fill sizes="(max-width: 760px) 80px, (max-width: 1400px) 210px, 76px" /> : <DesignIcon name={product.type === "digital" ? "file" : product.type === "physical" ? "layers" : "headphones"} />}</span>
                <div className={styles.productText}><span className={styles.productMeta}><span className={styles.productType}>{labels[product.type]}</span>{product.category && product.category !== labels[product.type] && <span className={styles.productCategory} dir="auto">{product.category}</span>}</span><h3 className={styles.productTitle} dir="auto">{product.title}</h3><span className={styles.productPrice} dir="auto">{price(product, locale)}</span></div><DesignIcon name="arrow" />
              </Link>;
            })}</div>}
          </div> : <div className={styles.empty}><DesignIcon name="file" /><p>{productsUnavailable ? unavailableCopy[locale].products : c.emptyProducts}</p>{productsUnavailable ? <a href={`/${locale}`}>{unavailableCopy[locale].retry}<DesignIcon name="arrow" /></a> : <Link href={shop as Route}>{c.all}<DesignIcon name="arrow" /></Link>}</div>}
        </section>}

        {home.offers.enabled && home.offers.items.length > 0 && <OfferCarousel locale={locale} offers={home.offers} featuredLabel={c.featured} allLabel={c.all} detailsLabel={c.details} shopHref={shop} />}

        {home.experts.enabled && <section className={`${styles.section} ${styles.expertsSection}`} id="agents" aria-labelledby="experts-title">
          <div className={styles.expertsHeading}>
            <h2 id="experts-title">{homepageExpertsTitle(home.experts.title, locale)}</h2>
            <div className={styles.expertsIntro}>
              <p>{home.experts.description}</p>
              <Link className={styles.expertsSupport} href={`/${locale}/contact-us` as Route}>{c.contact}<DesignIcon name="arrow" /></Link>
            </div>
          </div>
          {experts.length ? <ExpertGrid experts={featuredExperts} locale={locale} /> : <div className={styles.empty}><DesignIcon name="headphones" /><p>{expertsUnavailable ? unavailableCopy[locale].experts : c.emptyExperts}</p>{expertsUnavailable ? <a href={`/${locale}`}>{unavailableCopy[locale].retry}<DesignIcon name="arrow" /></a> : <Link href={`/${locale}/contact-us` as Route}>{c.contact}<DesignIcon name="arrow" /></Link>}</div>}
        </section>}

        {home.about.enabled && <section className={styles.about} aria-labelledby="about-title">
          <div className={styles.aboutIntro}>
            <p className={styles.aboutEyebrow}><span translate="no" dir="ltr">TOP GSM</span><span>{partnershipEyebrow[locale]}</span></p>
            <h2 id="about-title">{home.about.title}</h2>
            <p className={styles.aboutDescription}>{home.about.description}</p>
            <ul className={styles.aboutServices}>{home.about.points.map((point, index) => <li key={index}>{point}</li>)}</ul>
            <div className={styles.aboutClosing}>
              <a className={styles.aboutLink} href={home.about.link.href}>{home.about.link.label}<DesignIcon name="arrow" /></a>
            </div>
          </div>
          <div className={styles.aboutArt} aria-hidden="true">
            <Image className={styles.aboutArtLight} src="/images/home/corporate-woodblock-light.webp" alt="" fill sizes="(max-width: 760px) 100vw, 42vw" />
            <Image className={styles.aboutArtDark} src="/images/home/corporate-woodblock-dark.webp" alt="" fill sizes="(max-width: 760px) 100vw, 42vw" />
          </div>
        </section>}

      </main>

      <PublicFooter locale={locale} content={home.footer} editable={editable} />
    </div>
  );
}
