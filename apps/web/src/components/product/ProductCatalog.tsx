import Link from "next/link";
import Image from "next/image";
import type { Route } from "next";
import type { PublicProductSummary } from "@topgsm/shared-types";
import type { Locale } from "@/lib/i18n";
import { currencyLabel, formatCurrencyAmount } from "@/lib/currency";
import { DesignIcon } from "@/components/DesignIcon";
import { HeaderLanguageLinks } from "@/components/SiteHeader";
import { ListingPagination } from "@/components/ListingPagination";
import { listingHref, catalogCopy } from "@/lib/seo";
import styles from "./ProductCatalog.module.css";

const copy = {
  fa: { title: "برای قدم بعدی تعمیر.", intro: "فایل‌ها، ابزارها و خدماتی که کارتان را جلو می‌برند.", all: "همه محصولات", digital: "فایل و آموزش", physical: "محصولات فیزیکی", service: "خدمات", bridge: "خرید واسطه‌ای", empty: "محصولی پیدا نشد.", emptyHint: "عبارت دیگری بنویسید یا همه محصولات را ببینید.", reset: "نمایش همه محصولات", details: "مشاهده جزئیات", from: "از", error: "محصولات بارگذاری نشدند.", loading: "در حال جست‌وجو…", more: "نمایش محصولات بیشتر", retry: "تلاش دوباره" },
  en: { title: "For your next repair.", intro: "The files, tools, and services that move your work forward.", all: "All products", digital: "Files & training", physical: "Repair tools", service: "Services", bridge: "Assisted purchases", empty: "No products found.", emptyHint: "Try another search or explore all products.", reset: "Show all products", details: "View details", from: "From", error: "Products could not be loaded.", loading: "Searching…", more: "Load more products", retry: "Try again" },
  ar: { title: "لخطوتك التالية في الصيانة.", intro: "الملفات والأدوات والخدمات التي تساعدك على التقدم.", all: "جميع المنتجات", digital: "ملفات وتدريب", physical: "أدوات الصيانة", service: "الخدمات", bridge: "شراء بالوساطة", empty: "لم نجد منتجات.", emptyHint: "جرب بحثًا آخر أو تصفح جميع المنتجات.", reset: "عرض جميع المنتجات", details: "عرض التفاصيل", from: "من", error: "تعذر تحميل المنتجات.", loading: "جارٍ البحث…", more: "عرض المزيد من المنتجات", retry: "حاول مجددًا" }
};

export function ProductCatalog({ locale, products, initialQuery: query, initialType: type, cursor, nextCursor, categoryId }: { locale: Locale; products: PublicProductSummary[]; initialQuery: string; initialType: string; cursor?: string; nextCursor: string | null; categoryId?: string }) {
  const c = copy[locale];
  const categoryCopy = { fa: { selected: "فیلتر دسته‌بندی فعال", clear: "حذف فیلتر دسته‌بندی" }, en: { selected: "Category filter active", clear: "Clear category filter" }, ar: { selected: "فلتر الفئة مفعّل", clear: "إزالة فلتر الفئة" } }[locale];
  const visible = products;
  const path = "/" + locale + "/products";
  const heading = catalogCopy[locale][type as "all" | "digital" | "physical" | "service" | "bridge"];
  return <main className={styles.main} id="catalog-content">
    <HeaderLanguageLinks hrefs={{ fa: listingHref("/fa/products", { type, search: query, categoryId }), en: listingHref("/en/products", { type, search: query, categoryId }), ar: listingHref("/ar/products", { type, search: query, categoryId }) }} />
    <header className={styles.intro}>
      <h1>{query ? catalogCopy[locale].search : heading}</h1>
      <p className={styles.introLead}>{c.intro}</p>
    </header>
    <div className={styles.toolbar}>
      <nav className={styles.filters} aria-label={c.all}>{(["all", "digital", "physical", "service", "bridge"] as const).map((filter) => <Link key={filter} aria-current={type === filter ? "page" : undefined} href={listingHref(path, { type: filter, search: query, categoryId }) as Route}>{c[filter]}</Link>)}</nav>
    </div>
    {categoryId && <div className={styles.activeCategory}><span>{categoryCopy.selected}</span><Link href={listingHref(path, { type, search: query }) as Route}>{categoryCopy.clear}</Link></div>}
    {visible.length ? <><div className={styles.grid}>{visible.map((product) => {
      const starting = product.startingPrices[0];
      const image = product.image?.variants.find((item) => item.name === "thumb") ?? product.image?.variants[0];
      return <Link className={styles.card} key={product.id} href={`/${locale}/products/${product.slug}` as Route} data-type={product.type}>
        <div className={styles.artwork} data-type={product.type}>{image ? <Image unoptimized src={image.url} alt={product.title} width={image.width} height={image.height} /> : <><DesignIcon name={product.type === "digital" ? "file" : product.type === "service" ? "headphones" : "layers"} /><span>{c[product.type]}</span></>}</div>
        <div className={styles.content}>
          <p className={styles.meta}>{product.category ?? c[product.type]}</p>
          <h2>{product.title}</h2>
          <div className={styles.priceRow}>
            <span className={styles.price}>{starting ? `${c.from} ${formatCurrencyAmount(starting.price, starting.currency, locale)} ${currencyLabel(starting.currency)}` : c.details}</span>
            <DesignIcon name="arrow" />
          </div>
        </div>
      </Link>;
    })}</div></> : <div className={styles.empty}><DesignIcon name="search" /><h2>{c.empty}</h2><p>{c.emptyHint}</p>{query || type !== "all" || categoryId ? <Link href={path as Route}>{c.reset}</Link> : null}</div>}
    <ListingPagination locale={locale} firstHref={cursor ? listingHref(path, { type, search: query, categoryId }) : undefined} nextHref={nextCursor ? listingHref(path, { type, search: query, categoryId, cursor: nextCursor }) : undefined} />
  </main>;
}
