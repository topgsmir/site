"use client";

import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import type { PublicExpertSummary } from "@topgsm/shared-types";
import { DesignIcon } from "@/components/DesignIcon";
import { sellerAvatarLetters } from "@/components/seller/SellerAvatar";
import type { Locale } from "@/lib/i18n";
import styles from "./ExpertGrid.module.css";

const copy = {
  fa: { verified: "کارشناس تأییدشده", specialist: "متخصص مجموعه", profile: "مشاهده پروفایل", previous: "متخصص قبلی", next: "متخصص بعدی", cards: "متخصصین مجموعه؛ برای دیدن موارد بیشتر با کلیدهای جهت‌دار حرکت کنید", count: (total: string) => `${total} متخصص` },
  en: { verified: "Verified expert", specialist: "Team specialist", profile: "View profile", previous: "Previous specialist", next: "Next specialist", cards: "Team specialists; use arrow keys to browse", count: (total: string) => `${total} specialists` },
  ar: { verified: "خبير معتمد", specialist: "متخصص في الفريق", profile: "عرض الملف", previous: "المتخصص السابق", next: "المتخصص التالي", cards: "متخصصو الفريق؛ استخدم مفاتيح الأسهم للتصفح", count: (total: string) => `${total} متخصصين` }
} as const;

function ExpertPortrait({ expert, locale }: { expert: PublicExpertSummary; locale: Locale }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const picture = expert.profilePicture;
  const initials = sellerAvatarLetters(expert.name, locale);

  return <span className={styles.portrait} aria-hidden="true">
    {picture && failedUrl !== picture.url
      ? <Image src={picture.url} alt="" width={80} height={80} sizes="(max-width: 480px) 72px, 80px" onError={() => setFailedUrl(picture.url)} />
      : <span className={styles.initials}>{initials}</span>}
  </span>;
}

export function ExpertGrid({ experts, locale }: { experts: PublicExpertSummary[]; locale: Locale }) {
  const trackRef = useRef<HTMLUListElement>(null);
  const [navigation, setNavigation] = useState({ previous: false, next: experts.length > 1 });
  const gridId = useId();
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
  }, [updateNavigation, experts.length]);

  const slide = (direction: "previous" | "next") => {
    const track = trackRef.current;
    if (!track) return;
    const bounds = track.getBoundingClientRect();
    const startEdge = isRtl ? bounds.right : bounds.left;
    const travel = direction === "next" ? (isRtl ? -1 : 1) : (isRtl ? 1 : -1);
    const target = Array.from(track.children, (card) => {
      const edge = card.getBoundingClientRect();
      return { card, distance: (isRtl ? edge.right : edge.left) - startEdge };
    }).filter(({ distance }) => distance * travel > 4)
      .sort((a, b) => Math.abs(a.distance) - Math.abs(b.distance))[0];
    if (!target) return;
    target.card.scrollIntoView({ inline: "start", block: "nearest", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  };

  const onTrackKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    if (event.target !== event.currentTarget || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    slide(event.key === (isRtl ? "ArrowLeft" : "ArrowRight") ? "next" : "previous");
  };

  return <div className={styles.directory}>
    {experts.length > 1 && <div className={styles.toolbar}>
      <p>{c.count(new Intl.NumberFormat(locale).format(experts.length))}</p>
      <div className={styles.controls}>
        <button type="button" className={styles.previous} aria-label={c.previous} aria-controls={gridId} disabled={!navigation.previous} onClick={() => slide("previous")}><DesignIcon name="arrow" /></button>
        <button type="button" className={styles.next} aria-label={c.next} aria-controls={gridId} disabled={!navigation.next} onClick={() => slide("next")}><DesignIcon name="arrow" /></button>
      </div>
    </div>}
    <ul ref={trackRef} className={styles.grid} id={gridId} role="list" tabIndex={navigation.previous || navigation.next ? 0 : -1} aria-label={c.cards} onScroll={updateNavigation} onKeyDown={onTrackKeyDown}>
      {experts.map((expert) => <li key={expert.id}>
        <Link className={styles.expert} href={`/${locale}/experts/${expert.id}` as Route} prefetch={false}>
          <span className={styles.portraitWrap}>
            <ExpertPortrait expert={expert} locale={locale} />
            <span className={styles.verified} role="img" aria-label={c.verified} title={c.verified}><DesignIcon name="check" /></span>
          </span>
          <div className={styles.expertContent}>
            <h3 dir="auto">{expert.name}</h3>
            <p className={styles.specialty} dir="auto">{expert.specialty?.trim() || c.specialist}</p>
            <span className={styles.profileAction}>{c.profile}<DesignIcon name="arrow" /></span>
          </div>
        </Link>
      </li>)}
    </ul>
  </div>;
}
