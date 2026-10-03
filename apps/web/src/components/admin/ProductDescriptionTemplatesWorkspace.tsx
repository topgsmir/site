"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api/client";
import type { Locale } from "@/lib/i18n";
import styles from "./ProductDescriptionTemplatesWorkspace.module.css";

type Template = { id: string; locale: Locale; name: string; content: string; active: boolean; updatedAt: string };
type Page = { items: Template[]; nextCursor: string | null };

const copy = {
  fa: { title: "قالب‌های آماده محصول", hint: "متن‌هایی بسازید که فروشندگان هنگام نوشتن توضیحات محصول استفاده کنند.", language: "زبان", new: "قالب جدید", edit: "ویرایش قالب", name: "نام قالب", content: "متن قالب", placeholder: "برای درج نام محصول از {title} استفاده کنید.", active: "قابل استفاده برای فروشندگان", save: "ذخیره قالب", saving: "در حال ذخیره…", cancel: "انصراف", editAction: "ویرایش", disable: "غیرفعال کردن", enable: "فعال کردن", empty: "هنوز قالبی برای این زبان ثبت نشده است.", error: "بارگذاری قالب‌ها انجام نشد.", saveError: "ذخیره قالب انجام نشد.", saved: "قالب ذخیره شد.", more: "نمایش بیشتر", status: "وضعیت", enabled: "فعال", disabled: "غیرفعال" },
  en: { title: "Product templates", hint: "Create text sellers can use in product descriptions.", language: "Language", new: "New template", edit: "Edit template", name: "Template name", content: "Template text", placeholder: "Use {title} to insert the product title.", active: "Available to sellers", save: "Save template", saving: "Saving…", cancel: "Cancel", editAction: "Edit", disable: "Deactivate", enable: "Activate", empty: "No templates for this language yet.", error: "Templates could not be loaded.", saveError: "Template could not be saved.", saved: "Template saved.", more: "Load more", status: "Status", enabled: "Active", disabled: "Inactive" },
  ar: { title: "قوالب المنتجات", hint: "أنشئ نصوصاً يمكن للبائعين استخدامها في وصف المنتجات.", language: "اللغة", new: "قالب جديد", edit: "تعديل القالب", name: "اسم القالب", content: "نص القالب", placeholder: "استخدم {title} لإدراج اسم المنتج.", active: "متاح للبائعين", save: "حفظ القالب", saving: "جارٍ الحفظ…", cancel: "إلغاء", editAction: "تعديل", disable: "تعطيل", enable: "تفعيل", empty: "لا توجد قوالب لهذه اللغة.", error: "تعذر تحميل القوالب.", saveError: "تعذر حفظ القالب.", saved: "تم حفظ القالب.", more: "عرض المزيد", status: "الحالة", enabled: "نشط", disabled: "غير نشط" }
} as const;

export function ProductDescriptionTemplatesWorkspace({ locale }: { locale: Locale }) {
  const c = copy[locale];
  const [templateLocale, setTemplateLocale] = useState<Locale>(locale);
  const [items, setItems] = useState<Template[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState<Template | null>(null);
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const requestId = useRef(0);

  const load = useCallback(async (nextCursor?: string) => {
    const currentRequest = ++requestId.current;
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get<Page>("/products/admin/templates", { params: { locale: templateLocale, limit: 50, ...(nextCursor ? { cursor: nextCursor } : {}) } });
      if (currentRequest !== requestId.current) return;
      setItems((current) => nextCursor ? [...current, ...data.items] : data.items);
      setCursor(data.nextCursor);
    } catch {
      if (currentRequest === requestId.current) setError(copy[locale].error);
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }, [locale, templateLocale]);

  useEffect(() => {
    const controller = new AbortController();
    const currentRequest = ++requestId.current;
    api.get<Page>("/products/admin/templates", { params: { locale: templateLocale, limit: 50 }, signal: controller.signal })
      .then(({ data }) => { if (currentRequest === requestId.current) { setItems(data.items); setCursor(data.nextCursor); } })
      .catch(() => { if (!controller.signal.aborted && currentRequest === requestId.current) setError(copy[locale].error); })
      .finally(() => { if (!controller.signal.aborted && currentRequest === requestId.current) setLoading(false); });
    return () => controller.abort();
  }, [locale, templateLocale]);

  function reset() { setEditing(null); setName(""); setContent(""); setActive(true); }
  function startEdit(item: Template) { setEditing(item); setName(item.name); setContent(item.content); setActive(item.active); setNotice(""); }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim() || !content.trim()) return;
    setSaving(true);
    setError("");
    try {
      const body = { name: name.trim(), content: content.trim(), active };
      if (editing) await api.patch(`/products/admin/templates/${editing.id}`, body);
      else await api.post("/products/admin/templates", { ...body, locale: templateLocale });
      reset();
      setNotice(c.saved);
      await load();
    } catch {
      setError(c.saveError);
    } finally {
      setSaving(false);
    }
  }

  async function toggle(item: Template) {
    setError("");
    try {
      await api.patch(`/products/admin/templates/${item.id}`, { active: !item.active });
      setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, active: !item.active } : entry));
      if (editing?.id === item.id) setActive(!item.active);
    } catch {
      setError(c.saveError);
    }
  }

  return <section className={styles.workspace} aria-labelledby="product-templates-title">
    <header className={styles.header}><div><h1 id="product-templates-title">{c.title}</h1><p>{c.hint}</p></div><label>{c.language}<select value={templateLocale} onChange={(event) => { setTemplateLocale(event.target.value as Locale); reset(); setItems([]); setCursor(null); setLoading(true); setError(""); }}><option value="fa">فارسی</option><option value="en">English</option><option value="ar">العربية</option></select></label></header>
    {error ? <p className={styles.error} role="alert">{error}</p> : null}
    {notice ? <p className={styles.notice} role="status">{notice}</p> : null}
    <div className={styles.layout}>
      <form className={styles.form} onSubmit={(event) => void save(event)}><h2>{editing ? c.edit : c.new}</h2>
        <label>{c.name}<input required maxLength={100} value={name} onChange={(event) => setName(event.target.value)} /></label>
        <label>{c.content}<textarea required maxLength={10_000} rows={9} value={content} onChange={(event) => setContent(event.target.value)} placeholder={c.placeholder} /></label>
        <label className={styles.check}><input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} />{c.active}</label>
        <div className={styles.actions}><button type="submit" disabled={saving}>{saving ? c.saving : c.save}</button>{editing ? <button type="button" onClick={reset}>{c.cancel}</button> : null}</div>
      </form>
      <div className={styles.list}>{items.map((item) => <article key={item.id} className={styles.row}><div><strong>{item.name}</strong><span>{c.status}: {item.active ? c.enabled : c.disabled}</span><p>{item.content}</p></div><div className={styles.rowActions}><button type="button" onClick={() => startEdit(item)}>{c.editAction}</button><button type="button" onClick={() => void toggle(item)}>{item.active ? c.disable : c.enable}</button></div></article>)}{!loading && !items.length ? <p className={styles.empty}>{c.empty}</p> : null}{cursor ? <button className={styles.more} type="button" disabled={loading} onClick={() => void load(cursor)}>{c.more}</button> : null}</div>
    </div>
  </section>;
}
