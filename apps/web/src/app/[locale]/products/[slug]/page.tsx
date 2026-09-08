import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BridgeCheckout } from "@/components/bridge/BridgeCheckout";
import { getCurrentUser } from "@/lib/auth/server";
import { getDictionary, isLocale, locales, type Locale } from "@/lib/i18n";
import { ProductPage } from "./ProductPage";
import { getPublicProduct, type PublicProduct } from "./product.server";

type ProductRouteProps = {
  params: Promise<{ locale: string; slug: string }>;
};

const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.NODE_ENV === "development" ? "http://localhost:3000" : "https://top-gsm.ir")
).replace(/\/+$/, "");

const openGraphLocales: Record<Locale, string> = {
  fa: "fa_IR",
  en: "en_US",
  ar: "ar_SA"
};

function absoluteProductUrl(locale: Locale, slug: string) {
  return `${SITE_URL}/${locale}/products/${encodeURIComponent(slug)}`;
}

function compactDescription(product: PublicProduct, locale: Locale) {
  const copy = getDictionary(locale).product;
  const source = product.description?.replace(/\s+/g, " ").trim();
  if (source) {
    return source.length > 158 ? `${source.slice(0, 155).trimEnd()}…` : source;
  }
  const type = product.type === "bridge" ? "Bridge" : copy[product.type];
  return `${product.title} — ${type} ${product.category ? `· ${product.category}` : ""} | Top GSM`.replace(/\s+/g, " ");
}

export async function generateMetadata({ params }: ProductRouteProps): Promise<Metadata> {
  const { locale: localeParam, slug } = await params;
  if (!isLocale(localeParam)) return {};

  const product = await getPublicProduct(slug);
  if (!product) {
    return {
      title: getDictionary(localeParam).product.notFoundTitle,
      robots: { index: false, follow: false }
    };
  }

  const description = compactDescription(product, localeParam);
  const canonical = absoluteProductUrl(localeParam, product.slug);
  const languages = Object.fromEntries([
    ...locales.map((locale) => [locale, absoluteProductUrl(locale, product.slug)]),
    ["x-default", absoluteProductUrl("fa", product.slug)]
  ]);

  return {
    title: product.title,
    description,
    keywords: [product.title, product.category, product.type === "bridge" ? "Bridge" : getDictionary(localeParam).product[product.type], "Top GSM"].filter(
      (value): value is string => Boolean(value)
    ),
    alternates: { canonical, languages },
    openGraph: {
      type: "website",
      url: canonical,
      siteName: "Top GSM",
      title: product.title,
      description,
      locale: openGraphLocales[localeParam],
      alternateLocale: locales.filter((locale) => locale !== localeParam).map((locale) => openGraphLocales[locale])
    },
    twitter: {
      card: "summary_large_image",
      title: product.title,
      description
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1
      }
    }
  };
}

function productJsonLd(product: PublicProduct, locale: Locale) {
  const url = absoluteProductUrl(locale, product.slug);
  const description = compactDescription(product, locale);
  const offers = product.variants.flatMap((variant) =>
    variant.offers.map((offer) => ({
      "@type": "Offer",
      url,
      price: offer.price,
      priceCurrency: offer.currency,
      availability: `https://schema.org/${offer.physical?.inStock === false ? "OutOfStock" : "InStock"}`,
      seller: {
        "@type": "Organization",
        name: offer.seller.shopName
      }
    }))
  );

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Product",
        "@id": `${url}#product`,
        name: product.title,
        description,
        sku: product.id,
        category: product.category ?? (product.type === "bridge" ? "Bridge" : getDictionary(locale).product[product.type]),
        url,
        offers
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${url}#breadcrumb`,
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: getDictionary(locale).product.home,
            item: `${SITE_URL}/${locale}`
          },
          {
            "@type": "ListItem",
            position: 2,
            name: product.title,
            item: url
          }
        ]
      },
      {
        "@type": "WebPage",
        "@id": `${url}#webpage`,
        url,
        name: product.title,
        description,
        inLanguage: locale,
        breadcrumb: { "@id": `${url}#breadcrumb` },
        mainEntity: { "@id": `${url}#product` },
        datePublished: product.createdAt,
        dateModified: product.updatedAt
      }
    ]
  };
}

export default async function ProductRoute({ params }: ProductRouteProps) {
  const { locale: localeParam, slug } = await params;
  if (!isLocale(localeParam)) notFound();

  const product = await getPublicProduct(slug);
  if (!product) notFound();

  const jsonLd = productJsonLd(product, localeParam);
  if (product.type === "bridge") {
    const user = await getCurrentUser();
    return (
      <>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
        />
        <BridgeCheckout locale={localeParam} product={product} signedInBuyer={user?.role === "buyer"} />
      </>
    );
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c")
        }}
      />
      <ProductPage product={product} locale={localeParam} copy={getDictionary(localeParam).product} />
    </>
  );
}
