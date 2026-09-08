import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StaffWorkspace } from "@/components/admin/StaffWorkspace";
import { isLocale } from "@/lib/i18n";
import { requireUser } from "@/lib/auth/server";

export const metadata: Metadata = { title: "Platform staff", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function StaffPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  await requireUser(locale, ["platform-admin"]);
  return <StaffWorkspace locale={locale} />;
}
