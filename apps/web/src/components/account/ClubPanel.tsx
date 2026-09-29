"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api/client";
import { formatCurrencyAmount } from "@/lib/currency";
import type { Locale } from "@/lib/i18n";
import styles from "./ClubPanel.module.css";

type Summary = { enabled: boolean; balance: number; pointDebt: number; rollingSpend: string; expiringPoints: number;
  tier: { nameFa: string; nameEn: string; nameAr: string } | null;
  nextTier: { name_fa: string; name_en: string; name_ar: string; threshold_toman: string } | null };
type Entry = { id: string; delta: number; balance_after: number; kind: string; created_at: string };
type Page = { items: Entry[]; nextCursor: string | null };
type Reward = { id: string; name_fa: string; name_en: string; name_ar: string; kind: string; points_cost: number; value: string };

const copy = {
  fa: { inactive: "باشگاه مشتریان هنوز فعال نشده است.", balance: "امتیاز قابل استفاده", tier: "سطح شما", spend: "خرید ۱۲ ماه گذشته", next: "سطح بعدی", expiry: "امتیازهای در آستانه انقضا", rewards: "جوایز", history: "تاریخچه امتیاز", empty: "هنوز امتیازی ثبت نشده است.", wallet: "تبدیل به اعتبار کیف پول", more: "نمایش بیشتر", loading: "در حال دریافت باشگاه…", error: "اطلاعات باشگاه دریافت نشد.", retry: "تلاش دوباره", success: "اعتبار به کیف پول افزوده شد.", unit: "تومان" },
  en: { inactive: "The customer club is not active yet.", balance: "Available points", tier: "Your tier", spend: "Past 12 months of purchases", next: "Next tier", expiry: "Points expiring soon", rewards: "Rewards", history: "Point history", empty: "No point activity yet.", wallet: "Convert to wallet credit", more: "Show more", loading: "Loading club…", error: "Could not load club details.", retry: "Try again", success: "Credit added to your wallet.", unit: "Toman" },
  ar: { inactive: "نادي العملاء غير مفعل بعد.", balance: "النقاط المتاحة", tier: "مستواك", spend: "مشتريات آخر ١٢ شهرًا", next: "المستوى التالي", expiry: "نقاط ستنتهي قريبًا", rewards: "المكافآت", history: "سجل النقاط", empty: "لا توجد نقاط بعد.", wallet: "تحويل إلى رصيد المحفظة", more: "عرض المزيد", loading: "جارٍ تحميل النادي…", error: "تعذر تحميل بيانات النادي.", retry: "حاول مجددًا", success: "أضيف الرصيد إلى محفظتك.", unit: "تومان" }
} as const;

const historyLabels: Record<Locale, Record<string, string>> = {
  fa: { purchase: "امتیاز خرید", signup: "امتیاز ثبت‌نام", checkout: "مصرف در خرید", wallet_reward: "تبدیل به اعتبار", release: "بازگشت امتیاز", reversal: "برگشت خرید", expiry: "انقضای امتیاز", admin_award: "امتیاز مدیر", admin_debit: "کسر توسط مدیر" },
  en: { purchase: "Purchase points", signup: "Signup points", checkout: "Checkout redemption", wallet_reward: "Wallet credit", release: "Points returned", reversal: "Purchase reversal", expiry: "Points expired", admin_award: "Admin award", admin_debit: "Admin adjustment" },
  ar: { purchase: "نقاط الشراء", signup: "نقاط التسجيل", checkout: "استبدال عند الشراء", wallet_reward: "رصيد المحفظة", release: "إعادة النقاط", reversal: "عكس الشراء", expiry: "انتهاء النقاط", admin_award: "إضافة المشرف", admin_debit: "خصم المشرف" }
};

