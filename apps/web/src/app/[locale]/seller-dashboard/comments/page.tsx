import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { SellerCommentsWorkspace } from "@/components/comments/SellerCommentsWorkspace";

export default async function SellerCommentsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <SellerCommentsWorkspace locale={locale} />;
}
