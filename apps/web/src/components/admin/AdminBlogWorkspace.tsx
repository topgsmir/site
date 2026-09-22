"use client";

import type { BlogLocale, BlogTaxonomyTerm } from "@topgsm/shared-types";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api/client";
import type { Locale } from "@/lib/i18n";
import { SellerBlogPanel } from "@/components/seller/SellerBlogPanel";
import styles from "./AdminBlogWorkspace.module.css";

const LOCALES: BlogLocale[] = ["fa", "en", "ar"];
type Draft = Record<BlogLocale, { name: string; slug: string }>;
const EMPTY: Draft = { fa: { name: "", slug: "" }, en: { name: "", slug: "" }, ar: { name: "", slug: "" } };

const COPY = {
  en: { title: "Editorial", intro: "Write and review articles, then maintain the multilingual categories and tags used across the public journal.", taxonomy: "Taxonomy", taxonomyHelp: "Categories and controlled tags publish with complete Persian, English, and Arabic labels.", publicJournal: "Public journal", categories: "Categories", tags: "Tags", name: "Name", slug: "Slug", addCategory: "Add category", addTag: "Add tag", loadError: "Taxonomy could not be loaded.", saving: "Saving…", saved: "Taxonomy saved.", saveError: "Save failed. Every language and slug must be unique and complete." },
  fa: { title: "بلاگ", intro: "مقاله‌ها را بنویسید و بررسی کنید و دسته‌بندی‌ها و برچسب‌های چندزبانه مجله عمومی را مدیریت کنید.", taxonomy: "دسته‌بندی و برچسب", taxonomyHelp: "دسته‌بندی‌ها و برچسب‌های کنترل‌شده با عنوان کامل فارسی، انگلیسی و عربی منتشر می‌شوند.", publicJournal: "مجله عمومی", categories: "دسته‌بندی‌ها", tags: "برچسب‌ها", name: "نام", slug: "نامک", addCategory: "افزودن دسته‌بندی", addTag: "افزودن برچسب", loadError: "دسته‌بندی‌ها و برچسب‌ها بارگذاری نشدند.", saving: "در حال ذخیره…", saved: "اطلاعات بلاگ ذخیره شد.", saveError: "ذخیره انجام نشد. همه زبان‌ها و نامک‌ها باید کامل و یکتا باشند." },
  ar: { title: "التحرير", intro: "اكتب المقالات وراجعها، ثم أدر التصنيفات والوسوم متعددة اللغات للمجلة العامة.", taxonomy: "التصنيفات والوسوم", taxonomyHelp: "تُنشر التصنيفات والوسوم بعناوين فارسية وإنجليزية وعربية مكتملة.", publicJournal: "المجلة العامة", categories: "التصنيفات", tags: "الوسوم", name: "الاسم", slug: "المعرّف", addCategory: "إضافة تصنيف", addTag: "إضافة وسم", loadError: "تعذر تحميل التصنيفات والوسوم.", saving: "جارٍ الحفظ…", saved: "تم حفظ بيانات التحرير.", saveError: "تعذر الحفظ. يجب أن تكون كل اللغات والمعرّفات مكتملة وفريدة." }
} as const;

export function AdminBlogWorkspace({ locale }: { locale: Locale }) {
  const c = COPY[locale];
  const [kind, setKind] = useState<"category" | "tag">("category");
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [categories, setCategories] = useState<BlogTaxonomyTerm[]>([]);
  const [tags, setTags] = useState<BlogTaxonomyTerm[]>([]);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const load = useCallback(async () => {
    try { const response = await api.get<{ categories: BlogTaxonomyTerm[]; tags: BlogTaxonomyTerm[] }>("/blog/manage/taxonomy"); setCategories(response.data.categories); setTags(response.data.tags); }
    catch { setMessage(c.loadError); }
  }, [c.loadError]);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  async function create(event: FormEvent) {
    event.preventDefault(); if (saving) return; setSaving(true); setMessage(c.saving);
    try {
      await api.post(`/blog/manage/${kind === "category" ? "categories" : "tags"}`, { translations: LOCALES.map((code) => ({ locale: code, ...draft[code] })) });
      setDraft(EMPTY); setMessage(c.saved); await load();
    } catch { setMessage(c.saveError); } finally { setSaving(false); }
  }
  const terms = kind === "category" ? categories : tags;
  return <section className={styles.workspace} aria-labelledby="editorial-title"><header className={styles.header}><h1 id="editorial-title">{c.title}</h1><p>{c.intro}</p></header><div className={styles.content}><SellerBlogPanel locale={locale} editBase="admin/blog" categoryOptions={categories} /><aside className={styles.taxonomy}><header><h2>{c.taxonomy}</h2><p>{c.taxonomyHelp}</p></header><div className={styles.kindTabs}><button type="button" aria-pressed={kind === "category"} disabled={saving} onClick={() => setKind("category")}>{c.categories}</button><button type="button" aria-pressed={kind === "tag"} disabled={saving} onClick={() => setKind("tag")}>{c.tags}</button></div><details className={styles.createTerm}><summary>{kind === "category" ? c.addCategory : c.addTag}</summary><form className={styles.form} onSubmit={create}>{LOCALES.map((code) => <fieldset key={code}><legend>{code.toUpperCase()}</legend><label>{c.name}<input required maxLength={100} value={draft[code].name} onChange={(event) => setDraft((current) => ({ ...current, [code]: { ...current[code], name: event.target.value } }))} /></label><label>{c.slug}<input required maxLength={120} dir="ltr" pattern="[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*" value={draft[code].slug} onChange={(event) => setDraft((current) => ({ ...current, [code]: { ...current[code], slug: event.target.value } }))} /></label></fieldset>)}<button type="submit" disabled={saving}>{kind === "category" ? c.addCategory : c.addTag}</button></form></details><p role="status">{message}</p><div className={styles.terms}>{terms.map((term) => <div className={styles.term} key={term.id}><strong>{term.translations.find((translation) => translation.locale === locale)?.name ?? term.translations[0]?.name}</strong><span>{term.translations.length}/3</span></div>)}</div></aside></div></section>;
}
