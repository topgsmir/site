"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import type { PublicProductSummary } from "@topgsm/shared-types";
import type { Locale } from "@/lib/i18n";
import { DesignIcon } from "@/components/DesignIcon";
import styles from "./ProductCatalog.module.css";

const copy = {
  fa: { title: "برای قدم بعدی تعمیر.", intro: "فایل‌ها، ابزارها و خدماتی که کارتان را جلو می‌برند.", search: "جست‌وجوی محصول یا مدل دستگاه", all: "همه محصولات", digital: "فایل و آموزش", physical: "ابزار تعمیر", service: "خدمات", bridge: "خرید واسطه‌ای", empty: "محصولی پیدا نشد.", emptyHint: "عبارت دیگری بنویسید یا همه محصولات را ببینید.", reset: "نمایش همه محصولات", details: "مشاهده جزئیات", from: "از", results: "محصول", error: "محصولات بارگذاری نشدند. صفحه را دوباره باز کنید." },
  en: { title: "For your next repair.", intro: "The files, tools, and services that move your work forward.", search: "Search products or device models", all: "All products", digital: "Files & training", physical: "Repair tools", service: "Services", bridge: "Assisted purchases", empty: "No products found.", emptyHint: "Try another search or explore all products.", reset: "Show all products", details: "View details", from: "From", results: "products", error: "Products could not be loaded. Please reload the page." },
  ar: { title: "لخطوتك التالية في الصيانة.", intro: "الملفات والأدوات والخدمات التي تساعدك على التقدم.", search: "ابحث عن منتج أو موديل جهاز", all: "جميع المنتجات", digital: "ملفات وتدريب", physical: "أدوات الصيانة", service: "الخدمات", bridge: "شراء بالوساطة", empty: "لم نجد منتجات.", emptyHint: "جرب بحثًا آخر أو تصفح جميع المنتجات.", reset: "عرض جميع المنتجات", details: "عرض التفاصيل", from: "من", results: "منتج", error: "تعذر تحميل المنتجات. أعد تحميل الصفحة." }
};

export function ProductCatalog({ locale, products, unavailable }: { locale: Locale; products: PublicProductSummary[]; unavailable: boolean }) {
  const c = copy[locale];
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const visible = useMemo(() => {
    const term = query.trim().toLocaleLowerCase(locale);
    return products.filter((product) => (type === "all" || product.type === type) && `${product.title} ${product.category ?? ""}`.toLocaleLowerCase(locale).includes(term));
  }, [products, query, type, locale]);
  const number = new Intl.NumberFormat(locale);
  return <main className={styles.main} id="catalog-content">
    <header className={styles.intro}><span className={styles.introIcon}><DesignIcon name="layers" /></span><h1>{c.title}</h1><p>{c.intro}</p></header>
    <div className={styles.toolbar}><div className={styles.filters} role="group" aria-label={c.all}>{(["all", "digital", "physical", "service", "bridge"] as const).map((filter) => <button key={filter} type="button" aria-pressed={type === filter} onClick={() => setType(filter)}>{c[filter]}</button>)}</div><label className={styles.search}><DesignIcon name="search" /><span className="sr-only">{c.search}</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={c.search} /></label></div>
    <p className={styles.resultCount} role="status">{number.format(visible.length)} {c.results}</p>
    {unavailable ? <p className={styles.empty} role="alert">{c.error}</p> : visible.length ? <div className={styles.grid}>{visible.map((product) => {
      const starting = product.startingPrices[0];
      return <Link className={styles.card} key={product.id} href={`/${locale}/products/${product.slug}` as Route}><div className={styles.artwork} data-type={product.type}><DesignIcon name={product.type === "digital" ? "file" : product.type === "service" ? "headphones" : "layers"} /><span>{c[product.type]}</span></div><div className={styles.content}><p>{product.category ?? c[product.type]}</p><h2>{product.title}</h2><div><span>{starting ? `${c.from} ${number.format(Number(starting.price))} ${starting.currency}` : c.details}</span><DesignIcon name="arrow" /></div></div></Link>;
    })}</div> : <div className={styles.empty}><DesignIcon name="search" /><h2>{c.empty}</h2><p>{c.emptyHint}</p>{query || type !== "all" ? <button type="button" onClick={() => { setQuery(""); setType("all"); }}>{c.reset}</button> : null}</div>}
  </main>;
}
