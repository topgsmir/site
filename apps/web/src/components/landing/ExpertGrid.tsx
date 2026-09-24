"use client";

import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";
import { useId, useState } from "react";
import type { PublicExpertSummary } from "@topgsm/shared-types";
import { DesignIcon } from "@/components/DesignIcon";
import type { Locale } from "@/lib/i18n";
import styles from "./ExpertGrid.module.css";

const PREVIEW_COUNT = 6;
const copy = {
  fa: { verified: "کارشناس تأییدشده", active: "محصول فعال", profile: "مشاهده پروفایل", all: "نمایش همه متخصصان", less: "نمایش کمتر", count: (shown: string, total: string) => `${shown} از ${total} متخصص` },
  en: { verified: "Verified expert", active: "active products", profile: "View profile", all: "Show all experts", less: "Show fewer", count: (shown: string, total: string) => `${shown} of ${total} experts` },
  ar: { verified: "خبير معتمد", active: "منتج نشط", profile: "عرض الملف", all: "عرض جميع الخبراء", less: "عرض أقل", count: (shown: string, total: string) => `${shown} من ${total} خبراء` }
} as const;

function ExpertPortrait({ expert }: { expert: PublicExpertSummary }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const picture = expert.profilePicture;
  const initials = expert.name.trim().split(/\s+/).slice(0, 2).map((part) => Array.from(part)[0]).join("");

  return <span className={styles.portrait} aria-hidden="true">
    {picture && failedUrl !== picture.url
      ? <Image src={picture.url} alt="" width={80} height={80} sizes="(max-width: 480px) 72px, 80px" onError={() => setFailedUrl(picture.url)} />
      : <span className={styles.initials}>{initials}</span>}
  </span>;
}

export function ExpertGrid({ experts, locale }: { experts: PublicExpertSummary[]; locale: Locale }) {
  const [expanded, setExpanded] = useState(false);
  const gridId = useId();
  const c = copy[locale];
  const number = new Intl.NumberFormat(locale);
  const shown = expanded ? experts.length : Math.min(PREVIEW_COUNT, experts.length);

  return <div className={styles.directory}>
    {experts.length > PREVIEW_COUNT && <div className={styles.toolbar}>
      <p role="status">{c.count(number.format(shown), number.format(experts.length))}</p>
      <button type="button" aria-expanded={expanded} aria-controls={gridId} onClick={() => setExpanded(!expanded)}>
        {expanded ? c.less : c.all}<span className={styles.toggleIcon} aria-hidden="true">{expanded ? "−" : "+"}</span>
      </button>
    </div>}
    <ul className={styles.grid} id={gridId} role="list">
      {experts.map((expert, index) => <li key={expert.id} hidden={index >= shown}>
        <Link className={styles.expert} href={`/${locale}/experts/${expert.id}` as Route} prefetch={false} aria-label={`${c.profile}: ${expert.name}`}>
          <span className={styles.portraitWrap}>
            <ExpertPortrait expert={expert} />
            <span className={styles.verified} role="img" aria-label={c.verified} title={c.verified}><DesignIcon name="check" /></span>
          </span>
          <h3 dir="auto">{expert.name}</h3>
          <p className={styles.specialty} dir="auto">{expert.specialty?.trim() || c.verified}</p>
        </Link>
      </li>)}
    </ul>
  </div>;
}
