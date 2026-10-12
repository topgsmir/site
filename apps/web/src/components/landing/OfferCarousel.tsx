"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";
import type { HomepageContent } from "@topgsm/shared-types";
import { DesignIcon, type DesignIconName } from "@/components/DesignIcon";
import type { Locale } from "@/lib/i18n";
import styles from "./LandingPage.module.css";

type Props = {
  locale: Locale;
  offers: HomepageContent["offers"];
  featuredLabel: string;
  allLabel: string;
  detailsLabel: string;
  shopHref: string;
};

const icons: DesignIconName[] = ["headphones", "file", "layers"];
const navigationLabels = {
  fa: { previous: "پیشنهاد قبلی", next: "پیشنهاد بعدی", cards: "پیشنهادات داغ؛ برای دیدن موارد بیشتر با کلیدهای جهت‌دار حرکت کنید" },
  en: { previous: "Previous offer", next: "Next offer", cards: "Featured offers; use arrow keys to browse" },
  ar: { previous: "العرض السابق", next: "العرض التالي", cards: "العروض المختارة؛ استخدم مفاتيح الأسهم للتصفح" }
} as const;

export function OfferCarousel({ locale, offers, featuredLabel, allLabel, detailsLabel, shopHref }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [navigation, setNavigation] = useState({ previous: false, next: offers.items.length > 1 });
  const isRtl = locale !== "en";

  const updateNavigation = useCallback(() => {
    const track = trackRef.current;
    if (!track || !track.firstElementChild || !track.lastElementChild) return;
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
  }, [updateNavigation, offers.items.length]);

  const slide = (direction: "previous" | "next") => {
    const track = trackRef.current;
    if (!track) return;
    const start = track.getBoundingClientRect();
    const startEdge = isRtl ? start.right : start.left;
    const edges = Array.from(track.children, (card) => {
      const bounds = card.getBoundingClientRect();
      return isRtl ? bounds.right : bounds.left;
    });
    const travel = direction === "next" ? (isRtl ? -1 : 1) : (isRtl ? 1 : -1);
    const target = edges
      .map((edge) => edge - startEdge)
      .filter((distance) => distance * travel > 4)
      .sort((a, b) => Math.abs(a) - Math.abs(b))[0];
    if (target === undefined) return;
    track.scrollBy({ left: target, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  };

  const onTrackKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    slide(event.key === (isRtl ? "ArrowLeft" : "ArrowRight") ? "next" : "previous");
  };

  return <section className={styles.offerSection} id="offers" aria-labelledby="offers-title">
    <div className={styles.sectionHeading}>
      <div><p className={styles.sectionLabel}><DesignIcon name="spark" />{featuredLabel}</p><h2 id="offers-title">{offers.title}</h2><p>{offers.description}</p></div>
      <div className={styles.offerHeaderActions}>
        <Link className={styles.textLink} href={shopHref as Route}>{allLabel}<DesignIcon name="arrow" /></Link>
        <div className={styles.offerControls}>
          <button type="button" className={styles.offerPrevious} aria-label={navigationLabels[locale].previous} aria-controls="offer-cards" disabled={!navigation.previous} onClick={() => slide("previous")}><DesignIcon name="arrow" /></button>
          <button type="button" className={styles.offerNext} aria-label={navigationLabels[locale].next} aria-controls="offer-cards" disabled={!navigation.next} onClick={() => slide("next")}><DesignIcon name="arrow" /></button>
        </div>
      </div>
    </div>
    <div ref={trackRef} id="offer-cards" className={styles.offers} tabIndex={0} aria-label={navigationLabels[locale].cards} onScroll={updateNavigation} onKeyDown={onTrackKeyDown}>
      {offers.items.map((item, index) => <a href={item.href} className={styles.offer} key={`${item.href}-${index}`}>
        <div className={styles.offerArtwork} data-variant={index % 4}>{item.image ? <Image src={item.image} alt="" fill sizes="(max-width: 760px) 82vw, (max-width: 1050px) 32vw, 25vw" /> : <><span className={styles.toolMark}><DesignIcon name={icons[index % 3]} /></span><strong dir="auto">{item.label || item.title}</strong></>}</div>
        <div className={styles.offerBody}><h3 dir="auto">{item.title}</h3><p>{item.description}</p><span className={styles.cardLink}>{detailsLabel}<DesignIcon name="arrow" /></span></div>
      </a>)}
    </div>
  </section>;
}
