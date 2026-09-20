import { notFound } from "next/navigation";
import { AccountPanel } from "@/components/account/AccountPanel";
import { requireUser } from "@/lib/auth/server";
import { isLocale } from "@/lib/i18n";

export default async function AccountSettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const user = await requireUser(locale, ["buyer"]);
  return <AccountPanel locale={locale} user={user} view="settings" />;
}
