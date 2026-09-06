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

const fallbackProducts: HomepageProduct[] = [
  { id: "iphone-x-battery", slug: "iphone-x-battery-connector-resistance", title: "مقادیر مقاومت کانکتور باتری iPhone X", type: "digital", category: "مقادیر مقاومت", price: 89000, currency: "IRR" },
  { id: "xiaomi-mi-10s", slug: "xiaomi-mi-10s-china-to-global", title: "فایل کانورت چین به گلوبال Xiaomi Mi 10S", type: "digital", category: "فایل فلش", price: 149000, currency: "IRR" },
  { id: "infinix-hot-20i", slug: "infinix-hot-20i-light-ways", title: "مسیر بک‌لایت Infinix Hot 20i X665C", type: "digital", category: "مسیر برد", price: 59000, currency: "IRR" },
  { id: "infinix-hot-40", slug: "infinix-hot-40-pro-light-ways", title: "مسیر نور صفحه Infinix Hot 40 Pro X6837", type: "digital", category: "مسیر برد", price: 59000, currency: "IRR" },
  { id: "cypher-c20-frp", slug: "cypher-c20-frp-removal", title: "آموزش حذف FRP گوشی Cypher C20", type: "digital", category: "آموزش FRP", price: 119000, currency: "IRR" },
  { id: "samsung-unlock", slug: "samsung-network-unlock", title: "آنلاک شبکه سامسونگ سریع و آنلاین", type: "service", category: "خدمات سامسونگ", price: 490000, currency: "IRR" },
  { id: "oxygen", slug: "oxygen-forensic-detective", title: "فعال‌سازی Oxygen Forensic Detective", type: "service", category: "لایسنس نرم‌افزار", price: 1890000, currency: "IRR" },
  { id: "ufed", slug: "ufed-license-activation", title: "فعال‌سازی و تمدید لایسنس UFED", type: "service", category: "لایسنس و باکس", price: 2490000, currency: "IRR" }
];

const fallbackAgents: HomepageAgent[] = [
  { id: "nima-rasouli", name: "نیما رسولی", specialty: "کارشناس شیائومی", rating: 4.9, phone: "09925739310", available: true },
  { id: "ali-abdi", name: "علی عبدی", specialty: "کارشناس سامسونگ", rating: 4.8, phone: "09925739311", available: true },
  { id: "hesam-amini", name: "حسام امینی", specialty: "کارشناس عمومی", rating: 4.8, phone: "09925739313", available: false },
  { id: "hossein-kari", name: "حسین کاری", specialty: "متخصص برندهای چینی", rating: 4.7, phone: "09925739314", available: true },
  { id: "reza-rajabdoost", name: "رضا رجب‌دوست", specialty: "کارشناس سامسونگ", rating: 4.9, phone: "09925739320", available: true }
];

type HomePageProps = { params: Promise<{ locale: string }> };

async function fetchCollection<T>(path: string, fallback: T[]): Promise<T[]> {
  try {
    const response = await fetch(`${SERVER_API_BASE}${path}`, { next: { revalidate: 60 } });
    if (!response.ok) return fallback;
    const value: unknown = await response.json();
    return Array.isArray(value) && value.length ? (value as T[]) : fallback;
  } catch {
    return fallback;
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
    fetchCollection<HomepageProduct>("/products", fallbackProducts),
    fetchCollection<HomepageAgent>("/seller/agents", fallbackAgents),
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
        publisher: { "@id": `${siteUrl}/#organization` },
        potentialAction: {
          "@type": "SearchAction",
          target: `${siteUrl}/${locale}/search?q={search_term_string}`,
          "query-input": "required name=search_term_string"
        }
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
