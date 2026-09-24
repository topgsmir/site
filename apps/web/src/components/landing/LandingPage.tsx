import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";
import type { HomepageContent, HomepageStory, PublicExpertSummary, PublicProductSummary } from "@topgsm/shared-types";
import { DesignIcon, type DesignIconName } from "@/components/DesignIcon";
import { PublicHeader } from "@/components/PublicHeader";
import { getDirection, type Locale } from "@/lib/i18n";
import { currencyLabel, formatCurrencyAmount } from "@/lib/currency";
import { defaultHomepage } from "./homepage-defaults";
import { ExpertGrid } from "./ExpertGrid";
import styles from "./LandingPage.module.css";

export type HomepageProduct = PublicProductSummary;
export type HomepageExpert = PublicExpertSummary;

export type LandingPageProps = {
  locale: Locale;
  products: HomepageProduct[];
  experts: HomepageExpert[];
  stories: HomepageStory[];
  accountHref: string | null;
  content?: HomepageContent;
  editable?: boolean;
  productsUnavailable?: boolean;
  expertsUnavailable?: boolean;
};

const copy = {
  fa: { skip: "رفتن به محتوا", search: "جست‌وجوی محصولات", placeholder: "مدل گوشی، نام فایل یا سرویس موردنیاز…", find: "جست‌وجو", popular: "جست‌وجوهای پیشنهادی", all: "همه محصولات", explore: "مشاهده مجموعه", details: "مشاهده جزئیات", expert: "کارشناس تأییدشده", profile: "مشاهده پروفایل", active: "محصول فعال", emptyExperts: "پروفایل کارشناسان به‌زودی در این بخش نمایش داده می‌شود.", emptyProducts: "محصولات تازه پس از انتشار، اینجا نمایش داده می‌شوند.", contact: "ارتباط با پشتیبانی", digital: "فایل و آموزش", physical: "ابزار و تجهیزات", service: "خدمات آنلاین", featured: "منتخب تاپ جی‌اس‌ام", latest: "تازه منتشرشده", people: "متخصصان، کنار شما", links: "دسترسی سریع", stories: "دسترسی‌های ویژه", since: "برای حرفه‌ای‌های دنیای موبایل", edit: "ویرایش صفحه اصلی", more: "مشاهده فروشگاه" },
  en: { skip: "Skip to content", search: "Search products", placeholder: "Device model, file, or service…", find: "Search", popular: "Suggested searches", all: "All products", explore: "Explore collection", details: "View details", expert: "Verified expert", profile: "View profile", active: "active products", emptyExperts: "Expert profiles will appear here when available.", emptyProducts: "New products will appear here when published.", contact: "Contact support", digital: "Files & training", physical: "Tools & equipment", service: "Online services", featured: "THE TOP GSM EDIT", latest: "JUST ADDED", people: "EXPERTISE, WITH A HUMAN SIDE", links: "Quick access", stories: "Featured links", since: "FOR THE CRAFT OF REPAIR", edit: "Edit homepage", more: "Browse the shop" },
  ar: { skip: "انتقل إلى المحتوى", search: "البحث عن المنتجات", placeholder: "موديل الجهاز أو الملف أو الخدمة…", find: "بحث", popular: "عمليات بحث مقترحة", all: "جميع المنتجات", explore: "اكتشف المجموعة", details: "عرض التفاصيل", expert: "خبير معتمد", profile: "عرض الملف", active: "منتج نشط", emptyExperts: "ستظهر ملفات الخبراء هنا عند توفرها.", emptyProducts: "ستظهر المنتجات الجديدة هنا بعد نشرها.", contact: "تواصل مع الدعم", digital: "ملفات وتدريب", physical: "أدوات ومعدات", service: "خدمات عن بعد", featured: "مختارات Top GSM", latest: "أضيف حديثًا", people: "متخصصون بجانبك", links: "وصول سريع", stories: "روابط مميزة", since: "لمحترفي صيانة الجوال", edit: "تعديل الصفحة الرئيسية", more: "تصفح المتجر" }
} as const;
const shortcutIcons: DesignIconName[] = ["headphones", "file", "layers"];
const unavailableCopy = {
  fa: { products: "فهرست محصولات در حال حاضر در دسترس نیست. کمی بعد دوباره تلاش کنید.", experts: "فهرست کارشناسان در حال حاضر در دسترس نیست. کمی بعد دوباره تلاش کنید.", retry: "تلاش دوباره" },
  en: { products: "Products are temporarily unavailable. Please try again shortly.", experts: "Expert profiles are temporarily unavailable. Please try again shortly.", retry: "Try again" },
  ar: { products: "المنتجات غير متاحة مؤقتًا. يرجى المحاولة بعد قليل.", experts: "ملفات الخبراء غير متاحة مؤقتًا. يرجى المحاولة بعد قليل.", retry: "حاول مجددًا" }
} as const;

