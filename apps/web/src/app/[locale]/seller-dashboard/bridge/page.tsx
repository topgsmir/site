import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SellerDashboard } from "@/components/seller/SellerDashboard";
import { requireUser } from "@/lib/auth/server";
import { isLocale } from "@/lib/i18n";

export const metadata: Metadata = { title: "Bridge services", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function BridgePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const user = await requireUser(locale, ["seller-admin", "seller-staff"]);
  return <SellerDashboard locale={locale} user={user} initialSection="bridge" />;
}
