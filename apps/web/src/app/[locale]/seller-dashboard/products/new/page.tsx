import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { requireUser } from "@/lib/auth/server";
import { SellerProductCreation } from "@/components/seller/SellerDashboard";

export const metadata: Metadata = {
  title: "Create Product",
  robots: {
    index: false,
    follow: false
  }
};

export const dynamic = "force-dynamic";

type SellerProductCreationPageProps = {
  params: Promise<{
    locale: string;
  }>;
};

export default async function SellerProductCreationPage({ params }: SellerProductCreationPageProps) {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  const user = await requireUser(locale, ["seller-admin", "seller-staff"]);

  return <SellerProductCreation locale={locale} user={user} />;
}
