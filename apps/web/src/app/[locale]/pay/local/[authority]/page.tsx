import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/server";
import { isLocale } from "@/lib/i18n";
import { LocalGateway } from "@/components/checkout/LocalGateway";

export const dynamic = "force-dynamic";
export const metadata = { title: "Local test gateway", robots: { index: false, follow: false } };

export default async function LocalGatewayPage({ params }: { params: Promise<{ locale: string; authority: string }> }) {
  const { locale, authority } = await params;
  if (!isLocale(locale)) notFound();
  await requireUser(locale, ["buyer"]);
  return <LocalGateway locale={locale} authority={authority} />;
}