function productImage(product: HomepageProduct) { return product.image?.variants.find((variant) => variant.name === "thumb") ?? product.image?.variants[0]; }
function price(product: HomepageProduct, locale: Locale) {
  if (product.price === undefined || !product.currency) return copy[locale].details;
  return `${formatCurrencyAmount(product.price, product.currency, locale)} ${currencyLabel(product.currency)}`;
}
function productDate(value: string, locale: Locale) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat(locale === "fa" ? "fa-IR" : locale, { month: "short", day: "numeric" }).format(date);
}

export function LandingPage({ locale, products, experts, stories, accountHref, content, editable = false, productsUnavailable = false, expertsUnavailable = false }: LandingPageProps) {
  const c = copy[locale];
  const home = content ?? defaultHomepage(locale);
  const shop = `/${locale}/products`;
  const labels = { digital: c.digital, physical: c.physical, service: c.service, bridge: c.service };
  return (
    <div className={styles.page} dir={getDirection(locale)}>
      <a className="skip-link" href="#main-content">{c.skip}</a>
      <PublicHeader locale={locale} accountHref={accountHref} />
      <main id="main-content">
        {stories.length > 0 && <nav className={styles.storyShelf} aria-label={c.stories}>
          {stories.map((story) => <a className={styles.story} href={story.targetUrl} key={story.id}>
            <span className={styles.storyImage}><Image src={story.image.url} alt="" width={64} height={64} /></span>
            <span>{story.title}</span>
          </a>)}
        </nav>}

        <section className={styles.hero} aria-labelledby="hero-title">
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}><span />{home.hero.eyebrow}</p>
            <h1 id="hero-title">{home.hero.title}<span>{home.hero.accent}</span></h1>
            <p className={styles.heroBody}>{home.hero.description}</p>
            <div className={styles.heroActions}>
              <a className={styles.primary} href={home.hero.primary.href}>{home.hero.primary.label}<DesignIcon name="arrow" /></a>
              <a className={styles.secondary} href={home.hero.secondary.href}>{home.hero.secondary.label}<DesignIcon name="headphones" /></a>
            </div>
            <div className={styles.heroSignature}><span translate="no">TOP GSM</span><span>{c.since}</span></div>
          </div>
          <figure className={styles.heroVisual}>
            <Image src={home.hero.image} alt={home.hero.imageAlt} fill sizes="(max-width: 760px) 100vw, 55vw" priority />
            <figcaption><DesignIcon name="layers" /><span>{home.hero.eyebrow}</span></figcaption>
          </figure>
        </section>

        <div className={styles.discovery}>
          <form className={styles.searchForm} action={shop} role="search" aria-label={c.search}>
            <DesignIcon name="search" />
            <label className="sr-only" htmlFor="home-search">{c.search}</label>
            <input id="home-search" name="search" type="search" maxLength={100} placeholder={c.placeholder} />
            <button type="submit">{c.find}<DesignIcon name="arrow" /></button>
          </form>
          <nav className={styles.searchSuggestions} aria-label={c.popular}>
            {["Samsung", "Xiaomi", "iPhone", "FRP", "Oxygen"].map((term) => <Link key={term} href={`${shop}?search=${term}` as Route}>{term}</Link>)}
          </nav>
        </div>

        {home.shortcuts.length > 0 && <nav className={styles.shortcuts} id="services" aria-label={c.service}>
          {home.shortcuts.map((item, index) => <a className={styles.shortcut} key={index} href={item.href}>
            <span className={styles.shortcutIcon}>{item.image ? <Image src={item.image} alt="" width={44} height={44} /> : <DesignIcon name={shortcutIcons[index % 3]} />}</span>
            <span><strong>{item.title}</strong><small>{item.description}</small></span><DesignIcon name="arrow" />
          </a>)}
        </nav>}

        {home.collections.enabled && home.collections.items.length > 0 && <section className={styles.section} aria-labelledby="collections-title">
          <div className={styles.sectionHeading}><div><p className={styles.sectionLabel}>{c.service}</p><h2 id="collections-title">{home.collections.title}</h2><p>{home.collections.description}</p></div></div>
          <div className={styles.collections}>{home.collections.items.map((item, index) => <a className={styles.collection} href={item.href} key={index}>
            <div className={styles.collectionImage}>{item.image ? <Image src={item.image} alt="" fill sizes="(max-width: 640px) 100vw, 33vw" /> : <DesignIcon name="layers" />}<span className={styles.imageLabel} dir="auto">{item.label}</span></div>
            <div className={styles.collectionBody}><h3>{item.title}</h3><p>{item.description}</p><span className={styles.cardLink}>{c.explore}<DesignIcon name="arrow" /></span></div>
          </a>)}</div>
        </section>}

        {home.offers.enabled && home.offers.items.length > 0 && <section className={styles.offerSection} id="offers" aria-labelledby="offers-title">
          <div className={styles.sectionHeading}><div><p className={styles.sectionLabel}><DesignIcon name="spark" />{c.featured}</p><h2 id="offers-title">{home.offers.title}</h2><p>{home.offers.description}</p></div><Link className={styles.textLink} href={shop as Route}>{c.all}<DesignIcon name="arrow" /></Link></div>
          <div className={styles.offers}>{home.offers.items.map((item, index) => <a href={item.href} className={styles.offer} key={index}>
            <div className={styles.offerArtwork} data-variant={index % 4}>{item.image ? <Image src={item.image} alt="" fill sizes="(max-width: 640px) 70vw, 25vw" /> : <><span className={styles.toolMark}><DesignIcon name={shortcutIcons[index % 3]} /></span><strong dir="auto">{item.label || item.title}</strong><span className={styles.toolCaption} translate="no">TOP GSM / SELECTED TOOLS</span></>}</div>
            <div className={styles.offerBody}><h3 dir="auto">{item.title}</h3><p>{item.description}</p><span className={styles.cardLink}>{c.details}<DesignIcon name="arrow" /></span></div>
          </a>)}</div>
        </section>}

        {home.experts.enabled && <section className={`${styles.section} ${styles.expertsSection}`} id="agents" aria-labelledby="experts-title">
          <div className={styles.expertsHeading}>
            <h2 id="experts-title">{home.experts.title}</h2>
            <div className={styles.expertsIntro}>
              <p>{home.experts.description}</p>
              <Link className={styles.expertsSupport} href={`/${locale}/contact-us` as Route}>{c.contact}<DesignIcon name="arrow" /></Link>
            </div>
          </div>
          {experts.length ? <ExpertGrid experts={experts} locale={locale} /> : <div className={styles.empty}><DesignIcon name="headphones" /><p>{expertsUnavailable ? unavailableCopy[locale].experts : c.emptyExperts}</p>{expertsUnavailable ? <a href={`/${locale}`}>{unavailableCopy[locale].retry}<DesignIcon name="arrow" /></a> : <Link href={`/${locale}/contact-us` as Route}>{c.contact}<DesignIcon name="arrow" /></Link>}</div>}
        </section>}

        {home.about.enabled && <section className={styles.about} aria-labelledby="about-title">
          <div className={styles.aboutIntro}>
            <p className={styles.aboutEyebrow}><span translate="no" dir="ltr">TOP GSM</span><span>{locale === "fa" ? "همراه شما" : locale === "ar" ? "بجانبك" : "BY YOUR SIDE"}</span></p>
            <h2 id="about-title">{home.about.title}</h2>
            <p className={styles.aboutDescription}>{home.about.description}</p>
            <div className={styles.aboutClosing}>
              <a className={styles.aboutLink} href={home.about.link.href}>{home.about.link.label}<DesignIcon name="arrow" /></a>
              <span className={styles.aboutMonogram} translate="no" dir="ltr" aria-hidden="true">Top<span>GSM</span></span>
            </div>
          </div>
          <ol className={styles.aboutPoints} role="list">{home.about.points.map((point, index) => <li key={index}>
            <span className={styles.pointNumber} aria-hidden="true">{new Intl.NumberFormat(locale, { minimumIntegerDigits: 2 }).format(index + 1)}</span>
            <p>{point}</p>
          </li>)}</ol>
        </section>}

        {home.latest.enabled && <section className={styles.section} id="products" aria-labelledby="products-title">
          <div className={styles.sectionHeading}><div><p className={styles.sectionLabel}>{c.latest}</p><h2 id="products-title">{home.latest.title}</h2><p>{home.latest.description}</p></div><Link className={styles.textLink} href={shop as Route}>{c.more}<DesignIcon name="arrow" /></Link></div>
          {products.length ? <div className={styles.latestProducts}>{products.slice(0, 8).map((product) => {
            const thumbnail = productImage(product);
            return <Link className={styles.product} key={product.id} href={`/${locale}/products/${product.slug || product.id}` as Route}>
              <div className={styles.productImage}>{thumbnail ? <Image src={thumbnail.url} alt="" width={76} height={76} /> : <DesignIcon name={product.type === "digital" ? "file" : product.type === "physical" ? "layers" : "headphones"} />}</div>
              <div className={styles.productText}><div><span>{product.category || labels[product.type]}</span><time dateTime={product.createdAt}>{productDate(product.createdAt, locale)}</time></div><h3>{product.title}</h3><p>{price(product, locale)}</p></div><DesignIcon name="arrow" />
            </Link>;
          })}</div> : <div className={styles.empty}><DesignIcon name="file" /><p>{productsUnavailable ? unavailableCopy[locale].products : c.emptyProducts}</p>{productsUnavailable ? <a href={`/${locale}`}>{unavailableCopy[locale].retry}<DesignIcon name="arrow" /></a> : <Link href={shop as Route}>{c.all}<DesignIcon name="arrow" /></Link>}</div>}
        </section>}
      </main>

      <footer className={styles.footer}><div className={styles.footerMain}><div className={styles.footerIdentity}><Link href={`/${locale}` as Route} className={styles.footerBrand} translate="no">topgsm<span>.</span></Link><p>{home.footer.description}</p></div><nav aria-label={c.links}>{home.footer.links.map((link, index) => <a key={index} href={link.href}>{link.label}</a>)}</nav></div><div className={styles.footerBottom}><span>© {new Date().getFullYear()} Top GSM</span><span>{c.since}</span>{editable && <Link href={`/${locale}/admin/settings/homepage` as Route}>{c.edit}<DesignIcon name="arrow" /></Link>}</div></footer>
    </div>
  );
}
