import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LandingPage } from "@/components/landing/LandingPage";
import { isLocale, localizePath } from "@/lib/i18n";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://topgsm.ir";

const metadataByLocale = {
  fa: {
    title: "Top GSM | خدمات تخصصی موبایل",
    description: "بازار تخصصی خدمات موبایل، فایل تعمیرات، آموزش و فعال سازی باکس"
  },
  en: {
    title: "Top GSM | Mobile Service Marketplace",
    description: "Specialist mobile service marketplace for repair files, training, remote service, and box activation."
  },
  ar: {
    title: "Top GSM | سوق خدمات الجوال المتخصصة",
    description: "سوق متخصص لخدمات الجوال وملفات الصيانة والتدريب والخدمة عن بعد وتفعيل البوكسات."
  }
} as const;

type HomePageProps = {
  params: {
    locale: string;
  };
};

export function generateMetadata({ params }: HomePageProps): Metadata {
  const locale = isLocale(params.locale) ? params.locale : "fa";
  const localizedMetadata = metadataByLocale[locale];

  return {
    title: localizedMetadata.title,
    description: localizedMetadata.description,
    alternates: {
      canonical: new URL(localizePath(locale), siteUrl),
      languages: {
        fa: new URL(localizePath("fa"), siteUrl).toString(),
        en: new URL(localizePath("en"), siteUrl).toString(),
        ar: new URL(localizePath("ar"), siteUrl).toString(),
        "x-default": new URL(localizePath("fa"), siteUrl).toString()
      }
    }
  };
}

export default function HomePage({ params }: HomePageProps) {
  if (!isLocale(params.locale)) {
    notFound();
  }

  return <LandingPage locale={params.locale} />;
}
