"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import type { PublicProductSummary } from "@topgsm/shared-types";
import type { Locale } from "@/lib/i18n";
import { API_BASE } from "@/lib/api/client";
import { currencyLabel, formatCurrencyAmount } from "@/lib/currency";
import { DesignIcon } from "./DesignIcon";
import styles from "./HeaderSearch.module.css";

const copy = {
  fa: { open: "جست‌وجوی محصولات", title: "دنبال چه می‌گردید؟", placeholder: "نام محصول، مدل یا دسته‌بندی", hint: "نام محصول یا مدل دستگاه را بنویسید.", short: "حداقل دو حرف بنویسید.", loading: "در حال جست‌وجو…", results: "نتایج جست‌وجو", empty: "محصولی پیدا نشد. عبارت دیگری را امتحان کنید.", error: "جست‌وجو در دسترس نیست.", retry: "تلاش دوباره", all: "دیدن همه نتایج", browse: "دیدن همه محصولات", close: "بستن جست‌وجو", from: "از" },
  en: { open: "Search products", title: "What are you looking for?", placeholder: "Product, model, or category", hint: "Search by product name or device model.", short: "Type at least two characters.", loading: "Searching…", results: "Search results", empty: "No products found. Try another term.", error: "Search is unavailable.", retry: "Try again", all: "See all results", browse: "Browse all products", close: "Close search", from: "From" },
  ar: { open: "البحث عن المنتجات", title: "عمّ تبحث؟", placeholder: "المنتج أو الموديل أو الفئة", hint: "ابحث باسم المنتج أو موديل الجهاز.", short: "اكتب حرفين على الأقل.", loading: "جارٍ البحث…", results: "نتائج البحث", empty: "لم نجد منتجات. جرّب عبارة أخرى.", error: "البحث غير متاح.", retry: "حاول مجددًا", all: "عرض جميع النتائج", browse: "تصفح جميع المنتجات", close: "إغلاق البحث", from: "من" }
} as const;

export function HeaderSearch({ locale }: { locale: Locale }) {
  const c = copy[locale];
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PublicProductSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const term = query.trim();
  const catalogHref = `/${locale}/products${term ? `?search=${encodeURIComponent(term)}` : ""}` as Route;

  useEffect(() => {
    const shortcut = (event: globalThis.KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (!dialogRef.current?.open) dialogRef.current?.showModal();
        setOpen(true);
        inputRef.current?.focus();
      }
    };
    document.addEventListener("keydown", shortcut);
    return () => document.removeEventListener("keydown", shortcut);
  }, []);

  useEffect(() => {
    if (!open || term.length < 2) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams({ search: term.slice(0, 100), limit: "8" });
        const response = await fetch(`${API_BASE}/products?${params}`, { signal: controller.signal, headers: { accept: "application/json" } });
        if (!response.ok) throw new Error(`Search returned ${response.status}`);
        setResults(await response.json() as PublicProductSummary[]);
        setFailed(false);
      } catch {
        if (!controller.signal.aborted) { setResults([]); setFailed(true); }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 220);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [open, term, retryCount]);

  function close() { dialogRef.current?.close(); }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    close();
    router.push(catalogHref);
  }
  function onInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" && results.length) {
      event.preventDefault();
      dialogRef.current?.querySelector<HTMLAnchorElement>(`#header-search-results a`)?.focus();
    }
  }
  function onResultKeyDown(event: KeyboardEvent<HTMLAnchorElement>) {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const links = Array.from(dialogRef.current?.querySelectorAll<HTMLAnchorElement>("#header-search-results a") ?? []);
    const index = links.indexOf(event.currentTarget);
    if (event.key === "ArrowUp" && index === 0) inputRef.current?.focus();
    else links[Math.max(0, Math.min(links.length - 1, index + (event.key === "ArrowDown" ? 1 : -1)))]?.focus();
  }

  return <>
    <button type="button" className={styles.trigger} aria-label={c.open} aria-haspopup="dialog" aria-expanded={open} onClick={() => { if (!dialogRef.current?.open) dialogRef.current?.showModal(); setOpen(true); inputRef.current?.focus(); }}><DesignIcon name="search" /><span>{c.open}</span></button>
    <dialog ref={dialogRef} className={styles.dialog} aria-label={c.open} onClose={() => { setOpen(false); setQuery(""); setResults([]); setFailed(false); setLoading(false); }}>
      <div className={styles.header}><div><span className={styles.eyebrow}>{c.open}</span><h2>{c.title}</h2></div><button type="button" className={styles.close} aria-label={c.close} onClick={close}>×</button></div>
      <form className={styles.form} role="search" onSubmit={submit}>
        <DesignIcon name="search" />
        <input ref={inputRef} type="search" name="search" value={query} maxLength={100} autoComplete="off" placeholder={c.placeholder} aria-label={c.open} aria-controls="header-search-results" onKeyDown={onInputKeyDown} onChange={(event) => { setQuery(event.target.value); setResults([]); setFailed(false); setLoading(event.target.value.trim().length >= 2); }} />
        <button type="submit" aria-label={c.all}><DesignIcon name="arrow" /></button>
      </form>
      <div className={styles.content} id="header-search-results" aria-live="polite">
        {!term ? <p className={styles.message}>{c.hint}</p> : term.length < 2 ? <p className={styles.message}>{c.short}</p> : loading ? <p className={styles.message}>{c.loading}</p> : failed ? <div className={styles.message} role="alert"><p>{c.error}</p><button type="button" className={styles.retry} onClick={() => { setFailed(false); setLoading(true); setRetryCount((count) => count + 1); }}>{c.retry}</button></div> : results.length ? <><p className={styles.resultHeading}>{c.results}</p><ul className={styles.results}>{results.map((product) => {
          const image = product.image?.variants.find((variant) => variant.name === "thumb") ?? product.image?.variants[0];
          const starting = product.startingPrices[0];
          return <li key={product.id}><Link href={`/${locale}/products/${product.slug}` as Route} onClick={close} onKeyDown={onResultKeyDown}><span className={styles.artwork}>{image ? <Image unoptimized src={image.url} alt="" width={image.width} height={image.height} /> : <DesignIcon name={product.type === "digital" ? "file" : product.type === "service" ? "headphones" : "layers"} />}</span><span className={styles.description}><strong>{product.title}</strong><small>{product.category ?? (starting ? `${c.from} ${formatCurrencyAmount(starting.price, starting.currency, locale)} ${currencyLabel(starting.currency)}` : "")}</small></span><DesignIcon name="arrow" /></Link></li>;
        })}</ul></> : <p className={styles.message}>{c.empty}</p>}
      </div>
      <Link className={styles.footer} href={catalogHref} onClick={close}>{term ? c.all : c.browse}<DesignIcon name="arrow" /></Link>
    </dialog>
  </>;
}
