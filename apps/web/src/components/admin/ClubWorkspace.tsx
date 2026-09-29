"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api/client";
import { formatCurrencyAmount } from "@/lib/currency";
import type { Locale } from "@/lib/i18n";
import styles from "./ClubWorkspace.module.css";

type Settings = { enabled: boolean; points_per_1000_toman: number | null; toman_per_point: number | null; signup_points: number; first_purchase_points: number; min_redeem_points: number | null; max_redeem_points: number | null; expiry_days: number };
type Tier = { id: string; name_fa: string; name_en: string; name_ar: string; threshold_toman: string; sort_order: number; active: boolean };
type Reward = { id: string; name_fa: string; name_en: string; name_ar: string; kind: string; points_cost: number; value: string; max_discount: string | null; min_order: string | null; active: boolean };
type Campaign = { id: string; name_fa: string; name_en: string; name_ar: string; kind: string; value: string; starts_at: string; ends_at: string; min_tier_id: string | null; active: boolean };
type Member = { id: string; full_name: string; club_member: { balance: number; point_debt: number } | null };
type Reports = { members: number; pointsIssued: number; pointsRedeemed: number; pointsExpired: number; pointsOutstanding: number; pointDebt: number;
  walletCreditLiabilityToman: string; platformSubsidyToman: string; eligibleSalesToman: string; rewardedOrders: number; activeCampaigns: number;
  campaignPerformance: Array<{ campaignId: string; orders: number; bonusPoints: number; eligibleSalesToman: string }> };
type Tab = "overview" | "members" | "tiers" | "rewards" | "campaigns";

const copy = {
  fa: { title: "باشگاه مشتریان", overview: "تنظیمات و گزارش", members: "اعضا", tiers: "سطوح", rewards: "جوایز", campaigns: "کمپین‌ها", save: "ذخیره", add: "ایجاد", edit: "ویرایش", active: "فعال", inactive: "غیرفعال", loading: "در حال دریافت باشگاه…", error: "دریافت یا ذخیره اطلاعات باشگاه انجام نشد.", retry: "تلاش دوباره", points: "امتیاز", reason: "دلیل", adjust: "ثبت تغییر امتیاز", until: "تا تاریخ", override: "اعطای سطح موقت", empty: "موردی ثبت نشده است.", more: "نمایش بیشتر", confirm: "تنظیمات باشگاه را ذخیره کنید؟", status: "وضعیت", names: "نام‌ها (فارسی، انگلیسی، عربی)", spend: "آستانه خرید (تومان)", cost: "هزینه امتیاز", value: "مقدار", start: "شروع", end: "پایان", expired: "امتیاز منقضی", rate: "امتیاز / هزار تومان", conversion: "تومان / امتیاز", signup: "امتیاز ثبت‌نام", first: "امتیاز خرید اول", min: "حداقل مصرف", max: "حداکثر مصرف", expiry: "روزهای اعتبار (۳۶۵ = ۱۲ ماه)", type: "نوع", fixed: "تخفیف ثابت", percent: "تخفیف درصدی", wallet: "اعتبار کیف پول", maxDiscount: "سقف تخفیف", minOrder: "حداقل سفارش", bonus: "امتیاز اضافه", multiplier: "ضریب امتیاز", allTiers: "همه سطوح", order: "ترتیب" },
  en: { title: "Customer club", overview: "Setup and reports", members: "Members", tiers: "Tiers", rewards: "Rewards", campaigns: "Campaigns", save: "Save", add: "Create", edit: "Edit", active: "Active", inactive: "Inactive", loading: "Loading club…", error: "Could not load or save club data.", retry: "Try again", points: "Points", reason: "Reason", adjust: "Record point adjustment", until: "Until", override: "Grant temporary tier", empty: "Nothing has been created yet.", more: "Show more", confirm: "Save club settings?", status: "Status", names: "Names (Persian, English, Arabic)", spend: "Spend threshold (Toman)", cost: "Point cost", value: "Value", start: "Start", end: "End", expired: "Expired points", rate: "Points / 1,000 Toman", conversion: "Toman / point", signup: "OTP signup points", first: "First purchase points", min: "Minimum redemption", max: "Maximum redemption", expiry: "Validity days (365 = 12 months)", type: "Type", fixed: "Fixed discount", percent: "Percentage discount", wallet: "Wallet credit", maxDiscount: "Maximum discount", minOrder: "Minimum order", bonus: "Bonus points", multiplier: "Multiplier", allTiers: "All tiers", order: "Order" },
  ar: { title: "نادي العملاء", overview: "الإعداد والتقارير", members: "الأعضاء", tiers: "المستويات", rewards: "المكافآت", campaigns: "الحملات", save: "حفظ", add: "إنشاء", edit: "تعديل", active: "نشط", inactive: "غير نشط", loading: "جارٍ تحميل النادي…", error: "تعذر تحميل أو حفظ بيانات النادي.", retry: "حاول مجددًا", points: "النقاط", reason: "السبب", adjust: "تسجيل تعديل النقاط", until: "حتى", override: "منح مستوى مؤقت", empty: "لا توجد عناصر بعد.", more: "عرض المزيد", confirm: "حفظ إعدادات النادي؟", status: "الحالة", names: "الأسماء (الفارسية، الإنجليزية، العربية)", spend: "حد الإنفاق (تومان)", cost: "تكلفة النقاط", value: "القيمة", start: "البداية", end: "النهاية", expired: "نقاط منتهية", rate: "نقاط / ألف تومان", conversion: "تومان / نقطة", signup: "نقاط التسجيل", first: "نقاط الشراء الأول", min: "الحد الأدنى للاستبدال", max: "الحد الأعلى للاستبدال", expiry: "أيام الصلاحية (٣٦٥ = ١٢ شهرًا)", type: "النوع", fixed: "خصم ثابت", percent: "خصم نسبي", wallet: "رصيد المحفظة", maxDiscount: "سقف الخصم", minOrder: "الحد الأدنى للطلب", bonus: "نقاط إضافية", multiplier: "مضاعف", allTiers: "كل المستويات", order: "الترتيب" }
} as const;

