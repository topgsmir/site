"use client";

import type { BlogLocale, BlogTaxonomyTerm } from "@topgsm/shared-types";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api/client";
import type { Locale } from "@/lib/i18n";
import { SellerBlogPanel } from "@/components/seller/SellerBlogPanel";
import styles from "./AdminBlogWorkspace.module.css";

const LOCALES: BlogLocale[] = ["fa", "en", "ar"];
type Draft = Record<BlogLocale, { name: string; slug: string }>;
const EMPTY: Draft = { fa: { name: "", slug: "" }, en: { name: "", slug: "" }, ar: { name: "", slug: "" } };

export function AdminBlogWorkspace({ locale, isOwner }: { locale: Locale; isOwner: boolean }) {
  const [kind, setKind] = useState<"category" | "tag">("category");
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [categories, setCategories] = useState<BlogTaxonomyTerm[]>([]);
  const [tags, setTags] = useState<BlogTaxonomyTerm[]>([]);
  const [message, setMessage] = useState("");
  const load = useCallback(async () => {
    try { const response = await api.get<{ categories: BlogTaxonomyTerm[]; tags: BlogTaxonomyTerm[] }>("/blog/manage/taxonomy"); setCategories(response.data.categories); setTags(response.data.tags); }
    catch { setMessage("Taxonomy could not be loaded."); }
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  async function create(event: FormEvent) {
    event.preventDefault(); setMessage("Saving…");
    try {
      await api.post(`/blog/manage/${kind === "category" ? "categories" : "tags"}`, { translations: LOCALES.map((code) => ({ locale: code, ...draft[code] })) });
      setDraft(EMPTY); setMessage("Taxonomy saved."); await load();
    } catch { setMessage("Save failed. Every language and slug must be unique and complete."); }
  }
  const terms = kind === "category" ? categories : tags;
  return <main className={styles.shell}><nav className={styles.nav}><Link href={`/${locale}/admin`}>TOP GSM / ADMIN</Link><div><Link href={`/${locale}/blog`}>Public journal</Link>{isOwner ? <Link href={`/${locale}/admin/staff`}>Staff</Link> : null}</div></nav><div className={styles.content}><SellerBlogPanel locale={locale} editBase="admin/blog" /><aside className={styles.taxonomy}><header><h2>Taxonomy</h2><p>Categories and controlled tags publish with complete Persian, English, and Arabic labels.</p></header><div className={styles.kindTabs}><button type="button" aria-pressed={kind === "category"} onClick={() => setKind("category")}>Categories</button><button type="button" aria-pressed={kind === "tag"} onClick={() => setKind("tag")}>Tags</button></div><form className={styles.form} onSubmit={create}>{LOCALES.map((code) => <fieldset key={code}><legend>{code.toUpperCase()}</legend><label>Name<input required maxLength={100} value={draft[code].name} onChange={(event) => setDraft((current) => ({ ...current, [code]: { ...current[code], name: event.target.value } }))} /></label><label>Slug<input required maxLength={120} dir="ltr" pattern="[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*" value={draft[code].slug} onChange={(event) => setDraft((current) => ({ ...current, [code]: { ...current[code], slug: event.target.value } }))} /></label></fieldset>)}<button type="submit">Add {kind}</button></form><p role="status">{message}</p><div className={styles.terms}>{terms.map((term) => <div className={styles.term} key={term.id}><strong>{term.translations.find((translation) => translation.locale === locale)?.name ?? term.translations[0]?.name}</strong><span>{term.translations.length}/3</span></div>)}</div></aside></div></main>;
}
