"use client";

import { scheduleEffectTask } from "@/lib/effect-task";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { AdminSellerShippingProfilesPage, AdminShippingPolicy, ShippingPolicyRule } from "@topgsm/shared-types";
import type { Locale } from "@/lib/i18n";
import { api } from "@/lib/api/client";
import styles from "./ShippingPolicyWorkspace.module.css";

const copy = {
  en: { title: "Postal delivery rules", hint: "Rates are per physical order and use toman. Seller rules replace the default rule.", payer: "Who pays", customer: "Customer", seller: "Seller", site: "Site", rate: "Flat postal rate (toman)", free: "Free above order subtotal (toman)", freeHint: "Leave blank to disable the threshold.", provinces: "Allowed destination provinces", provincesHint: "Comma separated; leave blank for all provinces.", weight: "Maximum parcel weight (g)", length: "Maximum length (cm)", width: "Maximum width (cm)", height: "Maximum height (cm)", limitsHint: "Leave a limit blank to allow any value. Products need recorded dimensions when a dimension limit applies.", overrides: "Seller rules", search: "Find a seller by shop name", add: "Add seller rule", remove: "Remove", save: "Save delivery rules", saving: "Saving…", saved: "Delivery rules saved.", loadError: "Delivery rules could not be loaded.", saveError: "Delivery rules could not be saved. Check the values and reload if another admin changed them.", retry: "Retry", none: "No seller rules." },
  fa: { title: "قوانین ارسال پستی", hint: "هزینه برای هر سفارش فیزیکی و به تومان است. قانون فروشنده جایگزین قانون پیش‌فرض می‌شود.", payer: "پرداخت‌کننده هزینه", customer: "مشتری", seller: "فروشنده", site: "سایت", rate: "هزینه ثابت پست (تومان)", free: "ارسال رایگان از مبلغ سفارش (تومان)", freeHint: "برای غیرفعال بودن شرط، خالی بگذارید.", provinces: "استان‌های مقصد مجاز", provincesHint: "با ویرگول جدا کنید؛ خالی یعنی همه استان‌ها.", weight: "حداکثر وزن بسته (گرم)", length: "حداکثر طول (سانتی‌متر)", width: "حداکثر عرض (سانتی‌متر)", height: "حداکثر ارتفاع (سانتی‌متر)", limitsHint: "حد خالی یعنی بدون محدودیت. برای اعمال محدودیت ابعاد، ابعاد محصول باید ثبت شده باشد.", overrides: "قوانین فروشندگان", search: "جست‌وجوی نام فروشگاه", add: "افزودن قانون فروشنده", remove: "حذف", save: "ذخیره قوانین ارسال", saving: "در حال ذخیره…", saved: "قوانین ارسال ذخیره شد.", loadError: "قوانین ارسال بارگذاری نشد.", saveError: "ذخیره قوانین ارسال ممکن نبود. مقدارها را بررسی کنید و اگر مدیر دیگری تغییر داده، صفحه را تازه کنید.", retry: "تلاش دوباره", none: "قانونی برای فروشنده ثبت نشده است." },
  ar: { title: "قواعد الشحن البريدي", hint: "التكلفة لكل طلب مادي وبالتومان. تحل قاعدة البائع محل القاعدة الافتراضية.", payer: "من يدفع", customer: "العميل", seller: "البائع", site: "الموقع", rate: "تكلفة البريد الثابتة (تومان)", free: "شحن مجاني فوق إجمالي الطلب (تومان)", freeHint: "اتركه فارغاً لتعطيل الشرط.", provinces: "المحافظات المسموح بالشحن إليها", provincesHint: "افصل بفواصل، واتركه فارغاً للسماح بالجميع.", weight: "الوزن الأقصى للطرد (غ)", length: "الطول الأقصى (سم)", width: "العرض الأقصى (سم)", height: "الارتفاع الأقصى (سم)", limitsHint: "الحد الفارغ غير مقيّد. يجب تسجيل أبعاد المنتج عند تفعيل حد الأبعاد.", overrides: "قواعد البائعين", search: "ابحث باسم المتجر", add: "إضافة قاعدة بائع", remove: "إزالة", save: "حفظ قواعد الشحن", saving: "جارٍ الحفظ…", saved: "تم حفظ قواعد الشحن.", loadError: "تعذر تحميل قواعد الشحن.", saveError: "تعذر حفظ القواعد. تحقق من القيم وحدّث الصفحة إذا عدلها مدير آخر.", retry: "إعادة المحاولة", none: "لا توجد قواعد للبائعين." }
} as const;

