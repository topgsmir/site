import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { requireUser } from "@/lib/auth/server";
import { VendorManagement } from "@/components/admin/VendorManagement";

export const metadata: Metadata = {
  title: "Top GSM | Admin",
  robots: {
    index: false,
    follow: false
  }
};

export const dynamic = "force-dynamic";

type AdminPanelPageProps = {
  params: Promise<{
    locale: string;
  }>;
};

export default async function AdminPanelPage({ params }: AdminPanelPageProps) {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  const user = await requireUser(locale, ["platform-admin"]);

  return <VendorManagement locale={locale} adminName={user.fullName} />;
}
