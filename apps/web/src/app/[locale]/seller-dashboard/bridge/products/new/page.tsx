import { notFound } from "next/navigation";
import { BridgeProductForm } from "@/components/bridge/BridgeProductForm";
import { requireUser } from "@/lib/auth/server";
import { isLocale } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function NewBridgeProductPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ grant?: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  await requireUser(locale, ["seller-admin", "seller-staff"]);
  return <BridgeProductForm locale={locale} initialGrantId={(await searchParams).grant}/>;
}