export function ClubPanel({ locale }: { locale: Locale }) {
  const c = copy[locale];
  const [summary, setSummary] = useState<Summary | null>(null);
  const [history, setHistory] = useState<Page>({ items: [], nextCursor: null });
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const key = useRef(crypto.randomUUID());
  const name = (item: { name_fa: string; name_en: string; name_ar: string }) => locale === "fa" ? item.name_fa : locale === "ar" ? item.name_ar : item.name_en;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [profile, entries, available] = await Promise.all([api.get<Summary>("/club/me"), api.get<Page>("/club/me/history"), api.get<Reward[]>("/club/rewards")]);
      setSummary(profile.data); setHistory(entries.data); setRewards(available.data); setError("");
    } catch { setError(c.error); }
    finally { setLoading(false); }
  }, [c.error]);
  useEffect(() => { const frame = requestAnimationFrame(() => void load()); return () => cancelAnimationFrame(frame); }, [load]);

  async function redeem(reward: Reward) {
    setBusy(true); setError(""); setNotice("");
    try {
      await api.post("/club/me/wallet-redemptions", { rewardId: reward.id }, { headers: { "Idempotency-Key": key.current } });
      key.current = crypto.randomUUID(); setNotice(c.success); await load();
    } catch { setError(c.error); }
    finally { setBusy(false); }
  }
  async function more() {
    if (!history.nextCursor) return;
    setBusy(true);
    try { const response = await api.get<Page>("/club/me/history", { params: { cursor: history.nextCursor } }); setHistory((current) => ({ items: [...current.items, ...response.data.items], nextCursor: response.data.nextCursor })); }
    catch { setError(c.error); }
    finally { setBusy(false); }
  }

  return <div className={styles.club} aria-busy={loading || busy}>
    {error ? <p className={styles.error} role="alert">{error} <button type="button" onClick={() => void load()}>{c.retry}</button></p> : null}
    {notice ? <p className={styles.notice} role="status">{notice}</p> : null}
    {!summary && loading ? <p>{c.loading}</p> : summary && !summary.enabled ? <p>{c.inactive}</p> : summary ? <>
      <div className={styles.stats}>
        <div><span>{c.balance}</span><strong>{new Intl.NumberFormat(locale).format(summary.balance)}</strong></div>
        <div><span>{c.tier}</span><strong>{summary.tier ? (locale === "fa" ? summary.tier.nameFa : locale === "ar" ? summary.tier.nameAr : summary.tier.nameEn) : "—"}</strong></div>
        <div><span>{c.spend}</span><strong>{formatCurrencyAmount(summary.rollingSpend, "TOMAN", locale)} <small>{c.unit}</small></strong></div>
        <div><span>{c.expiry}</span><strong>{new Intl.NumberFormat(locale).format(summary.expiringPoints)}</strong></div>
      </div>
      {summary.nextTier ? <p className={styles.progress}>{c.next}: {name(summary.nextTier)} · {formatCurrencyAmount(summary.nextTier.threshold_toman, "TOMAN", locale)} {c.unit}</p> : null}
      <section><h2>{c.rewards}</h2><div className={styles.rewards}>{rewards.length ? rewards.map((reward) => <div key={reward.id} className={styles.reward}><div><strong>{name(reward)}</strong><small>{new Intl.NumberFormat(locale).format(reward.points_cost)} {c.balance}</small></div>{reward.kind === "wallet" ? <button type="button" disabled={busy || summary.balance < reward.points_cost} onClick={() => void redeem(reward)}>{c.wallet}</button> : null}</div>) : <p>{c.empty}</p>}</div></section>
      <section><h2>{c.history}</h2>{history.items.length ? <div className={styles.history}>{history.items.map((entry) => <div key={entry.id}><span>{historyLabels[locale][entry.kind] ?? entry.kind}</span><time dateTime={entry.created_at}>{new Date(entry.created_at).toLocaleDateString(locale)}</time><strong dir="ltr">{entry.delta > 0 ? "+" : ""}{new Intl.NumberFormat(locale).format(entry.delta)}</strong></div>)}</div> : <p>{c.empty}</p>}{history.nextCursor ? <button className={styles.more} type="button" disabled={busy} onClick={() => void more()}>{c.more}</button> : null}</section>
    </> : null}
  </div>;
}
