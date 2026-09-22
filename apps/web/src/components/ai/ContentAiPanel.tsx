"use client";

import { useEffect, useRef, useState } from "react";
import { isAxiosError } from "axios";
import type { BlogLocale, ContentAiDraft, ContentAiRequest, ContentAiResult } from "@topgsm/shared-types";
import type { Locale } from "@/lib/i18n";
import { api } from "@/lib/api/client";
import { RichText } from "@/components/blog/RichText";
import { CONTENT_AI_COPY } from "./content-ai-copy";
import styles from "./ContentAiPanel.module.css";

export type AiField = "title" | "slug" | "excerpt" | "seoTitle" | "seoDescription" | "coverAltText" | "content" | "description" | "category" | "tags";
export type AiDrafts = Partial<Record<BlogLocale, ContentAiDraft>>;
type LanguageState = { status: "writing" | "ready" | "failed"; draft?: ContentAiDraft; error?: string };
type Props = {
  locale: Locale; kind: "blog" | "product"; language?: BlogLocale; fields: AiField[];
  snapshot: string; getSource: () => string; onApply: (drafts: AiDrafts, fields: AiField[]) => string;
  onRestore: (snapshot: string) => void; disabled?: boolean; disabledHint?: string; categories?: string[]; tags?: string[];
};

