import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminProductEditor } from "@/components/admin/AdminProductEditor";
import { requireUser } from "@/lib/auth/server";
import { isLocale } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "Edit product | Top GSM",
  robots: { index: false, follow: false }
};

export const dynamic = "force-dynamic";

export default async function AdminProductEditorPage({
  params
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();
  await requireUser(locale, ["platform-admin"]);
  return <AdminProductEditor locale={locale} productId={id} />;
}
