"use client";

import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import type { Locale } from "@/lib/i18n";
import { CART_EVENT, cartQuantity, readCart, type CartItem } from "@/lib/cart";
import { DesignIcon } from "./DesignIcon";
import styles from "./CartLink.module.css";

const copy = {
  fa: { cart: "سبد خرید", empty: "سبد خریدتان خالی است.", browse: "مشاهده محصولات", view: "مشاهده سبد خرید", item: "محصول", items: "محصول", inCart: "در سبد", more: "محصول دیگر", fallback: "محصول" },
  en: { cart: "Your cart", empty: "Your cart is empty.", browse: "Browse products", view: "View cart", item: "item", items: "items", inCart: "in cart", more: "more items", fallback: "Product" },
  ar: { cart: "سلة التسوق", empty: "سلة التسوق فارغة.", browse: "تصفح المنتجات", view: "عرض السلة", item: "منتج", items: "منتجات", inCart: "في السلة", more: "منتجات أخرى", fallback: "منتج" }
} as const;

export function CartLink({ locale, className, current = false }: { locale: Locale; className?: string; current?: boolean }) {
  const router = useRouter();
  const [items, setItems] = useState<CartItem[]>([]);
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [mobileTop, setMobileTop] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointerType = useRef<string | null>(null);
  const open = hovered || pinned;
  const count = cartQuantity(items);
  const c = copy[locale];
  const label = locale === "fa" ? "سبد" : locale === "ar" ? "السلة" : "Cart";
  const number = new Intl.NumberFormat(locale === "fa" ? "fa-IR" : locale === "ar" ? "ar" : "en");
  const countLabel = `${number.format(count)} ${count === 1 ? c.item : c.items} ${c.inCart}`;

  useEffect(() => {
    const update = () => setItems(readCart());
    update();
    window.addEventListener("storage", update);
    window.addEventListener(CART_EVENT, update);
    return () => { window.removeEventListener("storage", update); window.removeEventListener(CART_EVENT, update); };
  }, []);

  useEffect(() => () => { if (hoverTimer.current) clearTimeout(hoverTimer.current); }, []);

  useLayoutEffect(() => {
    if (!open) return;
    const position = () => setMobileTop((rootRef.current?.getBoundingClientRect().bottom ?? 0) + 8);
    position();
    window.addEventListener("resize", position);
    return () => window.removeEventListener("resize", position);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsidePress = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) { setPinned(false); setHovered(false); }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setPinned(false); setHovered(false); rootRef.current?.querySelector("button")?.focus(); }
    };
    const closeOnPageScroll = () => { setPinned(false); setHovered(false); };
    document.addEventListener("pointerdown", closeOnOutsidePress);
    document.addEventListener("keydown", closeOnEscape);
    window.addEventListener("scroll", closeOnPageScroll, { passive: true });
    return () => { document.removeEventListener("pointerdown", closeOnOutsidePress); document.removeEventListener("keydown", closeOnEscape); window.removeEventListener("scroll", closeOnPageScroll); };
  }, [open]);

  return <div
    ref={rootRef}
    className={styles.root}
    data-open={open}
    onPointerEnter={(event) => { if (event.pointerType === "mouse") hoverTimer.current = setTimeout(() => setHovered(true), 120); }}
    onPointerLeave={(event) => { if (event.pointerType === "mouse") { if (hoverTimer.current) clearTimeout(hoverTimer.current); setHovered(false); } }}
    onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) { setPinned(false); setHovered(false); } }}
  >
    <button type="button" className={className} aria-label={`${label}: ${number.format(count)}`} aria-expanded={open} aria-controls="cart-preview" aria-current={current ? "page" : undefined} onPointerDown={(event) => { pointerType.current = event.pointerType; }} onClick={() => {
      if (hoverTimer.current) clearTimeout(hoverTimer.current);
      const clickedWithMouse = pointerType.current === "mouse";
      pointerType.current = null;
      if (clickedWithMouse || pinned) {
        setPinned(false);
        setHovered(false);
        router.push(`/${locale}/cart`);
      } else {
        setPinned(true);
      }
    }}>
      <DesignIcon name="bag" /><span>{label}</span><strong>{number.format(count)}</strong>
    </button>
    {open && <section className={styles.panel} id="cart-preview" aria-label={c.cart} style={{ "--cart-preview-top": `${mobileTop}px` } as CSSProperties}>
      <div className={styles.heading}><h2>{c.cart}</h2><span>{countLabel}</span></div>
      {items.length ? <>
        <ul className={styles.items}>{items.slice(0, 3).map((item) => <li key={item.offerId}><span className={styles.itemIcon}><DesignIcon name="bag" /></span><span className={styles.itemName}>{item.productName ?? c.fallback}</span><span className={styles.quantity}>× {number.format(item.quantity)}</span></li>)}</ul>
        {items.length > 3 && <p className={styles.more}>+ {number.format(items.length - 3)} {c.more}</p>}
        <Link className={styles.action} href={current ? "#cart-content" : `/${locale}/cart` as Route} onClick={() => setPinned(false)}>{c.view}<DesignIcon name="arrow" /></Link>
      </> : <><div className={styles.empty}><span className={styles.emptyIcon}><DesignIcon name="bag" /></span><p>{c.empty}</p></div><Link className={styles.action} href={`/${locale}/products` as Route} onClick={() => setPinned(false)}>{c.browse}<DesignIcon name="arrow" /></Link></>}
    </section>}
  </div>;
}
