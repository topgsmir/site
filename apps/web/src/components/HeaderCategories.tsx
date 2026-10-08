"use client";

import Link from "next/link";
import type { Route } from "next";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Locale } from "@/lib/i18n";
import type { TemplateConfiguration } from "@topgsm/shared-types";
import { api } from "@/lib/api/client";
import { listingHref } from "@/lib/seo";
import { DesignIcon } from "./DesignIcon";
import styles from "./PublicHeader.module.css";

type Category = { id: string; name: string; translations: { locale: string; name: string }[] };
type Page = { items: Category[]; nextCursor: string | null };
const copy = {
  fa: { all: "همه محصولات", types: "نوع محصول", categories: "دسته‌بندی‌های فروشگاه", loading: "در حال دریافت دسته‌بندی‌ها…", error: "دسته‌بندی‌ها بارگذاری نشدند.", retry: "تلاش دوباره", empty: "هنوز دسته‌بندی‌ای منتشر نشده است.", more: "دسته‌بندی‌های بیشتر" },
  en: { all: "All products", types: "Product types", categories: "Shop categories", loading: "Loading categories…", error: "Could not load categories.", retry: "Try again", empty: "No categories are available yet.", more: "More categories" },
  ar: { all: "جميع المنتجات", types: "نوع المنتج", categories: "فئات المتجر", loading: "جارٍ تحميل الفئات…", error: "تعذر تحميل الفئات.", retry: "حاول مجددًا", empty: "لا توجد فئات متاحة بعد.", more: "المزيد من الفئات" }
};
export function HeaderCategories({ locale, configuration }: { locale: Locale; configuration: TemplateConfiguration["categories"] }) {
  const c = copy[locale];
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const controller = useRef<AbortController | null>(null);
  const [page, setPage] = useState<Page>({ items: [], nextCursor: null });
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const busy = useRef(false);
  const position = useCallback(() => {
    const details = detailsRef.current;
    if (!details?.open) return;
    const anchor = details.querySelector("summary")!.getBoundingClientRect();
    const width = Math.min(880, window.innerWidth - 32);
    const left = locale === "en" ? anchor.left : anchor.right - width;
    details.style.setProperty("--category-menu-left", Math.max(16, Math.min(left, window.innerWidth - width - 16)) + "px");
    details.style.setProperty("--category-menu-top", anchor.bottom + 4 + "px");
  }, [locale]);
  async function load(more = false) {
    if (busy.current) return;
    busy.current = true; setStatus("loading");
    const request = new AbortController(); controller.current = request;
    try {
      const { data } = await api.get<Page>("/products/categories", { params: { limit: 50, ...(more && page.nextCursor ? { cursor: page.nextCursor } : {}) }, signal: request.signal });
      if (request.signal.aborted) return;
      setPage((previous) => ({ items: more ? [...previous.items, ...data.items.filter((item) => !previous.items.some((old) => old.id === item.id))] : data.items, nextCursor: data.nextCursor })); setStatus("ready");
    } catch { if (!request.signal.aborted) setStatus("error"); }
    finally { if (!request.signal.aborted) busy.current = false; }
  }
  useEffect(() => {
    if (!configuration.enabled) return;
    const dismiss = (event: PointerEvent) => { if (detailsRef.current && !detailsRef.current.contains(event.target as Node)) detailsRef.current.open = false; };
    document.addEventListener("pointerdown", dismiss); window.addEventListener("resize", position); window.addEventListener("scroll", position, { passive: true, capture: true });
    return () => { document.removeEventListener("pointerdown", dismiss); window.removeEventListener("resize", position); window.removeEventListener("scroll", position, true); };
  }, [configuration.enabled, position]);
  useEffect(() => () => controller.current?.abort(), []);
  const close = () => { if (detailsRef.current) detailsRef.current.open = false; };
  if (!configuration.enabled) return null;
  return <details ref={detailsRef} className={styles.categories} onToggle={() => { position(); if (detailsRef.current?.open && status === "idle") void load(); }} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) close(); }} onKeyDown={(event) => {
    if (event.key === "Escape" && detailsRef.current?.open) { close(); detailsRef.current.querySelector("summary")?.focus(); event.preventDefault(); }
  }}>
    <summary><span className={styles.menuIcon} aria-hidden="true"><span /><span /><span /></span>{configuration.title}</summary>
    <div className={styles.categoryPanel} role="region" aria-label={configuration.title}>
      <nav className={styles.categoryTypes} aria-label={c.types}><h2>{c.types}</h2>{configuration.items.filter((item) => item.enabled).map((item, index) => <Link key={index} href={item.href as Route} onClick={close}><DesignIcon name={item.icon} /><span>{item.label}</span><DesignIcon name="arrow" /></Link>)}</nav>
      <section className={styles.categoryBrowse} aria-label={c.categories}>
        <div className={styles.categoryHeading}><h2>{c.categories}</h2><Link className={styles.allCategories} href={`/${locale}/products` as Route} onClick={close}>{c.all}<DesignIcon name="arrow" /></Link></div>
        <nav className={styles.categoryLinks} aria-label={c.categories}>{page.items.map((item) => <Link key={item.id} href={listingHref(`/${locale}/products`, { categoryId: item.id }) as Route} onClick={close}><span>{item.translations.find((translation) => translation.locale === locale)?.name ?? item.name}</span><DesignIcon name="arrow" /></Link>)}</nav>
        {status === "loading" && <p role="status">{c.loading}</p>}
        {status === "error" && <div role="alert"><p>{c.error}</p><button type="button" onClick={() => void load(page.items.length > 0)}>{c.retry}</button></div>}
        {status === "ready" && !page.items.length && <p>{c.empty}</p>}
        {status === "ready" && page.nextCursor && page.items.length < 200 && <button type="button" onClick={() => void load(true)}>{c.more}</button>}
      </section>
    </div>
  </details>;
}