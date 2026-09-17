"use client";

import Link from "next/link";
import type { Route } from "next";
import { useEffect, useState } from "react";
import type { Locale } from "@/lib/i18n";
import { CART_EVENT, cartQuantity } from "@/lib/cart";

export function CartLink({ locale, className, current = false }: { locale: Locale; className?: string; current?: boolean }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const update = () => setCount(cartQuantity());
    update();
    window.addEventListener("storage", update);
    window.addEventListener(CART_EVENT, update);
    return () => { window.removeEventListener("storage", update); window.removeEventListener(CART_EVENT, update); };
  }, []);
  const label = locale === "fa" ? "سبد" : locale === "ar" ? "السلة" : "Cart";
  return <Link className={className} href={`/${locale}/cart` as Route} aria-label={`${label}: ${count}`} aria-current={current ? "page" : undefined}><span>{label}</span><strong>{count}</strong></Link>;
}
