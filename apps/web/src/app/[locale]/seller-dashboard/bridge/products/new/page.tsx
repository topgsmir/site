import type { Route } from "next";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/server";
import { isLocale } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function NewBridgeProductPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ grant?: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  await requireUser(locale, ["seller-admin", "seller-staff"]);
  const grant = (await searchParams).grant;
  redirect(`/${locale}/seller-dashboard/products/new${grant ? `?grant=${encodeURIComponent(grant)}` : ""}` as Route);
}
