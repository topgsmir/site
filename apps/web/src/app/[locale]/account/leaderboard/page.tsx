import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/server";
import { isLocale } from "@/lib/i18n";

export default async function AccountLeaderboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  await requireUser(locale, ["buyer"]);
  redirect(`/${locale}/account`);
}
