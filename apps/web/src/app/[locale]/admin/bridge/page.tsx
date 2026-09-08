import { notFound } from "next/navigation";
import { AdminBridgeWorkspace } from "@/components/bridge/AdminBridgeWorkspace";
import { requireUser } from "@/lib/auth/server";
import { isLocale } from "@/lib/i18n";

export const dynamic = "force-dynamic";
export default async function AdminBridgePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  await requireUser(locale, ["platform-admin"]);
  return <AdminBridgeWorkspace locale={locale}/>;
}
