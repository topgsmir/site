import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { getProduct, isApiNotFound } from "@/lib/public-data";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://top-gsm.ir";

async function load(slug: string) {
  try { return await getProduct(slug); }
  catch (error) { if (isApiNotFound(error)) notFound(); throw error; }
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const product = await load(slug);
  const canonical = `${SITE_URL}/fa/products/${product.slug}`;
  const description = product.description?.slice(0, 160) ?? `${product.title} on Top GSM`;
  return {
    title: product.title,
    description,
    alternates: { canonical },
    robots: locale === "fa" ? { index: true, follow: true } : { index: false, follow: true },
    openGraph: { type: "website", url: canonical, title: product.title, description },
    twitter: { card: "summary", title: product.title, description }
  };
}

export default async function ProductPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const product = await load(slug);
  const offers = product.variants.flatMap((variant) => variant.offers.map((offer) => ({ ...offer, variantName: variant.name })));
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: product.description ?? undefined,
    category: product.category ?? undefined,
    url: `${SITE_URL}/fa/products/${product.slug}`,
    offers: offers.map((offer) => ({
      "@type": "Offer",
      price: offer.price,
      priceCurrency: offer.currency,
      availability: offer.physical?.inStock === false ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",
      seller: { "@type": "Organization", name: offer.seller.shopName }
    }))
  };
  const copy = locale === "fa"
    ? { back: "بازگشت به فروشگاه", eyebrow: "کاتالوگ تاپ جی‌اس‌ام", offers: "پیشنهادهای فروش", noOffers: "در حال حاضر پیشنهاد فعالی برای این محصول وجود ندارد.", buy: "انتخاب پیشنهاد", variant: "مدل" }
    : locale === "ar"
      ? { back: "العودة إلى المتجر", eyebrow: "كتالوج Top GSM", offers: "عروض البيع", noOffers: "لا توجد عروض نشطة لهذا المنتج حالياً.", buy: "اختيار العرض", variant: "الطراز" }
      : { back: "Back to marketplace", eyebrow: "Top GSM catalog", offers: "Seller offers", noOffers: "There are no active offers for this product yet.", buy: "Choose offer", variant: "Variant" };
  return (
    <div className="product-document">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <header className="product-nav"><Link href={`/${locale}`}>TOP GSM</Link><Link href={`/${locale}`}>← {copy.back}</Link></header>
      <main>
        <header className="product-heading">
          <p>{copy.eyebrow} / {product.type}</p>
          <h1>{product.title}</h1>
          {product.description ? <p>{product.description}</p> : null}
          <dl><div><dt>{copy.variant}</dt><dd>{product.kind}</dd></div>{product.category ? <div><dt>Category</dt><dd>{product.category}</dd></div> : null}</dl>
        </header>
        <section className="product-offers" aria-labelledby="offers-title">
          <header><span>{String(offers.length).padStart(2, "0")}</span><h2 id="offers-title">{copy.offers}</h2></header>
          {offers.length ? <div>{offers.map((offer) => (
            <article key={offer.id}>
              <p>{offer.variantName ?? product.title}</p>
              <h3>{offer.seller.shopName}</h3>
              <strong>{offer.price} {offer.currency}</strong>
              <Link className="product-shop-link" href={`/${locale}#products`}>{copy.buy}</Link>
            </article>
          ))}</div> : <p className="product-empty">{copy.noOffers}</p>}
        </section>
      </main>
    </div>
  );
}
