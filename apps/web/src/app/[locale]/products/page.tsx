import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { getProducts } from "@/lib/public-data";

export const metadata: Metadata = { title: "Product catalog", description: "Active products and seller offers on Top GSM." };

export default async function ProductsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const products = await getProducts().catch(() => []);
  const copy = locale === "fa" ? { title: "کاتالوگ محصولات", intro: "محصولات فعال و پیشنهادهای فروشندگان", empty: "هنوز محصول فعالی در کاتالوگ نیست." } : locale === "ar" ? { title: "كتالوج المنتجات", intro: "المنتجات النشطة وعروض البائعين", empty: "لا توجد منتجات نشطة في الكتالوج بعد." } : { title: "Product catalog", intro: "Active products and seller offers", empty: "There are no active catalog products yet." };
  return <div className="product-document"><header className="product-nav"><Link href={`/${locale}`}>TOP GSM</Link><Link href={`/${locale}/blog`}>Journal</Link></header><main><header className="product-heading"><p>CATALOG / {String(products.length).padStart(2, "0")}</p><h1>{copy.title}</h1><p>{copy.intro}</p></header><section className="product-offers" aria-labelledby="catalog-title"><header><span>01</span><h2 id="catalog-title">{copy.title}</h2></header>{products.length ? <div>{products.map((product) => <article key={product.id}><p>{product.category ?? product.type}</p><h3><Link href={`/${locale}/products/${product.slug}`}>{product.title}</Link></h3>{product.startingPrices[0] ? <strong>{product.startingPrices[0].price} {product.startingPrices[0].currency}</strong> : null}</article>)}</div> : <p className="product-empty">{copy.empty}</p>}</section></main></div>;
}
