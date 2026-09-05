import type { Metadata } from "next";
import { notFound } from "next/navigation";
import "../globals.css";
import { getDirection, isLocale, locales } from "@/lib/i18n";

type LocaleLayoutProps = Readonly<{
  children: React.ReactNode;
  params: {
    locale: string;
  };
}>;

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export const metadata: Metadata = {
  title: "Top GSM"
};

export default function LocaleLayout({ children, params }: LocaleLayoutProps) {
  if (!isLocale(params.locale)) {
    notFound();
  }

  return (
    <html lang={params.locale} dir={getDirection(params.locale)}>
      <body>{children}</body>
    </html>
  );
}
