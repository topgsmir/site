import { notFound } from "next/navigation";
import { requireAuthenticatedUser } from "@/lib/auth/server";
import { isLocale } from "@/lib/i18n";
import { CheckoutStatus } from "@/components/checkout/CheckoutStatus";

export const dynamic = "force-dynamic";
export const metadata = { title: "Checkout", robots: { index: false, follow: false } };

export default async function CheckoutPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();
  await requireAuthenticatedUser(locale);
  return <CheckoutStatus locale={locale} checkoutId={id} />;
}
