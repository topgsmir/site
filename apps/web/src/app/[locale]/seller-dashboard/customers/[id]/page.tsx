import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SellerDashboard } from "@/components/seller/SellerDashboard";
import { requireUser } from "@/lib/auth/server";
import { isLocale } from "@/lib/i18n";

export const metadata: Metadata = { title: "Customer history", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function SellerCustomerHistoryPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  if (!isLocale(locale) || !/^(?:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|[0-9]{5})$/i.test(id)) notFound();
  const user = await requireUser(locale, ["seller-admin", "seller-staff", "platform-admin"]);
  if (!user.permissions?.includes("orders_manage")) notFound();
  return <SellerDashboard locale={locale} user={user} initialSection="customers" initialCustomerId={id} />;
}
