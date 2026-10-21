import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CheckoutStatus } from "@/components/checkout/CheckoutStatus";
import { requireAuthenticatedUser } from "@/lib/auth/server";
import { isLocale } from "@/lib/i18n";

export const dynamic = "force-dynamic";

const PAGE_TITLE = { fa: "وضعیت پرداخت", en: "Payment status", ar: "حالة الدفع" } as const;

export async function generateMetadata({ params }: { params: Promise<{ locale: string; id: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: isLocale(locale) ? PAGE_TITLE[locale] : PAGE_TITLE.en, robots: { index: false, follow: false } };
}

export default async function CheckoutPage({
  params,
  searchParams
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ payment?: string | string[] }>;
}) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();
  await requireAuthenticatedUser(locale);
  const query = await searchParams;
  const payment = Array.isArray(query.payment) ? query.payment[0] ?? "" : query.payment ?? "";
  return <CheckoutStatus locale={locale} checkoutId={id} paymentReturn={payment} />;
}
