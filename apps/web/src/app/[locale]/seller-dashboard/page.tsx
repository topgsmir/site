import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { requireUser } from "@/lib/auth/server";
import { SellerDashboard } from "@/components/seller/SellerDashboard";

export const metadata: Metadata = {
  title: "Seller Dashboard",
  robots: {
    index: false,
    follow: false
  }
};

export const dynamic = "force-dynamic";

type SellerDashboardPageProps = {
  params: Promise<{
    locale: string;
  }>;
  searchParams?: Promise<{
    section?: string;
  }>;
};

export default async function SellerDashboardPage({ params, searchParams }: SellerDashboardPageProps) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);

  if (!isLocale(locale)) {
    notFound();
  }

  const user = await requireUser(locale, ["seller-admin", "seller-staff"]);
  const requestedSection = query?.section;
  const initialSection = requestedSection === "products" ||
    (requestedSection === "coupons" && user.permissions?.includes("coupons_manage")) ||
    (requestedSection === "blog" && user.permissions?.includes("blog_manage"))
    ? requestedSection
    : "overview";

  return <SellerDashboard locale={locale} user={user} initialSection={initialSection} />;
}
