import { notFound, redirect } from "next/navigation";
import { requireAuthenticatedUser } from "@/lib/auth/server";
import { isLocale } from "@/lib/i18n";

export default async function AccountLeaderboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  await requireAuthenticatedUser(locale);
  redirect(`/${locale}/account`);
}
