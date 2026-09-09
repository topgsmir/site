import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  LandingPage,
  type HomepageAgent,
  type HomepageProduct
} from "@/components/landing/LandingPage";
import { SERVER_API_BASE } from "@/lib/api/server";
import { dashboardFor, getCurrentUser } from "@/lib/auth/server";
import { isLocale, localizePath } from "@/lib/i18n";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://top-gsm.ir";

const metadataByLocale = {
  fa: {
    title: "فایل، آموزش و خدمات تخصصی تعمیرات موبایل",
    description: "مرجع تخصصی تعمیرکاران موبایل برای دانلود فایل، آموزش تعمیرات، خدمات آنلاین، حذف FRP، آنلاک شبکه و فعال‌سازی ابزار و باکس.",
    keywords: ["تعمیرات موبایل", "فایل تعمیرات موبایل", "آموزش تعمیرات موبایل", "حذف FRP", "آنلاک شبکه", "تاپ جی اس ام"]
  },
  en: {
    title: "Mobile Repair Files, Training and Expert Services",
    description: "Find verified mobile repair files, practical training, remote services, unlock support, and professional tool activation.",
    keywords: ["mobile repair", "repair files", "phone repair training", "FRP removal", "network unlock", "Top GSM"]
  },
  ar: {
    title: "ملفات وتدريب وخدمات صيانة الجوال",
    description: "مرجع متخصص لملفات صيانة الجوال والتدريب والخدمات عن بعد وفتح الشبكة وتفعيل أدوات الصيانة.",
    keywords: ["صيانة الجوال", "ملفات صيانة", "تدريب صيانة الجوال", "إزالة FRP", "فتح الشبكة", "Top GSM"]
  }
} as const;

type HomePageProps = { params: Promise<{ locale: string }> };

async function fetchCollection<T>(path: string): Promise<T[]> {
  try {
    const response = await fetch(`${SERVER_API_BASE}${path}`, { next: { revalidate: 60 } });
    if (!response.ok) return [];
    const value: unknown = await response.json();
    return Array.isArray(value) ? (value as T[]) : [];
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: HomePageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const locale = isLocale(resolvedParams.locale) ? resolvedParams.locale : "fa";
  const localized = metadataByLocale[locale];
  const canonical = new URL(localizePath(locale), siteUrl);

  return {
    metadataBase: new URL(siteUrl),
    title: localized.title,
    description: localized.description,
    keywords: [...localized.keywords],
    alternates: {
      canonical,
      languages: {
        fa: new URL(localizePath("fa"), siteUrl).toString(),
        en: new URL(localizePath("en"), siteUrl).toString(),
        ar: new URL(localizePath("ar"), siteUrl).toString(),
        "x-default": new URL(localizePath("fa"), siteUrl).toString()
      }
    },
    openGraph: {
      type: "website",
      url: canonical,
      siteName: "Top GSM",
      title: localized.title,
      description: localized.description,
      locale
    },
    twitter: { card: "summary", title: localized.title, description: localized.description },
    robots: { index: true, follow: true }
  };
}

export default async function HomePage({ params }: HomePageProps) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const [products, agents, user] = await Promise.all([
    fetchCollection<HomepageProduct>("/products"),
    fetchCollection<HomepageAgent>("/seller/agents"),
    getCurrentUser()
  ]);

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${siteUrl}/#organization`,
        name: "Top GSM",
        url: siteUrl,
        logo: `${siteUrl}/brand/topgsm-logo.jpg`
      },
      {
        "@type": "WebSite",
        "@id": `${siteUrl}/#website`,
        name: "Top GSM",
        url: siteUrl,
        inLanguage: locale,
        publisher: { "@id": `${siteUrl}/#organization` }
      },
      {
        "@type": "ItemList",
        name: metadataByLocale[locale].title,
        itemListElement: products.slice(0, 8).map((product, index) => ({
          "@type": "ListItem",
          position: index + 1,
          url: `${siteUrl}/${locale}/products/${product.slug ?? product.id}`,
          name: product.title
        }))
      }
    ]
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
      <LandingPage
        locale={locale}
        products={products}
        agents={agents}
        accountHref={user ? dashboardFor(user, locale) : null}
      />
    </>
  );
}
