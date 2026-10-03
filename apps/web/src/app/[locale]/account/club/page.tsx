import { notFound } from "next/navigation";
import { AccountPanel } from "@/components/account/AccountPanel";
import { requireAuthenticatedUser } from "@/lib/auth/server";
import { isLocale } from "@/lib/i18n";

export default async function ClubPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const user = await requireAuthenticatedUser(locale);
  return <AccountPanel locale={locale} user={user} view="club" />;
}
