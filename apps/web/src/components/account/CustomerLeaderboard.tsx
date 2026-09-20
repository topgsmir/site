"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Locale } from "@/lib/i18n";
import { api } from "@/lib/api/client";
import styles from "./CustomerLeaderboard.module.css";
import { AccountIcon } from "./AccountIcon";
import { WORKSPACE_COPY } from "./AccountWorkspaceCopy";

type Leader = { place: number; name: string; score: string; isYou: boolean };
type Board = { leaders: Leader[]; you: { place: number | null; name: string; score: string } };

const copy = {
  fa: { title: "برترین تعمیرکاران کشور", points: "امتیاز", yourRank: "جایگاه شما", unranked: "هنوز رتبه‌ای ندارید", loading: "در حال دریافت رتبه‌ها…", error: "دریافت جدول ممکن نبود.", retry: "تلاش دوباره", empty: "هنوز خرید موفقی ثبت نشده است." },
  en: { title: "Top repairers", points: "points", yourRank: "Your rank", unranked: "Not ranked yet", loading: "Loading ranks…", error: "Could not load the leaderboard.", retry: "Try again", empty: "No successful purchases yet." },
  ar: { title: "أفضل الفنيين في البلاد", points: "نقطة", yourRank: "ترتيبك", unranked: "لا ترتيب بعد", loading: "جارٍ تحميل الترتيب…", error: "تعذر تحميل القائمة.", retry: "حاول مجددًا", empty: "لا توجد مشتريات ناجحة بعد." }
} as const;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.length > 1
    ? `${Array.from(parts[0]!)[0] ?? ""}${Array.from(parts.at(-1)!)[0] ?? ""}`.toLocaleUpperCase()
    : Array.from(parts[0] ?? "").slice(0, 2).join("").toLocaleUpperCase();
}

export function CustomerLeaderboard({ locale }: { locale: Locale }) {
  const c = copy[locale];
  const [board, setBoard] = useState<Board | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const request = useRef<AbortController | null>(null);
  const load = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setError(false);
    try {
      const response = await api.get<Board>("/orders/leaderboard", { signal: controller.signal });
      if (!controller.signal.aborted) setBoard(response.data);
    } catch {
      if (!controller.signal.aborted) setError(true);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);
  useEffect(() => {
    const frame = requestAnimationFrame(() => void load());
    return () => { cancelAnimationFrame(frame); request.current?.abort(); };
  }, [load]);

  const topFour = board?.leaders.slice(0, 4) ?? [];
  const outsideTopFour = board && (board.you.place === null || board.you.place > 4);
  const score = (value: string) => new Intl.NumberFormat(locale).format(BigInt(value));

  return <section className={styles.board} aria-labelledby="leaderboard-title">
    <header className={styles.header}><AccountIcon name="rank" /><div><h2 id="leaderboard-title">{c.title}</h2><p>{WORKSPACE_COPY[locale].pointsHint}</p></div></header>
    {loading && !board ? <div className={styles.skeletons} role="status"><span className="sr-only">{c.loading}</span>{[0, 1, 2].map((item) => <div key={item} className={styles.skeleton} aria-hidden="true"><span /><span /></div>)}</div> : null}
    {error ? <div className={styles.notice} role="alert"><span>{c.error}</span><button type="button" onClick={() => void load()}>{c.retry}</button></div> : null}
    {board && !error ? <>
      {topFour.length ? <ol className={styles.list} aria-label={c.title}>
        {topFour.map((entry) => <li className={styles.row} data-you={entry.isYou || undefined} key={entry.place}>
          <span className={styles.avatar} aria-hidden="true">{initials(entry.name)}</span>
          <div className={styles.person}><strong>{entry.name}</strong><span>#{entry.place.toLocaleString(locale)}</span></div>
          <span className={styles.score}><strong>{score(entry.score)}</strong><small>{c.points}</small></span>
        </li>)}
      </ol> : <p className={styles.notice}>{c.empty}</p>}
      {outsideTopFour ? <div className={styles.yourRow}>
        <span>{c.yourRank}</span>
        <strong>{board.you.place === null ? c.unranked : `#${board.you.place.toLocaleString(locale)} · ${score(board.you.score)} ${c.points}`}</strong>
      </div> : null}
    </> : null}
  </section>;
}
