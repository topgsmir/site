"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import type { Route } from "next";
import type { PublicProductSummary } from "@topgsm/shared-types";
import type { Locale } from "@/lib/i18n";
import { currencyLabel, formatCurrencyAmount } from "@/lib/currency";
import { DesignIcon } from "@/components/DesignIcon";
import { API_BASE } from "@/lib/api/client";
import styles from "./ProductCatalog.module.css";

const copy = {
  fa: { title: "برای قدم بعدی تعمیر.", intro: "فایل‌ها، ابزارها و خدماتی که کارتان را جلو می‌برند.", search: "جست‌وجوی محصول یا مدل دستگاه", all: "همه محصولات", digital: "فایل و آموزش", physical: "ابزار تعمیر", service: "خدمات", bridge: "خرید واسطه‌ای", empty: "محصولی پیدا نشد.", emptyHint: "عبارت دیگری بنویسید یا همه محصولات را ببینید.", reset: "نمایش همه محصولات", details: "مشاهده جزئیات", from: "از", results: "محصول نمایش داده شده", error: "محصولات بارگذاری نشدند.", loading: "در حال جست‌وجو…", more: "نمایش محصولات بیشتر", retry: "تلاش دوباره" },
  en: { title: "For your next repair.", intro: "The files, tools, and services that move your work forward.", search: "Search products or device models", all: "All products", digital: "Files & training", physical: "Repair tools", service: "Services", bridge: "Assisted purchases", empty: "No products found.", emptyHint: "Try another search or explore all products.", reset: "Show all products", details: "View details", from: "From", results: "products shown", error: "Products could not be loaded.", loading: "Searching…", more: "Load more products", retry: "Try again" },
  ar: { title: "لخطوتك التالية في الصيانة.", intro: "الملفات والأدوات والخدمات التي تساعدك على التقدم.", search: "ابحث عن منتج أو موديل جهاز", all: "جميع المنتجات", digital: "ملفات وتدريب", physical: "أدوات الصيانة", service: "الخدمات", bridge: "شراء بالوساطة", empty: "لم نجد منتجات.", emptyHint: "جرب بحثًا آخر أو تصفح جميع المنتجات.", reset: "عرض جميع المنتجات", details: "عرض التفاصيل", from: "من", results: "منتجات معروضة", error: "تعذر تحميل المنتجات.", loading: "جارٍ البحث…", more: "عرض المزيد من المنتجات", retry: "حاول مجددًا" }
};

