import { notFound } from "next/navigation";
import { dashboardFor, getCurrentUser } from "@/lib/auth/server";
import { isLocale } from "@/lib/i18n";
import { CartCheckout } from "@/components/checkout/CartCheckout";
import { PublicHeader } from "@/components/PublicHeader";

export const metadata = { title: "Cart", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function CartPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const user = await getCurrentUser();
  const skip = locale === "fa" ? "رفتن به سبد خرید" : locale === "ar" ? "انتقل إلى سلة التسوق" : "Skip to cart";
  return <><a className="skip-link" href="#cart-content">{skip}</a><PublicHeader locale={locale} accountHref={user ? dashboardFor(user, locale) : null} current="cart" /><CartCheckout locale={locale} signedInBuyer={user?.role === "buyer"} /></>;
}
