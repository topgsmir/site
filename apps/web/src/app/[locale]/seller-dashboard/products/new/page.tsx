import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { requireUser } from "@/lib/auth/server";
import { SellerProductCreation } from "@/components/seller/SellerDashboard";
import { BridgeProductForm } from "@/components/bridge/BridgeProductForm";

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
  searchParams: Promise<{
    grant?: string;
  }>;
};

export default async function SellerProductCreationPage({ params, searchParams }: SellerProductCreationPageProps) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);

  if (!isLocale(locale)) {
    notFound();
  }

  const user = await requireUser(locale, ["seller-admin", "seller-staff"]);

  return query.grant
    ? <BridgeProductForm locale={locale} initialGrantId={query.grant} />
    : <SellerProductCreation locale={locale} user={user} />;
}
