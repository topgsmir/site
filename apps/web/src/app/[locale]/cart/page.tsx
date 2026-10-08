import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import { isLocale } from "@/lib/i18n";
import { CartCheckout } from "@/components/checkout/CartCheckout";
import { PublicFooter } from "@/components/PublicFooter";

export const metadata = { title: "Cart", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function CartPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const user = await getCurrentUser();
  const skip = locale === "fa" ? "رفتن به سبد خرید" : locale === "ar" ? "انتقل إلى سلة التسوق" : "Skip to cart";
  return <><a className="skip-link" href="#cart-content">{skip}</a><CartCheckout locale={locale} signedInUser={Boolean(user)} /><PublicFooter locale={locale} /></>;
}
