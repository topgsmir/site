"use client";

import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import type { PublicProductSummary } from "@topgsm/shared-types";
import { DesignIcon } from "@/components/DesignIcon";
import { currencyLabel, formatCurrencyAmount } from "@/lib/currency";
import type { Locale } from "@/lib/i18n";
import styles from "./ExpertProfile.module.css";

const copy = {
  fa: { previous: "محصولات قبلی", next: "محصولات بعدی", cards: "محصولات این بخش. با دکمه‌ها یا کشیدن، بقیه را ببینید", from: "از", details: "مشاهده", digital: "فایل و آموزش", physical: "محصول فیزیکی", service: "خدمات", bridge: "خرید واسطه‌ای" },
  en: { previous: "Previous products", next: "Next products", cards: "Products in this section. Use the buttons or swipe to see more", from: "From", details: "View", digital: "Files and training", physical: "Physical product", service: "Service", bridge: "Assisted purchase" },
  ar: { previous: "المنتجات السابقة", next: "المنتجات التالية", cards: "منتجات هذا القسم. استخدم الأزرار أو اسحب لرؤية المزيد", from: "من", details: "عرض", digital: "ملفات وتدريب", physical: "منتج فعلي", service: "خدمة", bridge: "شراء بالوساطة" }
} as const;

export function ExpertProductSlider({
  locale,
  title,
  sectionId,
  products
}: {
  locale: Locale;
  title: string;
  sectionId: string;
  products: PublicProductSummary[];
}) {
  const trackRef = useRef<HTMLUListElement>(null);
  const [navigation, setNavigation] = useState({ previous: false, next: products.length > 1 });
  const trackId = useId();
  const c = copy[locale];
  const isRtl = locale !== "en";

  const updateNavigation = useCallback(() => {
    const track = trackRef.current;
    if (!track?.firstElementChild || !track.lastElementChild) return;
    const bounds = track.getBoundingClientRect();
    const first = track.firstElementChild.getBoundingClientRect();
    const last = track.lastElementChild.getBoundingClientRect();
    setNavigation({
      previous: isRtl ? first.right > bounds.right + 2 : first.left < bounds.left - 2,
      next: isRtl ? last.left < bounds.left - 2 : last.right > bounds.right + 2
    });
  }, [isRtl]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const observer = new ResizeObserver(updateNavigation);
    observer.observe(track);
    updateNavigation();
    return () => observer.disconnect();
  }, [updateNavigation, products.length]);

  const slide = (direction: "previous" | "next") => {
    const track = trackRef.current;
    if (!track) return;
    const start = track.getBoundingClientRect();
    const startEdge = isRtl ? start.right : start.left;
    const travel = direction === "next" ? (isRtl ? -1 : 1) : (isRtl ? 1 : -1);
    const target = Array.from(track.children, (card) => {
      const bounds = card.getBoundingClientRect();
      return (isRtl ? bounds.right : bounds.left) - startEdge;
    }).filter((distance) => distance * travel > 4)
      .sort((left, right) => Math.abs(left) - Math.abs(right))[0];
    if (target === undefined) return;
    track.scrollBy({ left: target, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  };

  const onTrackKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    if (event.target !== event.currentTarget || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    slide(event.key === (isRtl ? "ArrowLeft" : "ArrowRight") ? "next" : "previous");
  };

  const canSlide = navigation.previous || navigation.next;

  return <section className={styles.slider} aria-labelledby={`section-${sectionId}`}>
    <div className={styles.sliderHead}>
      <h2 id={`section-${sectionId}`}>{title}</h2>
    </div>
    <div className={styles.sliderFrame}>
      {products.length > 1 ? <>
        <button type="button" className={`${styles.control} ${styles.previous}`} aria-label={c.previous} aria-controls={trackId} disabled={!navigation.previous} onClick={() => slide("previous")}><DesignIcon name="arrow" /></button>
        <button type="button" className={`${styles.control} ${styles.next}`} aria-label={c.next} aria-controls={trackId} disabled={!navigation.next} onClick={() => slide("next")}><DesignIcon name="arrow" /></button>
      </> : null}
      <ul
        ref={trackRef}
        id={trackId}
        className={styles.track}
        tabIndex={canSlide ? 0 : -1}
        aria-label={c.cards}
        onScroll={updateNavigation}
        onKeyDown={onTrackKeyDown}
      >
        {products.map((product) => {
          const starting = product.startingPrices[0];
          const image = product.image?.variants[0];
          return <li key={product.id}>
            <Link className={styles.product} href={`/${locale}/products/${product.slug}` as Route} data-type={product.type}>
              <span className={styles.thumb}>{image ? <Image unoptimized src={image.url} alt="" width={image.width} height={image.height} /> : <DesignIcon name={product.type === "digital" ? "file" : product.type === "service" ? "headphones" : "layers"} />}</span>
              <span className={styles.productCopy}>
                <span className={styles.kind}>{c[product.type]}</span>
                <h3>{product.title}</h3>
                <span className={styles.price}>{starting ? `${c.from} ${formatCurrencyAmount(starting.price, starting.currency, locale)} ${currencyLabel(starting.currency)}` : c.details}</span>
              </span>
            </Link>
          </li>;
        })}
      </ul>
    </div>
  </section>;
}