const reportCopy = {
  fa: { outstanding: "امتیاز قابل استفاده", liability: "اعتبار باشگاه در کیف پول", subsidy: "یارانه تخفیف باشگاه", sales: "خرید واجد امتیاز", orders: "سفارش امتیازدار", debt: "بدهی امتیاز", details: "جزئیات عملکرد", campaign: "عملکرد کمپین", bonus: "امتیاز کمپین" },
  en: { outstanding: "Available points", liability: "Club wallet liability", subsidy: "Club discount subsidy", sales: "Eligible sales", orders: "Rewarded orders", debt: "Point debt", details: "Performance details", campaign: "Campaign performance", bonus: "Campaign points" },
  ar: { outstanding: "النقاط المتاحة", liability: "رصيد النادي في المحافظ", subsidy: "دعم خصومات النادي", sales: "المبيعات المؤهلة", orders: "طلبات النقاط", debt: "دين النقاط", details: "تفاصيل الأداء", campaign: "أداء الحملات", bonus: "نقاط الحملات" }
} as const;

const defaultSettings: Settings = { enabled: false, points_per_1000_toman: null, toman_per_point: null, signup_points: 0, first_purchase_points: 0, min_redeem_points: null, max_redeem_points: null, expiry_days: 365 };
const emptyTier: Tier = { id: "", name_fa: "", name_en: "", name_ar: "", threshold_toman: "0", sort_order: 0, active: true };
const emptyReward: Reward = { id: "", name_fa: "", name_en: "", name_ar: "", kind: "wallet", points_cost: 1, value: "1", max_discount: null, min_order: null, active: true };
const emptyCampaign: Campaign = { id: "", name_fa: "", name_en: "", name_ar: "", kind: "bonus", value: "1", starts_at: "", ends_at: "", min_tier_id: null, active: true };
const name = (item: { name_fa: string; name_en: string; name_ar: string }, locale: Locale) => locale === "fa" ? item.name_fa : locale === "ar" ? item.name_ar : item.name_en;
const dateInput = (value: string) => value ? new Date(value).toISOString().slice(0, 16) : "";

