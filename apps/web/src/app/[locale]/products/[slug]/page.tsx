import type { Metadata } from "next";
import type { Route } from "next";
import { cookies } from "next/headers";
import { notFound, permanentRedirect } from "next/navigation";
import { BridgeCheckout } from "@/components/bridge/BridgeCheckout";
import { SERVER_API_BASE } from "@/lib/api/server";
import { dashboardFor, getCurrentUser } from "@/lib/auth/server";
import { getDictionary, isLocale, type Locale } from "@/lib/i18n";
import { ProductPage } from "./ProductPage";
import { getPublicProduct, type PublicProduct } from "./product.server";
import { productPageCopy } from "./product-copy";
import { schemaPrice } from "@/lib/product-seo";

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

function canonicalProductUrl(slug: string, locale: Locale = "fa") {
  return `${SITE_URL}/${locale}/products/${encodeURIComponent(slug)}`;
}

function compactDescription(product: PublicProduct, locale: Locale) {
  const copy = getDictionary(locale).product;
  const source = product.description?.replace(/\s+/g, " ").trim();
  if (source) {
    return source.length > 158 ? `${source.slice(0, 155).trimEnd()}…` : source;
  }
  const type = product.type === "bridge" ? productPageCopy[locale].bridge : copy[product.type];
  return `${product.title} — ${type} ${product.category ? `· ${product.category}` : ""} | Top GSM`.replace(/\s+/g, " ");
}

export async function generateMetadata({ params }: ProductRouteProps): Promise<Metadata> {
  const { locale: localeParam, slug } = await params;
  if (!isLocale(localeParam)) return {};

  const product = await loadProduct(slug, localeParam);
  if (!product) {
    return {
      title: getDictionary(localeParam).product.notFoundTitle,
      robots: { index: false, follow: false }
    };
  }

  const description = compactDescription(product, localeParam);
  const canonical = canonicalProductUrl(product.slug, product.contentLocale);
  const indexable = product.availableLocales.includes(localeParam);
  const image = product.image?.variants.find((variant) => variant.name === "large") ?? product.image?.variants[0];
  const images = image ? [{ url: new URL(image.url, SITE_URL).href, width: image.width, height: image.height, alt: product.title }] : undefined;

  return {
    title: product.title,
    description,
    keywords: [
      product.title,
      product.category,
      product.type === "bridge" ? productPageCopy[localeParam].bridge : getDictionary(localeParam).product[product.type],
      "Top GSM"
    ].filter((value): value is string => Boolean(value)),
    alternates: { canonical, ...(indexable ? { languages: Object.fromEntries([...product.availableLocales.map((code) => [code, canonicalProductUrl(product.slug, code)]), ["x-default", canonicalProductUrl(product.slug)]]) } : {}) },
    openGraph: {
      type: "website",
      url: canonical,
      siteName: "Top GSM",
      title: product.title,
      description,
      locale: openGraphLocales[product.contentLocale],
      ...(images ? { images } : {})
    },
    twitter: {
      card: images ? "summary_large_image" : "summary",
      title: product.title,
      description,
      ...(images ? { images } : {})
    },
    robots: {
      index: indexable,
      follow: true,
      googleBot: {
        index: indexable,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1
      }
    }
  };
}

function productJsonLd(product: PublicProduct, locale: Locale) {
  const url = canonicalProductUrl(product.slug, product.contentLocale);
  const description = compactDescription(product, locale);
  const offers = product.variants.flatMap((variant) =>
    variant.offers.map((offer) => ({
      "@type": "Offer",
      url,
      ...schemaPrice(offer.price, offer.currency),
      availability: `https://schema.org/${offer.physical?.inStock === false ? "OutOfStock" : "InStock"}`,
      ...(product.type === "digital" ? { availableDeliveryMethod: "http://purl.org/goodrelations/v1#DeliveryModeDirectDownload" } : {}),
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
        "@type": product.type === "service" || product.type === "bridge" ? "Service" : "Product",
        "@id": `${url}#product`,
        name: product.title,
        description,
        ...(product.type === "service" || product.type === "bridge" ? {} : { sku: product.id }),
        category: product.category ?? (product.type === "bridge" ? productPageCopy[locale].bridge : getDictionary(locale).product[product.type]),
        ...(product.image?.variants.length ? { image: product.image.variants.map((image) => new URL(image.url, SITE_URL).href) } : {}),
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
            name: productPageCopy[locale].catalog,
            item: `${SITE_URL}/${locale}/products?type=${product.type}`
          },
          {
            "@type": "ListItem",
            position: 3,
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
        inLanguage: product.contentLocale,
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

  const product = await loadProduct(slug, localeParam);
  if (!product) notFound();

  const user = await getCurrentUser();
  const accountHref = user ? dashboardFor(user, localeParam) : null;
  const sellerCanEdit = (user?.role === "seller-admin" || user?.role === "seller-staff") && user.permissions?.includes("products_manage")
    ? await canSellerEditProduct(product.id, product.slug)
    : false;
  const editHref = user?.role === "platform-admin"
    ? (`/${localeParam}/admin/products/${product.id}` as Route)
    : sellerCanEdit
      ? (`/${localeParam}/seller-dashboard?section=products&editProduct=${encodeURIComponent(product.id)}&productTitle=${encodeURIComponent(product.title)}` as Route)
      : undefined;
  const jsonLd = productJsonLd(product, localeParam);
  if (product.type === "bridge") {
    return (
      <>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
        />
        <ProductPage key={product.id} product={product} locale={localeParam} copy={getDictionary(localeParam).product} editHref={editHref} accountHref={accountHref}
          bridgeCheckout={<BridgeCheckout locale={localeParam} product={product} signedInBuyer={user?.role === "buyer"} embedded />} />
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
      <ProductPage key={product.id} product={product} locale={localeParam} copy={getDictionary(localeParam).product} editHref={editHref} accountHref={accountHref} />
    </>
  );
}

async function canSellerEditProduct(productId: string, productSlug: string) {
  const cookieHeader = (await cookies()).toString();
  if (!cookieHeader) return false;
  try {
    const response = await fetch(`${SERVER_API_BASE}/products/mine?limit=20&search=${encodeURIComponent(productSlug)}`, {
      headers: { accept: "application/json", cookie: cookieHeader },
      cache: "no-store"
    });
    if (!response.ok) return false;
    const payload = await response.json() as {
      items?: Array<{ product?: { id?: string; canEdit?: boolean } }>;
    };
    return payload.items?.some((item) => item.product?.id === productId && item.product.canEdit === true) ?? false;
  } catch {
    return false;
  }
}

async function loadProduct(slug: string, locale: Locale) {
  const product = await getPublicProduct(slug, locale);
  if (!product) return null;
  let decoded: string;
  try { decoded = decodeURIComponent(slug); } catch { notFound(); }
  if (decoded !== product.slug) permanentRedirect(("/" + locale + "/products/" + encodeURIComponent(product.slug)) as Route);
  return product;
}