type RuleKey = keyof ShippingPolicyRule;
function RuleEditor({ locale, rule, onChange }: { locale: Locale; rule: ShippingPolicyRule; onChange: (value: ShippingPolicyRule) => void }) {
  const c = copy[locale];
  const [provinceText, setProvinceText] = useState(rule.allowedProvinces.join(", "));
  const set = <K extends RuleKey>(key: K, value: ShippingPolicyRule[K]) => onChange({ ...rule, [key]: value });
  const number = (key: "maxWeightGrams" | "maxLengthCm" | "maxWidthCm" | "maxHeightCm", label: string, max: number) => <label><span>{label}</span><input type="number" min={key === "maxWeightGrams" ? 10 : 1} max={max} step={1} value={rule[key] ?? ""} onChange={(event) => set(key, event.target.value ? Number(event.target.value) : null)} /></label>;
  return <div className={styles.fields}>
    <label><span>{c.payer}</span><select value={rule.payer} onChange={(event) => set("payer", event.target.value as ShippingPolicyRule["payer"])}><option value="customer">{c.customer}</option><option value="seller">{c.seller}</option><option value="site">{c.site}</option></select></label>
    <label><span>{c.rate}</span><input required type="number" min={0} max={999999999999} step={1} value={rule.flatRateToman} onChange={(event) => set("flatRateToman", event.target.value)} /></label>
    <label><span>{c.free}</span><input type="number" min={0} max={999999999999} step={1} value={rule.freeAboveToman ?? ""} onChange={(event) => set("freeAboveToman", event.target.value || null)} /><small>{c.freeHint}</small></label>
    <label><span>{c.provinces}</span><input value={provinceText} onChange={(event) => { setProvinceText(event.target.value); set("allowedProvinces", event.target.value.split(/[,،]/).map((value) => value.trim()).filter(Boolean)); }} /><small>{c.provincesHint}</small></label>
    {number("maxWeightGrams", c.weight, 2_000_000)}{number("maxLengthCm", c.length, 1_000)}{number("maxWidthCm", c.width, 1_000)}{number("maxHeightCm", c.height, 1_000)}
  </div>;
}

export function ShippingPolicyWorkspace({ locale }: { locale: Locale }) {
  const c = copy[locale];
  const [policy, setPolicy] = useState<AdminShippingPolicy | null>(null);
  const [search, setSearch] = useState("");
  const [options, setOptions] = useState<Array<{ sellerId: string; shopName: string }>>([]);
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const load = useCallback(async () => {
    try { setPolicy((await api.get<AdminShippingPolicy>("/admin/settings/shipping/policy")).data); setError(""); }
    catch { setError(c.loadError); }
  }, [c.loadError]);
  useEffect(() => scheduleEffectTask(() => { void load(); }), [load]);
  useEffect(() => {
    if (!search.trim()) return;
    let current = true;
    const timer = window.setTimeout(() => { void api.get<AdminSellerShippingProfilesPage>("/admin/settings/shipping/profiles", { params: { search: search.trim(), limit: 20 } }).then((response) => { if (current) setOptions(response.data.items.map(({ sellerId, shopName }) => ({ sellerId, shopName }))); }).catch(() => { if (current) setOptions([]); }); }, 250);
    return () => { current = false; window.clearTimeout(timer); };
  }, [search]);
  const changeRule = (sellerId: string | null, rule: ShippingPolicyRule) => setPolicy((current) => current ? sellerId ? { ...current, sellerRules: current.sellerRules.map((item) => item.sellerId === sellerId ? { ...item, rule } : item) } : { ...current, defaultRule: rule } : null);
  const add = () => { if (!policy || !selected || policy.sellerRules.some((item) => item.sellerId === selected)) return; setPolicy({ ...policy, sellerRules: [...policy.sellerRules, { sellerId: selected, rule: { ...policy.defaultRule, allowedProvinces: [...policy.defaultRule.allowedProvinces] } }] }); setSelected(""); setSearch(""); };
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!policy) return;
    setBusy(true); setError(""); setMessage("");
    try { setPolicy((await api.patch<AdminShippingPolicy>("/admin/settings/shipping/policy", policy)).data); setMessage(c.saved); }
    catch { setError(c.saveError); }
    finally { setBusy(false); }
  }
  return <section className={styles.section} aria-labelledby="postal-policy-title"><header><div><h2 id="postal-policy-title">{c.title}</h2><p>{c.hint}</p></div></header>
    {!policy ? <p role={error ? "alert" : "status"}>{error || "…"} {error ? <button type="button" onClick={() => void load()}>{c.retry}</button> : null}</p> : <form onSubmit={save}>
      <RuleEditor locale={locale} rule={policy.defaultRule} onChange={(rule) => changeRule(null, rule)} />
      <p className={styles.hint}>{c.limitsHint}</p>
      <details className={styles.overrides}><summary>{c.overrides} ({policy.sellerRules.length})</summary>
        <div className={styles.sellerSearch}><label><span>{c.search}</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} /></label><select aria-label={c.search} value={selected} onChange={(event) => setSelected(event.target.value)}><option value="">—</option>{options.filter((item) => !policy.sellerRules.some((rule) => rule.sellerId === item.sellerId)).map((item) => <option key={item.sellerId} value={item.sellerId}>{item.shopName}</option>)}</select><button type="button" disabled={!selected} onClick={add}>{c.add}</button></div>
        {!policy.sellerRules.length ? <p>{c.none}</p> : policy.sellerRules.map((item) => <fieldset key={item.sellerId}><legend>{options.find((option) => option.sellerId === item.sellerId)?.shopName ?? item.sellerId}</legend><RuleEditor locale={locale} rule={item.rule} onChange={(rule) => changeRule(item.sellerId, rule)} /><button type="button" onClick={() => setPolicy((current) => current ? { ...current, sellerRules: current.sellerRules.filter((entry) => entry.sellerId !== item.sellerId) } : null)}>{c.remove}</button></fieldset>)}
      </details>
      <footer><span role={error ? "alert" : "status"}>{error || message}</span><button type="submit" disabled={busy}>{busy ? c.saving : c.save}</button></footer>
    </form>}
  </section>;
}
