"use client";

import { useCallback, useEffect, useId, useState, type FormEvent } from "react";
import { isAxiosError } from "axios";
import Image from "next/image";
import type { AdminSeoSettings, SeoConfiguration, SeoHistoryEntry, SeoLocale, SeoPageOverride } from "@topgsm/shared-types";
import { api } from "@/lib/api/client";
import type { Locale } from "@/lib/i18n";
import { SITE_URL } from "@/lib/seo";
import { seoCopy } from "./seo-copy";
import styles from "./SeoSettingsWorkspace.module.css";

type Tab = "defaults" | "pages" | "redirects" | "visibility" | "history";
function Field({ label, value, onChange, hint, maxLength = 1000, multiline = false, required = false, ltr = false }: {
  label: string; value: string; onChange: (value: string) => void; hint?: string; maxLength?: number; multiline?: boolean; required?: boolean; ltr?: boolean;
}) {
  const id = useId();
  const props = { id, value, required, maxLength, onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(event.target.value), "aria-describedby": hint ? `${id}-hint` : undefined, dir: ltr ? "ltr" as const : undefined };
  return <div className={styles.field}><label htmlFor={id}>{label}</label>{multiline ? <textarea {...props} rows={3} /> : <input {...props} />}<small dir="ltr">{value.length} / {maxLength}</small>{hint ? <p id={`${id}-hint`}>{hint}</p> : null}</div>;
}