export function ClubWorkspace({ locale }: { locale: Locale }) {
  const c = copy[locale];
  const rc = reportCopy[locale];
  const [tab, setTab] = useState<Tab>("overview");
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [reports, setReports] = useState<Reports | null>(null);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [tierForm, setTierForm] = useState<Tier>(emptyTier);
  const [rewardForm, setRewardForm] = useState<Reward>(emptyReward);
  const [campaignForm, setCampaignForm] = useState<Campaign>(emptyCampaign);
  const [selectedMember, setSelectedMember] = useState("");
  const [adjustment, setAdjustment] = useState("");
  const [reason, setReason] = useState("");
  const [overrideTier, setOverrideTier] = useState("");
  const [overrideUntil, setOverrideUntil] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, r, t, w, p, m] = await Promise.all([
        api.get<Settings>("/admin/club/settings"), api.get<Reports>("/admin/club/reports"), api.get<Tier[]>("/admin/club/tiers"),
        api.get<Reward[]>("/admin/club/rewards"), api.get<Campaign[]>("/admin/club/campaigns"), api.get<{ items: Member[]; nextCursor: string | null }>("/admin/club/members")
      ]);
      setSettings(s.data); setReports(r.data); setTiers(t.data); setRewards(w.data); setCampaigns(p.data); setMembers(m.data.items); setNextCursor(m.data.nextCursor); setError("");
    } catch { setError(c.error); }
    finally { setLoading(false); }
  }, [c.error]);
  useEffect(() => { const frame = requestAnimationFrame(() => void load()); return () => cancelAnimationFrame(frame); }, [load]);

  async function saveSettings(event: React.FormEvent) {
    event.preventDefault(); if (settings.enabled && !window.confirm(c.confirm)) return;
    setBusy(true); setError("");
    try {
      await api.patch("/admin/club/settings", { enabled: settings.enabled, pointsPer1000Toman: settings.points_per_1000_toman, tomanPerPoint: settings.toman_per_point,
        signupPoints: settings.signup_points, firstPurchasePoints: settings.first_purchase_points, minRedeemPoints: settings.min_redeem_points,
        maxRedeemPoints: settings.max_redeem_points, expiryDays: settings.expiry_days });
      await load();
    } catch { setError(c.error); }
    finally { setBusy(false); }
  }
  async function saveTier(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try { const body = { nameFa: tierForm.name_fa, nameEn: tierForm.name_en, nameAr: tierForm.name_ar, thresholdToman: tierForm.threshold_toman, sortOrder: tierForm.sort_order, active: tierForm.active };
      if (tierForm.id) await api.put(`/admin/club/tiers/${tierForm.id}`, body); else await api.post("/admin/club/tiers", body);
      setTierForm(emptyTier); await load(); } catch { setError(c.error); } finally { setBusy(false); }
  }
  async function saveReward(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try { const body = { nameFa: rewardForm.name_fa, nameEn: rewardForm.name_en, nameAr: rewardForm.name_ar, kind: rewardForm.kind, pointsCost: rewardForm.points_cost, value: rewardForm.value, maxDiscount: rewardForm.max_discount || undefined, minOrder: rewardForm.min_order || undefined, active: rewardForm.active };
      if (rewardForm.id) await api.put(`/admin/club/rewards/${rewardForm.id}`, body); else await api.post("/admin/club/rewards", body);
      setRewardForm(emptyReward); await load(); } catch { setError(c.error); } finally { setBusy(false); }
  }
  async function saveCampaign(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try { const body = { nameFa: campaignForm.name_fa, nameEn: campaignForm.name_en, nameAr: campaignForm.name_ar, kind: campaignForm.kind, value: campaignForm.value,
        startsAt: new Date(campaignForm.starts_at).toISOString(), endsAt: new Date(campaignForm.ends_at).toISOString(), minTierId: campaignForm.min_tier_id || undefined, active: campaignForm.active };
      if (campaignForm.id) await api.put(`/admin/club/campaigns/${campaignForm.id}`, body); else await api.post("/admin/club/campaigns", body);
      setCampaignForm(emptyCampaign); await load(); } catch { setError(c.error); } finally { setBusy(false); }
  }
  async function adjust(event: React.FormEvent) {
    event.preventDefault(); if (!selectedMember) return;
    setBusy(true); setError("");
    try { await api.post(`/admin/club/members/${selectedMember}/adjustments`, { points: Number(adjustment), reason }, { headers: { "Idempotency-Key": crypto.randomUUID() } }); setAdjustment(""); setReason(""); await load(); }
    catch { setError(c.error); } finally { setBusy(false); }
  }
  async function override(event: React.FormEvent) {
    event.preventDefault(); if (!selectedMember || !overrideTier) return;
    setBusy(true); setError("");
    try { await api.post(`/admin/club/members/${selectedMember}/tier-overrides`, { tierId: overrideTier, until: new Date(overrideUntil).toISOString(), reason }); setReason(""); await load(); }
    catch { setError(c.error); } finally { setBusy(false); }
  }
  async function more() {
    if (!nextCursor) return;
    setBusy(true);
    try { const response = await api.get<{ items: Member[]; nextCursor: string | null }>("/admin/club/members", { params: { cursor: nextCursor } }); setMembers((current) => [...current, ...response.data.items]); setNextCursor(response.data.nextCursor); }
    catch { setError(c.error); } finally { setBusy(false); }
  }

  const names = (value: { name_fa: string; name_en: string; name_ar: string }, change: (key: "name_fa" | "name_en" | "name_ar", next: string) => void) => <div className={styles.names}>{(["name_fa", "name_en", "name_ar"] as const).map((key) => <label key={key}>{key.slice(-2).toUpperCase()}<input required maxLength={100} value={value[key]} onChange={(event) => change(key, event.target.value)} /></label>)}</div>;
  return <div className={styles.club} aria-busy={busy || loading}>
    <header><h1>{c.title}</h1><span>{settings.enabled ? c.active : c.inactive}</span></header>
    <nav aria-label={c.title}>{(["overview", "members", "tiers", "rewards", "campaigns"] as const).map((item) => <button key={item} type="button" aria-current={tab === item ? "page" : undefined} onClick={() => setTab(item)}>{c[item]}</button>)}</nav>
    {error ? <p className={styles.error} role="alert">{error} <button type="button" onClick={() => void load()}>{c.retry}</button></p> : null}
    {loading && !reports ? <p>{c.loading}</p> : null}
    {tab === "overview" ? <><div className={styles.stats}>{reports && ([
      [c.members, reports.members], [c.points + " +", reports.pointsIssued], [c.points + " −", reports.pointsRedeemed], [rc.outstanding, reports.pointsOutstanding], [c.campaigns, reports.activeCampaigns]
    ] as Array<[string, number]>).map(([label, value]) => <div key={label}><span>{label}</span><strong>{new Intl.NumberFormat(locale).format(value)}</strong></div>)}</div>
      {reports ? <details className={styles.reportDetails}><summary>{rc.details}</summary><div>
        {([[c.expired, reports.pointsExpired], [rc.debt, reports.pointDebt], [rc.orders, reports.rewardedOrders]] as Array<[string, number]>).map(([label, value]) => <p key={label}><span>{label}</span><strong>{new Intl.NumberFormat(locale).format(value)}</strong></p>)}
        {([[rc.liability, reports.walletCreditLiabilityToman], [rc.subsidy, reports.platformSubsidyToman], [rc.sales, reports.eligibleSalesToman]] as Array<[string, string]>).map(([label, value]) => <p key={label}><span>{label}</span><strong>{formatCurrencyAmount(value, "TOMAN", locale)}</strong></p>)}
        {reports.campaignPerformance.map((item) => <p key={item.campaignId}><span>{rc.campaign}: {name(campaigns.find((campaign) => campaign.id === item.campaignId) ?? { name_fa: item.campaignId, name_en: item.campaignId, name_ar: item.campaignId }, locale)}</span><strong>{new Intl.NumberFormat(locale).format(item.orders)} {rc.orders} · {new Intl.NumberFormat(locale).format(item.bonusPoints)} {rc.bonus}</strong></p>)}
      </div></details> : null}
      <form className={styles.form} onSubmit={(event) => void saveSettings(event)}><label className={styles.checkbox}><input type="checkbox" checked={settings.enabled} onChange={(event) => setSettings({ ...settings, enabled: event.target.checked })} />{c.active}</label>
        {([ ["points_per_1000_toman", c.rate], ["toman_per_point", c.conversion], ["signup_points", c.signup], ["first_purchase_points", c.first], ["min_redeem_points", c.min], ["max_redeem_points", c.max], ["expiry_days", c.expiry] ] as const).map(([field, label]) => <label key={field}>{label}<input type="number" min={field === "signup_points" || field === "first_purchase_points" ? 0 : 1} required value={settings[field] ?? ""} onChange={(event) => setSettings({ ...settings, [field]: event.target.value === "" ? null : Number(event.target.value) })} /></label>)}
        <button type="submit" disabled={busy}>{c.save}</button></form></> : null}
    {tab === "members" ? <><div className={styles.list}>{members.length ? members.map((member) => <button className={styles.row} key={member.id} type="button" aria-current={selectedMember === member.id ? "true" : undefined} onClick={() => setSelectedMember(member.id)}><span>{member.full_name}</span><strong>{new Intl.NumberFormat(locale).format(member.club_member?.balance ?? 0)} {c.points}</strong></button>) : <p>{c.empty}</p>}{nextCursor ? <button type="button" onClick={() => void more()}>{c.more}</button> : null}</div>{selectedMember ? <div className={styles.memberActions}><form className={styles.form} onSubmit={(event) => void adjust(event)}><h2>{c.adjust}</h2><label>{c.points}<input type="number" required min={-1000000} max={1000000} value={adjustment} onChange={(event) => setAdjustment(event.target.value)} /></label><label>{c.reason}<input required minLength={3} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} /></label><button disabled={busy}>{c.save}</button></form><form className={styles.form} onSubmit={(event) => void override(event)}><h2>{c.override}</h2><label>{c.tiers}<select required value={overrideTier} onChange={(event) => setOverrideTier(event.target.value)}><option value="">—</option>{tiers.filter((tier) => tier.active).map((tier) => <option key={tier.id} value={tier.id}>{name(tier, locale)}</option>)}</select></label><label>{c.until}<input required type="datetime-local" value={overrideUntil} onChange={(event) => setOverrideUntil(event.target.value)} /></label><label>{c.reason}<input required minLength={3} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} /></label><button disabled={busy}>{c.save}</button></form></div> : null}</> : null}
    {tab === "tiers" ? <><div className={styles.list}>{tiers.map((tier) => <button className={styles.row} key={tier.id} type="button" onClick={() => setTierForm(tier)}><span>{name(tier, locale)} · {tier.active ? c.active : c.inactive}</span><strong>{formatCurrencyAmount(tier.threshold_toman, "TOMAN", locale)}</strong></button>)}</div><form className={styles.form} onSubmit={(event) => void saveTier(event)}><h2>{tierForm.id ? c.edit : c.add}</h2>{names(tierForm, (key, value) => setTierForm({ ...tierForm, [key]: value }))}<label>{c.spend}<input required inputMode="numeric" pattern="[0-9]+" value={tierForm.threshold_toman} onChange={(event) => setTierForm({ ...tierForm, threshold_toman: event.target.value })} /></label><label>{c.order}<input required type="number" min="0" value={tierForm.sort_order} onChange={(event) => setTierForm({ ...tierForm, sort_order: Number(event.target.value) })} /></label><label className={styles.checkbox}><input type="checkbox" checked={tierForm.active} onChange={(event) => setTierForm({ ...tierForm, active: event.target.checked })} />{c.active}</label><button disabled={busy}>{c.save}</button></form></> : null}
    {tab === "rewards" ? <><div className={styles.list}>{rewards.map((reward) => <button className={styles.row} key={reward.id} type="button" onClick={() => setRewardForm(reward)}><span>{name(reward, locale)} · {reward.active ? c.active : c.inactive}</span><strong>{reward.points_cost} {c.points}</strong></button>)}</div><form className={styles.form} onSubmit={(event) => void saveReward(event)}><h2>{rewardForm.id ? c.edit : c.add}</h2>{names(rewardForm, (key, value) => setRewardForm({ ...rewardForm, [key]: value }))}<label>{c.type}<select value={rewardForm.kind} onChange={(event) => setRewardForm({ ...rewardForm, kind: event.target.value })}><option value="wallet">{c.wallet}</option><option value="fixed_discount">{c.fixed}</option><option value="percentage_discount">{c.percent}</option></select></label><label>{c.cost}<input required type="number" min="1" value={rewardForm.points_cost} onChange={(event) => setRewardForm({ ...rewardForm, points_cost: Number(event.target.value) })} /></label><label>{c.value}<input required inputMode="numeric" pattern="[0-9]+" value={rewardForm.value} onChange={(event) => setRewardForm({ ...rewardForm, value: event.target.value })} /></label><label>{c.maxDiscount}<input inputMode="numeric" value={rewardForm.max_discount ?? ""} onChange={(event) => setRewardForm({ ...rewardForm, max_discount: event.target.value || null })} /></label><label>{c.minOrder}<input inputMode="numeric" value={rewardForm.min_order ?? ""} onChange={(event) => setRewardForm({ ...rewardForm, min_order: event.target.value || null })} /></label><label className={styles.checkbox}><input type="checkbox" checked={rewardForm.active} onChange={(event) => setRewardForm({ ...rewardForm, active: event.target.checked })} />{c.active}</label><button disabled={busy}>{c.save}</button></form></> : null}
    {tab === "campaigns" ? <><div className={styles.list}>{campaigns.map((campaign) => <button className={styles.row} key={campaign.id} type="button" onClick={() => setCampaignForm(campaign)}><span>{name(campaign, locale)} · {campaign.active ? c.active : c.inactive}</span><strong>{campaign.kind === "bonus" ? c.bonus : c.multiplier}</strong></button>)}</div><form className={styles.form} onSubmit={(event) => void saveCampaign(event)}><h2>{campaignForm.id ? c.edit : c.add}</h2>{names(campaignForm, (key, value) => setCampaignForm({ ...campaignForm, [key]: value }))}<label>{c.type}<select value={campaignForm.kind} onChange={(event) => setCampaignForm({ ...campaignForm, kind: event.target.value })}><option value="bonus">{c.bonus}</option><option value="multiplier">{c.multiplier}</option></select></label><label>{c.value}<input required inputMode="decimal" value={campaignForm.value} onChange={(event) => setCampaignForm({ ...campaignForm, value: event.target.value })} /></label><label>{c.start}<input required type="datetime-local" value={dateInput(campaignForm.starts_at)} onChange={(event) => setCampaignForm({ ...campaignForm, starts_at: event.target.value })} /></label><label>{c.end}<input required type="datetime-local" value={dateInput(campaignForm.ends_at)} onChange={(event) => setCampaignForm({ ...campaignForm, ends_at: event.target.value })} /></label><label>{c.tiers}<select value={campaignForm.min_tier_id ?? ""} onChange={(event) => setCampaignForm({ ...campaignForm, min_tier_id: event.target.value || null })}><option value="">{c.allTiers}</option>{tiers.map((tier) => <option key={tier.id} value={tier.id}>{name(tier, locale)}</option>)}</select></label><label className={styles.checkbox}><input type="checkbox" checked={campaignForm.active} onChange={(event) => setCampaignForm({ ...campaignForm, active: event.target.checked })} />{c.active}</label><button disabled={busy}>{c.save}</button></form></> : null}
  </div>;
}
