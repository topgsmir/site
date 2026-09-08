import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StaffSetupForm } from "@/components/admin/StaffSetupForm";
import { isLocale } from "@/lib/i18n";

export const metadata: Metadata = { title: "Complete staff setup", robots: { index: false, follow: false } };

export default async function StaffSetupPage({ params }: { params: Promise<{ locale: string; token: string }> }) {
  const { locale, token } = await params;
  if (!isLocale(locale) || !/^[A-Za-z0-9_-]{43}$/.test(token)) notFound();
  return <StaffSetupForm locale={locale} token={token} />;
}
