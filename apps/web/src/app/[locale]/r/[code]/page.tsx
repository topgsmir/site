import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { MarketingRedirect } from "@/components/marketing/MarketingRedirect";

export default async function ReferralPage({ params }: { params: Promise<{ locale: string; code: string }> }) {
  const { locale, code } = await params;
  if (!isLocale(locale) || !/^[A-Za-z0-9_-]{16,32}$/.test(code)) notFound();
  return <MarketingRedirect locale={locale} code={code} />;
}
