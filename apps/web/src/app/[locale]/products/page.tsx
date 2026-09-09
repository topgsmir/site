import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { getProducts } from "@/lib/public-data";
import { PublicHeader } from "@/components/PublicHeader";
import { ProductCatalog } from "@/components/product/ProductCatalog";

export const metadata: Metadata = { title: "Product catalog", description: "Files, tools, and specialist services for your next repair." };

export default async function ProductsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const result = await getProducts().then((products) => ({ products, unavailable: false })).catch(() => ({ products: [], unavailable: true }));
  return <><a className="skip-link" href="#catalog-content">{locale === "fa" ? "رفتن به محصولات" : locale === "ar" ? "انتقل إلى المنتجات" : "Skip to products"}</a><PublicHeader locale={locale} current="shop" /><ProductCatalog locale={locale} products={result.products} unavailable={result.unavailable} /></>;
}
