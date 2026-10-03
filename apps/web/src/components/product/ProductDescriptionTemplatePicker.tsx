"use client";

import { useEffect, useState } from "react";
import type { Locale } from "@/lib/i18n";
import { api } from "@/lib/api/client";
import styles from "./ProductDescriptionTemplatePicker.module.css";

type Template = { id: string; name: string; content: string; locale: Locale; active: boolean };
type Page = { items: Template[]; nextCursor: string | null };
type Props = {
  locale: Locale;
  title: string;
  hasDescription: boolean;
  disabled?: boolean;
  admin?: boolean;
  onApply: (description: string) => void;
};

const copy = {
  fa: { choose: "قالب آماده", placeholder: "انتخاب قالب", apply: "افزودن به توضیحات", replace: "توضیحات فعلی جایگزین می‌شود.", empty: "قالبی برای این زبان ثبت نشده است.", error: "بارگذاری قالب‌ها انجام نشد.", more: "نمایش قالب‌های بیشتر" },
  en: { choose: "Ready-made template", placeholder: "Choose a template", apply: "Use in description", replace: "This replaces the current description.", empty: "No templates for this language yet.", error: "Templates could not be loaded.", more: "Load more templates" },
  ar: { choose: "قالب جاهز", placeholder: "اختر قالباً", apply: "استخدمه في الوصف", replace: "سيستبدل الوصف الحالي.", empty: "لا توجد قوالب لهذه اللغة.", error: "تعذر تحميل القوالب.", more: "عرض المزيد من القوالب" }
} as const;

export function ProductDescriptionTemplatePicker(props: Props) {
  return <TemplatePicker key={`${props.locale}-${Boolean(props.admin)}`} {...props} />;
}

function TemplatePicker({ locale, title, hasDescription, disabled, admin = false, onApply }: Props) {
  const [items, setItems] = useState<Template[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const c = copy[locale];

  useEffect(() => {
    const controller = new AbortController();
    api.get<Page>(admin ? "/products/admin/templates" : "/products/templates", { params: { locale, limit: 50 }, signal: controller.signal })
      .then(({ data }) => { setItems(data.items); setCursor(data.nextCursor); setLoaded(true); })
      .catch(() => { if (!controller.signal.aborted) setError(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [admin, locale]);

  async function loadMore() {
    if (!cursor) return;
    setLoading(true);
    setError(false);
    try {
      const { data } = await api.get<Page>(admin ? "/products/admin/templates" : "/products/templates", { params: { locale, limit: 50, cursor } });
      setItems((current) => [...current, ...data.items]);
      setCursor(data.nextCursor);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  const selected = items.find((item) => item.id === selectedId);
  const rendered = selected?.content.replaceAll("{title}", title.trim() || (locale === "fa" ? "نام محصول" : locale === "ar" ? "اسم المنتج" : "Product title"));
  return <div className={styles.picker}>
    <label><span>{c.choose}</span><select value={selectedId} disabled={disabled || loading && !loaded} onChange={(event) => setSelectedId(event.target.value)}><option value="">{c.placeholder}</option>{items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    {selected ? <div className={styles.preview}><p>{rendered}</p>{hasDescription ? <small>{c.replace}</small> : null}<button type="button" disabled={disabled} onClick={() => { if (rendered) onApply(rendered); setSelectedId(""); }}>{c.apply}</button></div> : null}
    {loaded && !items.length ? <small>{c.empty}</small> : null}
    {error ? <small role="alert">{c.error}</small> : null}
    {cursor ? <button className={styles.more} type="button" disabled={loading} onClick={() => void loadMore()}>{c.more}</button> : null}
  </div>;
}
