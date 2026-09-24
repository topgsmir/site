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
    editProduct?: string;
    productTitle?: string;
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
    (requestedSection === "profile" && user.role === "seller-admin") ||
    (requestedSection === "statistics" && user.permissions?.includes("analytics_view")) ||
    (requestedSection === "orders" && user.permissions?.includes("orders_manage")) ||
    (requestedSection === "shipping" && user.permissions?.includes("physical_products_manage")) ||
    (requestedSection === "bridge" && process.env.NEXT_PUBLIC_BRIDGE_FEATURE_ENABLED === "true") ||
    (requestedSection === "coupons" && user.permissions?.includes("coupons_manage")) ||
    (requestedSection === "blog" && user.permissions?.includes("blog_manage"))
    ? requestedSection
    : "overview";
  const initialEditProductId = query?.editProduct && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(query.editProduct)
    ? query.editProduct
    : undefined;
  const initialProductSearch = initialEditProductId ? query?.productTitle?.slice(0, 200) : undefined;

  return <SellerDashboard
    locale={locale}
    user={user}
    initialSection={initialSection}
    initialEditProductId={initialEditProductId}
    initialProductSearch={initialProductSearch}
  />;
}
