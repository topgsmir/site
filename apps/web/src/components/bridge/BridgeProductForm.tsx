"use client";

import type { BridgeGrantSummary } from "@topgsm/shared-types";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { api } from "@/lib/api/client";
import type { Locale } from "@/lib/i18n";
import styles from "./BridgeWorkspace.module.css";

const TEXT = {
  en: { eyebrow: "Bridge product", title: "Turn one approved service into your offer.", back: "Bridge workspace", service: "Approved service", basics: "Product details", name: "Product title", category: "Category", description: "Description", kind: "Product kind", simple: "Simple", variable: "Variable", variant: "Variant", add: "Add variant", remove: "Remove", price: "Price (IRR)", mode: "Fulfilment", automatic: "Automatic", manual: "Manual", min: "Minimum quantity", max: "Maximum quantity", publish: "Publishing", active: "Publish when permitted", draft: "Save as draft", labels: "Buyer-field labels", labelHelp: "Change the buyer-facing wording only. Provider keys, types, and choices stay protected.", submit: "Create product", sending: "Creating…", error: "The product could not be created.", empty: "No active grant is available. Synchronize a connection and ask an administrator to grant a service.", option: "Variant option", value: "Option value" },
  fa: { eyebrow: "محصول Bridge", title: "یک سرویس تأییدشده را به پیشنهاد فروش خود تبدیل کنید.", back: "فضای Bridge", service: "سرویس تأییدشده", basics: "مشخصات محصول", name: "عنوان محصول", category: "دسته‌بندی", description: "توضیحات", kind: "نوع محصول", simple: "ساده", variable: "متغیر", variant: "تنوع", add: "افزودن تنوع", remove: "حذف", price: "قیمت (ریال)", mode: "نحوه انجام", automatic: "خودکار", manual: "دستی", min: "حداقل تعداد", max: "حداکثر تعداد", publish: "انتشار", active: "در صورت داشتن دسترسی منتشر شود", draft: "ذخیره پیش‌نویس", labels: "عنوان فیلدهای خریدار", labelHelp: "فقط متن نمایشی را تغییر دهید؛ کلید، نوع و گزینه‌های سرویس محافظت می‌شوند.", submit: "ساخت محصول", sending: "در حال ساخت…", error: "ساخت محصول انجام نشد.", empty: "مجوز فعالی وجود ندارد. اتصال را همگام و از مدیر درخواست فعال‌سازی سرویس کنید.", option: "نام ویژگی", value: "مقدار ویژگی" },
  ar: { eyebrow: "منتج Bridge", title: "حوّل خدمة معتمدة إلى عرض في متجرك.", back: "مساحة Bridge", service: "الخدمة المعتمدة", basics: "تفاصيل المنتج", name: "عنوان المنتج", category: "الفئة", description: "الوصف", kind: "نوع المنتج", simple: "بسيط", variable: "متغير", variant: "متغير", add: "إضافة متغير", remove: "حذف", price: "السعر (IRR)", mode: "التنفيذ", automatic: "تلقائي", manual: "يدوي", min: "أقل كمية", max: "أكبر كمية", publish: "النشر", active: "انشر عند امتلاك الصلاحية", draft: "حفظ كمسودة", labels: "تسميات حقول المشتري", labelHelp: "غيّر النص الظاهر فقط؛ تبقى المفاتيح والأنواع والخيارات محمية.", submit: "إنشاء المنتج", sending: "جارٍ الإنشاء…", error: "تعذر إنشاء المنتج.", empty: "لا توجد منحة نشطة. زامن الاتصال واطلب من المدير منح الخدمة.", option: "اسم الخيار", value: "قيمة الخيار" }
} as const;

type Variant = { id: number; name: string; value: string; price: string };