export function SeoSettingsWorkspace({ locale }: { locale: Locale }) {
  const c = seoCopy[locale];
  const [saved, setSaved] = useState<AdminSeoSettings | null>(null);
  const [draft, setDraft] = useState<SeoConfiguration | null>(null);
  const [history, setHistory] = useState<SeoHistoryEntry[]>([]);
  const [tab, setTab] = useState<Tab>("defaults");
  const [language, setLanguage] = useState<SeoLocale>(locale);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const dirty = !!draft && !!saved && JSON.stringify(draft) !== JSON.stringify(saved.configuration);
  const load = useCallback(async () => {
    setLoading(true); setError(""); setMessage("");
    try {
      const [settings, revisions] = await Promise.all([api.get<AdminSeoSettings>("/admin/seo"), api.get<SeoHistoryEntry[]>("/admin/seo/history")]);
      setSaved(settings.data); setDraft(structuredClone(settings.data.configuration)); setHistory(revisions.data); setAcknowledged(false);
    } catch { setError(c.loadError); }
    finally { setLoading(false); }
  }, [c.loadError]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty]);
  function edit(next: SeoConfiguration) { setDraft(next); setMessage(""); setError(""); }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!draft || !saved || !dirty || saving) return;
    setSaving(true); setError(""); setMessage("");
    try {
      const { data } = await api.patch<AdminSeoSettings>("/admin/seo", { version: saved.version, configuration: { ...draft, sameAs: draft.sameAs.map((url) => url.trim()).filter(Boolean) } });
      setSaved(data); setDraft(structuredClone(data.configuration)); setAcknowledged(false); setMessage(c.saved);
      // The save has succeeded even if an optional history refresh fails.
      void api.get<SeoHistoryEntry[]>("/admin/seo/history").then((result) => setHistory(result.data)).catch(() => {});
    } catch (failure) {
      const detail: unknown = isAxiosError(failure) ? failure.response?.data?.message : null;
      setError(isAxiosError(failure) && failure.response?.status === 409 ? c.conflict : `${c.saveError}${typeof detail === "string" ? ` ${detail}` : Array.isArray(detail) ? ` ${detail.slice(0, 4).join(" · ")}` : ""}`);
    } finally { setSaving(false); }
  }
  function exportConfiguration() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(draft, null, 2)], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = "topgsm-seo.json"; link.click(); URL.revokeObjectURL(url);
  }
  if (loading) return <section className={styles.workspace}><h1>{c.title}</h1><p role="status">{c.loading}</p></section>;
  if (!saved || !draft) return <section className={styles.workspace}><h1>{c.title}</h1><p role="alert">{error}</p><button onClick={() => void load()}>{c.retry}</button></section>;
  const defaults = draft.locales.find((item) => item.locale === language)!;
  const changeDefault = (key: "siteName" | "titleTemplate" | "description" | "socialImage", value: string) => edit({ ...draft, locales: draft.locales.map((item) => item.locale === language ? { ...item, [key]: value } : item) });
  const changePage = (index: number, changes: Partial<SeoPageOverride>) => edit({ ...draft, pages: draft.pages.map((item, i) => i === index ? { ...item, ...changes } : item) });
  const warnings = [
    ...(!draft.indexingEnabled ? [c.indexingWarning] : []),
    ...(!draft.googleVerification ? [c.missingVerification] : []),
    ...draft.locales.filter((item) => !item.socialImage).map((item) => `${item.locale.toUpperCase()}: ${c.missingImage}`),
    ...draft.pages.flatMap((item) => [ ...(item.title.length > 60 ? [`${item.path}: ${c.shortTitle}`] : []), ...(item.description.length > 160 ? [`${item.path}: ${c.shortDescription}`] : []) ])
  ];
  const disabling = saved.configuration.indexingEnabled && !draft.indexingEnabled;
  return <section className={styles.workspace} dir={locale === "en" ? "ltr" : "rtl"} aria-labelledby="seo-title">
    <header className={styles.header}><div><h1 id="seo-title">{c.title}</h1><p>{c.intro}</p></div><span>{c.revision} {saved.version}</span></header>
    <nav className={styles.tabs} aria-label={c.title}>{(["defaults", "pages", "redirects", "visibility", "history"] as const).map((item) => <button type="button" key={item} aria-current={tab === item ? "page" : undefined} onClick={() => setTab(item)}>{c[item]}{item === "pages" || item === "redirects" ? ` (${draft[item].length})` : ""}</button>)}</nav>
    <form onSubmit={save}>
      <fieldset disabled={saving} className={styles.body}>
        {tab === "defaults" ? <div className={styles.columns}><div className={styles.fields}>
          <label className={styles.field}>{c.language}<select value={language} onChange={(event) => setLanguage(event.target.value as SeoLocale)}><option value="fa">فارسی</option><option value="en">English</option><option value="ar">العربية</option></select></label>
          <Field label={c.siteName} value={defaults.siteName} maxLength={80} required onChange={(value) => changeDefault("siteName", value)} />
          <Field label={c.template} ltr value={defaults.titleTemplate} maxLength={120} required hint={c.templateHint} onChange={(value) => changeDefault("titleTemplate", value)} />
          <Field label={c.description} value={defaults.description} maxLength={320} multiline hint={c.fallbackHint} onChange={(value) => changeDefault("description", value)} />
          <Field label={c.image} value={defaults.socialImage} ltr hint={c.imageHint} onChange={(value) => changeDefault("socialImage", value)} />
        </div><aside className={styles.preview}><h2>{c.preview}</h2><div className={styles.snippet} dir={language === "en" ? "ltr" : "rtl"}><small>{SITE_URL}/{language}</small><strong>{defaults.titleTemplate.replace("%s", c.pageTitle)}</strong><p>{defaults.description || c.inherited}</p></div><p>{c.previewHint}</p><h2>{c.social}</h2>{defaults.socialImage ? <div className={styles.socialImage}>{defaults.socialImage.startsWith("https://") ? <Image src={defaults.socialImage} alt={c.social} width={1200} height={630} unoptimized /> : null}<strong>{defaults.siteName}</strong><p>{defaults.description}</p></div> : <p>{c.missingImage}</p>}<p>{c.imageHint}</p></aside></div> : null}
        {tab === "pages" ? <div className={styles.fields}><div className={styles.toolbar}><p>{c.pageHint}</p><button type="button" disabled={draft.pages.length >= 100} onClick={() => edit({ ...draft, pages: [...draft.pages, { path: `/${language}/`, title: "", description: "", socialImage: "", noIndex: false, excludeFromSitemap: false }] })}>{c.addPage}</button></div><small>{c.limit}</small>
          {!draft.pages.length ? <p className={styles.empty}>{c.noPages}</p> : draft.pages.map((page, i) => <details key={i} className={styles.entry} open={undefined}><summary><bdi>{page.path || c.unsavedPage}</bdi>{page.noIndex ? <span>noindex</span> : null}</summary><div className={styles.columns}><div className={styles.fields}>
            <Field label={c.path} value={page.path} maxLength={500} required ltr onChange={(value) => changePage(i, { path: value })} />
            <Field label={c.pageTitle} value={page.title} maxLength={120} onChange={(value) => changePage(i, { title: value })} />
            <Field label={c.pageDescription} value={page.description} maxLength={320} multiline onChange={(value) => changePage(i, { description: value })} />
            <Field label={c.image} value={page.socialImage} ltr hint={c.imageHint} onChange={(value) => changePage(i, { socialImage: value })} />
            <label className={styles.check}><input type="checkbox" checked={page.noIndex} onChange={(event) => changePage(i, { noIndex: event.target.checked })} />{c.noIndex}</label>
            <label className={styles.check}><input type="checkbox" checked={page.excludeFromSitemap} onChange={(event) => changePage(i, { excludeFromSitemap: event.target.checked })} />{c.exclude}</label>
            <button className={styles.remove} type="button" onClick={() => edit({ ...draft, pages: draft.pages.filter((_, index) => index !== i) })}>{c.remove}</button>
          </div><aside className={styles.preview}><h2>{c.preview}</h2><div className={styles.snippet}><small>{SITE_URL}{page.path}</small><strong>{page.title ? (draft.locales.find((item) => item.locale === page.path.split("/")[1])?.titleTemplate ?? "%s").replace("%s", page.title) : c.inherited}</strong><p>{page.description || c.inherited}</p></div><p>{c.previewHint}</p></aside></div></details>)}
        </div> : null}
        {tab === "redirects" ? <div className={styles.fields}><div className={styles.toolbar}><p>{c.redirectHint}</p><button type="button" disabled={draft.redirects.length >= 100} onClick={() => edit({ ...draft, redirects: [...draft.redirects, { source: "", destination: "", status: 301, enabled: true }] })}>{c.addRedirect}</button></div><small>{c.limit}</small>{!draft.redirects.length ? <p className={styles.empty}>{c.noRedirects}</p> : draft.redirects.map((rule, i) => <div key={i} className={styles.entry}>
          <div className={styles.columns}><Field label={c.source} value={rule.source} maxLength={500} required ltr onChange={(value) => edit({ ...draft, redirects: draft.redirects.map((item, index) => index === i ? { ...item, source: value } : item) })} /><Field label={c.destination} value={rule.destination} maxLength={500} required ltr onChange={(value) => edit({ ...draft, redirects: draft.redirects.map((item, index) => index === i ? { ...item, destination: value } : item) })} /></div>
          <div className={styles.toolbar}><label className={styles.field}>{c.status}<select value={rule.status} onChange={(event) => edit({ ...draft, redirects: draft.redirects.map((item, index) => index === i ? { ...item, status: Number(event.target.value) as 301 | 302 } : item) })}><option value={301}>{c.permanent}</option><option value={302}>{c.temporary}</option></select></label><label className={styles.check}><input type="checkbox" checked={rule.enabled} onChange={(event) => edit({ ...draft, redirects: draft.redirects.map((item, index) => index === i ? { ...item, enabled: event.target.checked } : item) })} />{c.enabled}</label><button type="button" className={styles.remove} onClick={() => edit({ ...draft, redirects: draft.redirects.filter((_, index) => index !== i) })}>{c.remove}</button></div>
        </div>)}</div> : null}
        {tab === "visibility" ? <div className={styles.columns}><div className={styles.fields}>
          <label className={styles.check}><input type="checkbox" checked={draft.indexingEnabled} onChange={(event) => { edit({ ...draft, indexingEnabled: event.target.checked }); setAcknowledged(false); }} />{c.indexing}</label><p>{c.indexingHint}</p>
          <Field label={c.organization} value={draft.organizationName} maxLength={120} required onChange={(value) => edit({ ...draft, organizationName: value })} />
          <Field label={c.logo} value={draft.organizationLogo} ltr onChange={(value) => edit({ ...draft, organizationLogo: value })} />
          <Field label={c.profiles} value={draft.sameAs.join("\n")} maxLength={10000} multiline ltr hint={c.profilesHint} onChange={(value) => edit({ ...draft, sameAs: value.split("\n") })} />
          <Field label={c.google} value={draft.googleVerification} maxLength={200} ltr hint={c.verificationHint} onChange={(value) => edit({ ...draft, googleVerification: value })} />
          <Field label={c.bing} value={draft.bingVerification} maxLength={200} ltr hint={c.verificationHint} onChange={(value) => edit({ ...draft, bingVerification: value })} />
        </div><aside className={styles.preview}><h2>{c.resources}</h2><ul className={styles.links}><li><a href="/sitemap.xml" target="_blank" rel="noreferrer">{c.sitemap}</a></li><li><a href="/robots.txt" target="_blank" rel="noreferrer">{c.robots}</a></li><li><a href="https://search.google.com/search-console" target="_blank" rel="noreferrer">{c.searchConsole}</a></li><li><a href="https://www.bing.com/webmasters" target="_blank" rel="noreferrer">{c.bingTools}</a></li><li><a href="https://search.google.com/test/rich-results" target="_blank" rel="noreferrer">{c.richResults}</a></li></ul><p>{c.toolsHint}</p><h2>{c.checks}</h2><p>{c.healthHint}</p>{warnings.length ? <ul>{warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul> : <p>{c.noIssues}</p>}</aside></div> : null}
        {tab === "history" ? <div className={styles.fields}><div className={styles.toolbar}><p>{c.restoreHint}</p><button type="button" onClick={exportConfiguration}>{c.export}</button></div>{!history.length ? <p>{c.noHistory}</p> : history.map((item) => <div key={item.version} className={styles.history}><div><strong>{c.revision} {item.version}</strong><p>{item.updatedAt ? new Date(item.updatedAt).toLocaleString(locale) : ""}</p><small dir="ltr">{item.actorUserId}</small></div><button type="button" onClick={() => { edit(structuredClone(item.configuration)); setAcknowledged(false); setMessage(c.draftRestored); }}>{c.restore}</button></div>)}</div> : null}
      </fieldset>
      {disabling ? <label className={`${styles.check} ${styles.warning}`}><input type="checkbox" checked={acknowledged} disabled={saving} onChange={(event) => setAcknowledged(event.target.checked)} />{c.acknowledge}</label> : null}
      <footer className={styles.actions}><div aria-live="polite">{error ? <p className={styles.error} role="alert">{error} <button type="button" disabled={saving} onClick={() => void load()}>{c.retry}</button></p> : message ? <p className={styles.success} role="status">{message}</p> : <p>{dirty ? c.dirty : c.clean}</p>}</div><div className={styles.buttons}><button type="button" disabled={!dirty || saving} onClick={() => { edit(structuredClone(saved.configuration)); setAcknowledged(false); }}>{c.discard}</button><button className={styles.primary} type="submit" disabled={!dirty || saving || (disabling && !acknowledged)}>{saving ? c.saving : c.save}</button></div></footer>
    </form>
  </section>;
}