export function ProductCatalog({ locale, products: initialProducts, unavailable: initialUnavailable, initialQuery, initialType }: { locale: Locale; products: PublicProductSummary[]; unavailable: boolean; initialQuery: string; initialType: string }) {
  const c = copy[locale];
  const [query, setQuery] = useState(initialQuery);
  const [type, setType] = useState(initialType);
  const [products, setProducts] = useState(initialProducts);
  const [unavailable, setUnavailable] = useState(initialUnavailable);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreFailed, setMoreFailed] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [hasMore, setHasMore] = useState(initialProducts.length === 50);
  const firstRender = useRef(true);
  const moreController = useRef<AbortController | null>(null);
  const visible = products;

  function updateFilters(nextQuery: string, nextType: string) {
    if (nextQuery === query && nextType === type) return;
    moreController.current?.abort();
    setQuery(nextQuery);
    setType(nextType);
    setProducts([]);
    setHasMore(false);
    setLoading(true);
    setLoadingMore(false);
    setMoreFailed(false);
    setUnavailable(false);
    const url = new URL(window.location.href);
    if (nextQuery.trim()) url.searchParams.set("search", nextQuery.trim()); else url.searchParams.delete("search");
    if (nextType !== "all") url.searchParams.set("type", nextType); else url.searchParams.delete("type");
    window.history.replaceState(null, "", url);
  }

  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams({ limit: "50" });
        if (query.trim()) params.set("search", query.trim());
        if (type !== "all") params.set("type", type);
        const response = await fetch(`${API_BASE}/products?${params}`, { signal: controller.signal, headers: { accept: "application/json" } });
        if (!response.ok) throw new Error(`Products returned ${response.status}`);
        const next = await response.json() as PublicProductSummary[];
        setProducts(next);
        setHasMore(next.length === 50);
        setUnavailable(false);
      } catch {
        if (!controller.signal.aborted) setUnavailable(true);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query, type, retryCount]);

  async function loadMore() {
    const cursor = products.at(-1)?.id;
    if (!cursor || loadingMore) return;
    const controller = new AbortController();
    moreController.current = controller;
    setLoadingMore(true);
    setMoreFailed(false);
    try {
      const params = new URLSearchParams({ limit: "50", cursor });
      if (query.trim()) params.set("search", query.trim());
      if (type !== "all") params.set("type", type);
      const response = await fetch(`${API_BASE}/products?${params}`, { signal: controller.signal, headers: { accept: "application/json" } });
      if (!response.ok) throw new Error(`Products returned ${response.status}`);
      const next = await response.json() as PublicProductSummary[];
      setProducts((current) => [...current, ...next]);
      setHasMore(next.length === 50);
    } catch {
      if (!controller.signal.aborted) setMoreFailed(true);
    } finally {
      if (!controller.signal.aborted) setLoadingMore(false);
    }
  }
  const number = new Intl.NumberFormat(locale);
  return <main className={styles.main} id="catalog-content">
    <header className={styles.intro}><span className={styles.introIcon}><DesignIcon name="layers" /></span><h1>{c.title}</h1><p>{c.intro}</p></header>
    <div className={styles.toolbar}><div className={styles.filters} role="group" aria-label={c.all}>{(["all", "digital", "physical", "service", "bridge"] as const).map((filter) => <button key={filter} type="button" aria-pressed={type === filter} onClick={() => updateFilters(query, filter)}>{c[filter]}</button>)}</div><label className={styles.search}><DesignIcon name="search" /><span className="sr-only">{c.search}</span><input type="search" value={query} maxLength={100} onChange={(event) => updateFilters(event.target.value, type)} placeholder={c.search} /></label></div>
    <p className={styles.resultCount} role="status">{loading ? c.loading : `${number.format(visible.length)} ${c.results}`}</p>
    {unavailable ? <div className={styles.empty} role="alert"><p>{c.error}</p><button type="button" onClick={() => { setUnavailable(false); setLoading(true); setRetryCount((count) => count + 1); }}>{c.retry}</button></div> : loading ? <p className={styles.empty}>{c.loading}</p> : visible.length ? <><div className={styles.grid}>{visible.map((product) => {
      const starting = product.startingPrices[0];
      const image = product.image?.variants.find((item) => item.name === "thumb") ?? product.image?.variants[0];
      return <Link className={styles.card} key={product.id} href={`/${locale}/products/${product.slug}` as Route}><div className={styles.artwork} data-type={product.type}>{image ? <Image unoptimized src={image.url} alt={product.title} width={image.width} height={image.height} /> : <><DesignIcon name={product.type === "digital" ? "file" : product.type === "service" ? "headphones" : "layers"} /><span>{c[product.type]}</span></>}</div><div className={styles.content}><p>{product.category ?? c[product.type]}</p><h2>{product.title}</h2><div><span>{starting ? `${c.from} ${formatCurrencyAmount(starting.price, starting.currency, locale)} ${currencyLabel(starting.currency)}` : c.details}</span><DesignIcon name="arrow" /></div></div></Link>;
    })}</div>{moreFailed && <p className={styles.moreError} role="alert">{c.error}</p>}{hasMore && <button type="button" className={styles.more} disabled={loadingMore} onClick={loadMore}>{loadingMore ? c.loading : moreFailed ? c.retry : c.more}</button>}</> : <div className={styles.empty}><DesignIcon name="search" /><h2>{c.empty}</h2><p>{c.emptyHint}</p>{query || type !== "all" ? <button type="button" onClick={() => updateFilters("", "all")}>{c.reset}</button> : null}</div>}
  </main>;
}