export function BridgeProductForm({ locale, initialGrantId }: { locale: Locale; initialGrantId?: string }) {
  const c = TEXT[locale];
  const router = useRouter();
  const [grants, setGrants] = useState<BridgeGrantSummary[]>([]);
  const [grantId, setGrantId] = useState(initialGrantId ?? "");
  const [kind, setKind] = useState<"simple" | "variable">("simple");
  const [variants, setVariants] = useState<Variant[]>([{ id: 1, name: "", value: "", price: "" }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const selected = useMemo(() => grants.find((item) => item.id === grantId), [grantId, grants]);

  useEffect(() => {
    api.get<BridgeGrantSummary[]>("/bridge/grants").then(({ data }) => {
      const active = data.filter((item) => item.status === "active" && item.service.available);
      setGrants(active);
      setGrantId((current) => active.some((item) => item.id === current) ? current : active[0]?.id ?? "");
    }).catch(() => setError(c.error));
  }, [c.error]);

  function updateVariant(id: number, key: keyof Variant, value: string) {
    setVariants((items) => items.map((item) => item.id === id ? { ...item, [key]: value } : item));
  }

  function changeKind(next: "simple" | "variable") {
    setKind(next);
    if (next === "simple") setVariants((items) => [items[0]]);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = new FormData(event.currentTarget);
    const optionName = String(form.get("optionName") ?? "").trim();
    const payload = {
      title: String(form.get("title") ?? "").trim(), category: String(form.get("category") ?? "").trim() || undefined,
      description: String(form.get("description") ?? "").trim() || undefined, kind, type: "bridge", status: form.get("status"),
      bridge: {
        grantId: selected.id, mode: form.get("mode"), minimumQuantity: Number(form.get("minimumQuantity")), maximumQuantity: Number(form.get("maximumQuantity")),
        fieldLabels: selected.service.fields.map((field) => ({ key: field.key, label: String(form.get(`label:${field.key}`) ?? field.label).trim() || field.label }))
      },
      ...(kind === "variable" ? { variants: variants.map((variant) => ({ key: `variant-${variant.id}`, name: variant.name.trim() || variant.value.trim(), options: [{ name: optionName, value: variant.value.trim() }] })) } : {}),
      offers: variants.map((variant) => ({ ...(kind === "variable" ? { variantKey: `variant-${variant.id}` } : {}), price: variant.price, currency: "IRR", status: "active" }))
    };
    setBusy(true); setError("");
    try { await api.post("/products", payload); router.replace(`/${locale}/seller-dashboard?section=products`); }
    catch { setError(c.error); setBusy(false); }
  }

  return <div className={styles.shell}>
    <header className={styles.header}><div><p className={styles.brand}>{c.eyebrow}</p><h1>{c.title}</h1></div><Link className={styles.link} href={`/${locale}/seller-dashboard/bridge` as Route}>{c.back}</Link></header>
    <main className={styles.main}>
      {!grants.length && !selected ? <p className={styles.empty}>{c.empty}</p> : null}
      {selected ? <form className={styles.form} onSubmit={submit} aria-busy={busy}>
        <section className={styles.section}><div className={styles.sectionHead}><div><h2>{c.basics}</h2><p>{selected.service.name}</p></div></div>
          <div className={styles.formGrid}>
            <label className={styles.field}><span>{c.service}</span><select value={grantId} onChange={(e) => setGrantId(e.target.value)}>{grants.map((grant) => <option key={grant.id} value={grant.id}>{grant.service.name}</option>)}</select><small>&nbsp;</small></label>
            <label className={styles.field}><span>{c.name}</span><input name="title" required minLength={2} maxLength={200}/><small>&nbsp;</small></label>
            <label className={styles.field}><span>{c.category}</span><input name="category" maxLength={100}/><small>&nbsp;</small></label>
            <label className={styles.field}><span>{c.kind}</span><select value={kind} onChange={(e) => changeKind(e.target.value as "simple" | "variable")}><option value="simple">{c.simple}</option><option value="variable">{c.variable}</option></select><small>&nbsp;</small></label>
            <label className={styles.field}><span>{c.mode}</span><select name="mode"><option value="automatic">{c.automatic}</option><option value="manual">{c.manual}</option></select><small>&nbsp;</small></label>
            <label className={styles.field}><span>{c.publish}</span><select name="status"><option value="active">{c.active}</option><option value="draft">{c.draft}</option></select><small>&nbsp;</small></label>
            <label className={styles.field}><span>{c.min}</span><input name="minimumQuantity" type="number" min="1" max="100" defaultValue="1" required/><small>&nbsp;</small></label>
            <label className={styles.field}><span>{c.max}</span><input name="maximumQuantity" type="number" min="1" max="100" defaultValue="1" required/><small>&nbsp;</small></label>
          </div>
          <label className={styles.field}><span>{c.description}</span><textarea name="description" maxLength={10000}/><small>&nbsp;</small></label>
        </section>
        <section className={styles.section}><div className={styles.sectionHead}><div><h2>{c.labels}</h2><p>{c.labelHelp}</p></div></div><div className={styles.formGrid}>{selected.service.fields.map((field) => <label className={styles.field} key={field.key}><span>{field.label}</span><input name={`label:${field.key}`} defaultValue={field.label} required maxLength={160}/><small>{field.key} · {field.type}</small></label>)}</div></section>
        <section className={styles.section}><div className={styles.sectionHead}><h2>{kind === "variable" ? c.variant : c.price}</h2>{kind === "variable" ? <button className={styles.buttonQuiet} type="button" onClick={() => setVariants((items) => [...items, { id: Date.now(), name: "", value: "", price: "" }])}>{c.add}</button> : null}</div>
          {kind === "variable" ? <label className={styles.field}><span>{c.option}</span><input name="optionName" required maxLength={50}/><small>&nbsp;</small></label> : null}
          <div className={styles.grid}>{variants.map((variant) => <article className={styles.card} key={variant.id}>{kind === "variable" ? <><label className={styles.field}><span>{c.variant}</span><input value={variant.name} onChange={(e) => updateVariant(variant.id, "name", e.target.value)} maxLength={200}/><small>&nbsp;</small></label><label className={styles.field}><span>{c.value}</span><input required value={variant.value} onChange={(e) => updateVariant(variant.id, "value", e.target.value)} maxLength={100}/><small>&nbsp;</small></label></> : null}<label className={styles.field}><span>{c.price}</span><input required inputMode="numeric" pattern="(?:0|[1-9][0-9]{0,15})" value={variant.price} onChange={(e) => updateVariant(variant.id, "price", e.target.value)}/><small>IRR</small></label>{kind === "variable" && variants.length > 1 ? <button className={styles.buttonQuiet} type="button" onClick={() => setVariants((items) => items.filter((item) => item.id !== variant.id))}>{c.remove}</button> : null}</article>)}</div>
        </section>
        {error ? <p className={styles.error} role="alert">{error}</p> : null}<button className={styles.button} disabled={busy}>{busy ? c.sending : c.submit}</button>
      </form> : null}
    </main>
  </div>;
}