export function ContentAiPanel({ locale, kind, language = "fa", fields, snapshot, getSource, onApply, onRestore, disabled = false, disabledHint, categories, tags }: Props) {
  const c = CONTENT_AI_COPY[locale];
  const [availability, setAvailability] = useState<{ allowed: boolean; configured: boolean } | null>(null);
  const [availabilityError, setAvailabilityError] = useState(false);
  const [reload, setReload] = useState(0);
  const [source, setSource] = useState("");
  const [keyword, setKeyword] = useState("");
  const [audience, setAudience] = useState("");
  const [coverDescription, setCoverDescription] = useState("");
  const [results, setResults] = useState<Partial<Record<BlogLocale, LanguageState>>>({});
  const [active, setActive] = useState<BlogLocale>(kind === "blog" ? "fa" : language);
  const [selected, setSelected] = useState<AiField[]>(() => fields.filter((field) => kind === "blog" || field !== "slug"));
  const [baseline, setBaseline] = useState<string | null>(null);
  const [undo, setUndo] = useState<{ before: string; after: string } | null>(null);
  const [message, setMessage] = useState("");
  const requestRef = useRef<Omit<ContentAiRequest, "locale"> | null>(null);
  const controllers = useRef(new Set<AbortController>());
  const running = useRef(false);
  const languages: BlogLocale[] = kind === "blog" ? ["fa", "en", "ar"] : [language];
  const writing = Object.values(results).some((result) => result.status === "writing");

  useEffect(() => {
    const controller = new AbortController();
    api.get<{ allowed: boolean; configured: boolean }>(`/ai/authoring/${kind}`, { signal: controller.signal })
      .then(({ data }) => { setAvailability(data); setAvailabilityError(false); })
      .catch(() => { if (!controller.signal.aborted) setAvailabilityError(true); });
    return () => controller.abort();
  }, [kind, reload]);
  useEffect(() => {
    const pending = controllers.current;
    return () => { pending.forEach((controller) => controller.abort()); pending.clear(); };
  }, []);

  async function generateLanguage(code: BlogLocale, input: Omit<ContentAiRequest, "locale">) {
    const controller = new AbortController(); controllers.current.add(controller);
    setResults((current) => ({ ...current, [code]: { status: "writing" } }));
    try {
      const response = await api.post<ContentAiResult>(`/ai/authoring/${kind}`, { ...input, locale: code }, { signal: controller.signal, timeout: 60000 });
      if (response.data.locale !== code || response.data.status !== "ready") throw new Error("Unexpected draft language");
      if (!controller.signal.aborted) setResults((current) => ({ ...current, [code]: { status: "ready", draft: response.data.draft } }));
    } catch (error) {
      if (!controller.signal.aborted) {
        const status = isAxiosError(error) ? error.response?.status : undefined;
        setResults((current) => ({ ...current, [code]: { status: "failed", error: status === 403 ? c.denied : status === 429 ? c.limited : status === 409 ? c.notConfigured : c.error } }));
      }
    } finally { controllers.current.delete(controller); }
  }

  async function generate(retryLanguage?: BlogLocale) {
    if (running.current || disabled) return;
    running.current = true;
    try {
      if (retryLanguage && requestRef.current) { await generateLanguage(retryLanguage, requestRef.current); return; }
      const input = { source: source.trim(), keyword, audience, coverDescription, ...(categories ? { categories: categories.slice(0, 100) } : {}), ...(tags ? { tags: tags.slice(0, 200) } : {}) };
      requestRef.current = input; setBaseline(snapshot); setResults({}); setMessage("");
      await Promise.all(languages.map((code) => generateLanguage(code, input)));
    } finally { running.current = false; }
  }

  const ready = Object.fromEntries(Object.entries(results).flatMap(([code, result]) => result.draft ? [[code, result.draft]] : [])) as AiDrafts;
  const draft = results[active]?.draft;
  const changed = baseline !== null && baseline !== snapshot;
  const fieldLabel = (field: AiField) => field === "title" ? c.titleField : field === "content" ? c.body : c[field];
  function apply() {
    if (changed || writing || disabled || !selected.length) return;
    const after = onApply(ready, selected);
    setUndo({ before: snapshot, after }); setBaseline(after); setMessage(c.applied);
  }
  function download() {
    if (!draft) return;
    const url = URL.createObjectURL(new Blob([draft.html], { type: "text/html;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `article-${active}.html`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  if (!availability?.allowed && !availabilityError) return null;
  return <section className={styles.panel} dir={locale === "en" ? "ltr" : "rtl"}>
    <details>
      <summary>{c.title}</summary>
      <p>{c.intro}</p>
      {disabled && disabledHint && <p role="status">{disabledHint}</p>}
      {availabilityError ? <p role="alert">{c.unavailable} <button type="button" onClick={() => setReload((value) => value + 1)}>{c.reload}</button></p> : !availability?.configured ? <p role="status">{c.notConfigured} <button type="button" onClick={() => setReload((value) => value + 1)}>{c.reload}</button></p> : <>
        <label>{c.source}<textarea rows={5} dir="auto" value={source} maxLength={16000} disabled={writing} onChange={(event) => setSource(event.target.value)} /><small>{c.sourceHint} {source.length}/16000</small></label>
        <button type="button" disabled={writing || disabled} onClick={() => { const value = getSource(); setSource(value); setMessage(value.length > 16000 ? c.sourceLong : ""); }}>{c.current}</button>
        <div className={styles.row}><label>{c.keyword}<input dir="auto" value={keyword} maxLength={120} disabled={writing} onChange={(event) => setKeyword(event.target.value)} /></label><label>{c.audience}<input dir="auto" value={audience} maxLength={500} disabled={writing} onChange={(event) => setAudience(event.target.value)} /></label></div>
        {kind === "blog" ? <><label>{c.cover}<input dir="auto" value={coverDescription} maxLength={500} disabled={writing} onChange={(event) => setCoverDescription(event.target.value)} /></label><p>{c.allLanguages}</p></> : <p>{c.sourceLanguage}: {c[language]}</p>}
        <button type="button" disabled={writing || disabled || source.trim().length < 20 || source.length > 16000} onClick={() => void generate()}>{writing ? c.generating : c.generate}</button>
        {!!Object.keys(results).length && <>
          <div className={styles.tabs} role="group" aria-label={c.preview}>{languages.map((code) => <button type="button" key={code} aria-pressed={active === code} onClick={() => setActive(code)}><span>{c[code]}</span><small>{results[code]?.status === "writing" ? c.generating : results[code]?.status === "ready" ? c.ready : results[code]?.status === "failed" ? c.failed : c.waiting}</small></button>)}</div>
          <p role="status" aria-live="polite">{languages.map((code) => `${c[code]}: ${results[code]?.status === "writing" ? c.generating : results[code]?.status === "ready" ? c.ready : results[code]?.status === "failed" ? c.failed : c.waiting}`).join(" · ")}</p>
          {results[active]?.status === "failed" && <p role="alert">{results[active]?.error} <button type="button" disabled={writing || disabled} onClick={() => void generate(active)}>{c.retry}</button></p>}
          {draft && <>
            <div className={styles.preview} dir={active === "en" ? "ltr" : "rtl"} lang={active}>
              <h3>{draft.title}</h3>
              <RichText document={draft.content} />
              <dl>{fields.filter((field) => !["content", "description", "title"].includes(field)).map((field) => <div key={field}><dt>{fieldLabel(field)}</dt><dd>{field === "tags" ? draft.tags.join("، ") || c.noMatch : String(draft[field] || c.noMatch)}</dd></div>)}</dl>
              {!!draft.warnings.length && <aside className={styles.notice}><strong>{c.review}</strong><ul>{draft.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></aside>}
            </div>
            {kind === "blog" && <button type="button" onClick={download}>{c.download}</button>}
          </>}
          {!!Object.keys(ready).length && <>
            <fieldset className={styles.fields} disabled={writing || disabled}><legend>{c.fields}</legend>{fields.map((field) => <label key={field}><input type="checkbox" checked={selected.includes(field)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, field] : current.filter((item) => item !== field))} />{fieldLabel(field)}</label>)}</fieldset>
            {Object.values(results).some((result) => result.status === "failed") && <p>{c.partial}</p>}
            {changed && <p className={styles.notice}>{c.changed} <button type="button" disabled={writing || disabled} onClick={() => { setBaseline(snapshot); setMessage(""); }}>{c.reviewed}</button></p>}
            <div className={styles.actions}><button type="button" disabled={writing || disabled || changed || !selected.length} onClick={apply}>{c.apply}</button></div>
          </>}
        </>}
        {undo && <p><button type="button" disabled={disabled || writing || undo.after !== snapshot} onClick={() => { onRestore(undo.before); setBaseline(undo.before); setUndo(null); setMessage(""); }}>{c.undo}</button>{undo.after !== snapshot && <small>{c.undoChanged}</small>}</p>}
        {message && <p role="status">{message}</p>}
      </>}
    </details>
  </section>;
}
