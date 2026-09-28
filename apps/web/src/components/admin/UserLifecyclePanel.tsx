"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import type { AdminUserSummary, DeletionImpact, LifecycleCandidate, ManagedUserRole, UserAccessDetails, UserDeletionJob } from "@topgsm/shared-types";
import type { Locale } from "@/lib/i18n";
import { api } from "@/lib/api/client";
import { lifecycleCopy } from "./user-lifecycle-copy";
import styles from "./UserLifecyclePanel.module.css";

const roles: ManagedUserRole[] = ["buyer", "seller_staff", "seller_admin", "platform_staff", "platform_admin"];
const permissions = ["vendors_manage", "catalog_view", "orders_manage", "payouts_manage", "blog_manage", "uploads_manage"] as const;
type ChoicePage = { items: LifecycleCandidate[]; nextCursor: string | null };

function SearchChoice({ path, locale, label, value, onChange, initial }: { path: string; locale: Locale; label: string; value: string; onChange: (id: string) => void; initial?: LifecycleCandidate[] }) {
  const c = lifecycleCopy[locale];
  const [search, setSearch] = useState("");
  const [page, setPage] = useState<ChoicePage>({ items: initial ?? [], nextCursor: null });
  const [busy, setBusy] = useState(false); const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  const generation = useRef(0);
  useEffect(() => {
    generation.current++;
    const controller = new AbortController();
    setBusy(true); setError(false);
    const timer = setTimeout(() => {
      void api.get<ChoicePage>(path, { params: { search }, signal: controller.signal }).then(r => {
        if (!controller.signal.aborted) setPage(r.data);
      }).catch(() => { if (!controller.signal.aborted) setError(true); }).finally(() => { if (!controller.signal.aborted) setBusy(false); });
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [path, search, revision]);
  async function more() {
    const current = generation.current;
    setBusy(true); setError(false);
    try { const r = await api.get<ChoicePage>(path, { params: { search, cursor: page.nextCursor } }); if (current === generation.current) setPage(p => ({ items: [...p.items, ...r.data.items], nextCursor: r.data.nextCursor })); }
    catch { if (current === generation.current) setError(true); } finally { if (current === generation.current) setBusy(false); }
  }
  const options = [...(initial ?? []), ...page.items].filter((item, index, all) => all.findIndex(v => v.id === item.id) === index);
  return <div className={styles.form}>
    <label>{c.search} · {label}<input type="search" maxLength={100} value={search} onChange={e => { onChange(""); setSearch(e.target.value); }} /></label>
    <label>{label}<select value={value} onChange={e => onChange(e.target.value)}><option value="">{c.select}</option>{options.map(item => <option value={item.id} key={item.id}>{item.label}{item.sellerName ? ` · ${item.sellerName}` : ""}</option>)}</select></label>
    {busy ? <p role="status">{c.loading}</p> : null}
    {error ? <div role="alert"><p>{c.error}</p><button type="button" onClick={() => setRevision(n => n + 1)}>{c.retry}</button></div> : null}
    {page.nextCursor ? <button type="button" disabled={busy} onClick={() => void more()}>{c.more}</button> : null}
  </div>;
}

export function UserLifecyclePanel({ userId, locale, onSaved }: { userId: string; locale: Locale; onSaved: (user: AdminUserSummary) => void }) {
  const c = lifecycleCopy[locale]; const base = `/admin/users/${userId}`;
  const term = (key: string) => c[key as keyof typeof c] ?? key;
  const [access, setAccess] = useState<UserAccessDetails | null>(null);
  const [mode, setMode] = useState<"role" | "status" | "delete" | null>(null);
  const [role, setRole] = useState<ManagedUserRole>("buyer"); const [sellerId, setSellerId] = useState("");
  const [selectedPermissions, setPermissions] = useState<string[]>([]);
  const [replacement, setReplacement] = useState(""); const [impact, setImpact] = useState<DeletionImpact | null>(null);
  const [reviewed, setReviewed] = useState(false); const [reason, setReason] = useState("");
  const [password, setPassword] = useState(""); const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false); const [impactBusy, setImpactBusy] = useState(false);
  const [error, setError] = useState(false); const [saved, setSaved] = useState(false); const [revision, setRevision] = useState(0);
  const deletionKey = useRef<string | null>(null);
  const [events, setEvents] = useState<{ id: string; action: string; reason: string; created_at: string }[]>([]);
  useEffect(() => {
    const controller = new AbortController(); setError(false);
    void api.get<UserAccessDetails>(`${base}/access`, { signal: controller.signal }).then(r => setAccess(r.data)).catch(() => { if (!controller.signal.aborted) setError(true); });
    void api.get<typeof events>(`${base}/account-events`, { signal: controller.signal }).then(r => setEvents(r.data)).catch(() => {});
    return () => controller.abort();
  }, [base, revision]);
  const job = access?.job;
  const jobId = job?.id; const jobStatus = job?.status;
  useEffect(() => {
    if (!jobId || !jobStatus || !["running", "queued"].includes(jobStatus)) return;
    const controller = new AbortController(); let inFlight = false;
    const timer = setInterval(() => {
      if (inFlight) return; inFlight = true;
      void api.get<UserDeletionJob>(`${base}/deletion-jobs/${jobId}`, { signal: controller.signal }).then(async r => {
        if (controller.signal.aborted) return;
        setAccess(a => a ? { ...a, job: r.data, status: r.data.status === "completed" ? "deleted" : a.status } : a);
        if (r.data.status === "completed") { const detail = await api.get<AdminUserSummary>(base, { signal: controller.signal }); if (!controller.signal.aborted) onSaved(detail.data); }
      }).catch(() => { if (!controller.signal.aborted) setError(true); }).finally(() => { inFlight = false; });
    }, 2000);
    return () => { clearInterval(timer); controller.abort(); };
  }, [base, jobId, jobStatus, onSaved]);
  useEffect(() => {
    if (mode !== "delete") return;
    const controller = new AbortController(); setImpact(null); setImpactBusy(true); setReviewed(false); setError(false);
    void api.get<DeletionImpact>(`${base}/deletion-impact`, { params: { replacementUserId: replacement || undefined }, signal: controller.signal }).then(r => { if (!controller.signal.aborted) setImpact(r.data); }).catch(() => { if (!controller.signal.aborted) setError(true); }).finally(() => { if (!controller.signal.aborted) setImpactBusy(false); });
    return () => controller.abort();
  }, [base, mode, replacement, revision]);
  function open(next: typeof mode) {
    setMode(next); setError(false); setSaved(false); setReason(""); setPassword(""); setConfirmation(""); setReviewed(false);
    setRole(access?.role ?? "buyer"); setSellerId(access?.ownedSellerId ?? access?.memberships[0]?.sellerId ?? ""); setPermissions(access?.platformPermissions ?? []);
    setReplacement(""); deletionKey.current = null;
  }
  async function refresh() { const r = await api.get<UserAccessDetails>(`${base}/access`); setAccess(r.data); onSaved((await api.get<AdminUserSummary>(base)).data); setRevision(n => n + 1); }
  async function submit(event: FormEvent) {
    event.preventDefault(); if (!access || busy) return;
    setBusy(true); setError(false); setSaved(false);
    try {
      if (mode === "role") await api.patch(`${base}/role`, { role, reason, ...(role.startsWith("seller_") ? { sellerId } : {}), ...(role === "platform_staff" ? { permissions: selectedPermissions } : {}), ...(privileged ? { currentPassword: password, confirmation } : {}) });
      if (mode === "status") await api.patch(`${base}/status`, { status: access.status === "blocked" ? "active" : "blocked", reason });
      if (mode === "delete") {
        deletionKey.current ??= crypto.randomUUID();
        await api.post(`${base}/deletion-jobs`, { idempotencyKey: deletionKey.current, reason, currentPassword: password, confirmation, ...(replacement ? { replacementUserId: replacement } : {}) });
      }
      setPassword(""); setConfirmation(""); setMode(null); setSaved(true); await refresh();
    } catch { setError(true); } finally { setBusy(false); }
  }
  async function retryJob() {
    if (!job || busy) return; setBusy(true); setError(false);
    try { await api.post(`${base}/deletion-jobs/${job.id}/retry`); await refresh(); } catch { setError(true); } finally { setBusy(false); }
  }
  const privileged = mode === "delete" || mode === "role" && [access?.role, role].some(r => r === "platform_admin" || r === "seller_admin");
  const ownerBlocked = mode === "role" && access?.ownedSellerId && (role !== "seller_admin" || sellerId !== access.ownedSellerId);
  const emailBlocked = mode === "role" && role !== "buyer" && access?.requirements.emailRequiredForNonBuyer;
  const mutable = access && ["active", "blocked"].includes(access.status);
  const blocked = !impact || impactBusy || Object.values(impact.blockers).some(Boolean) || impact.replacementRequired && !replacement;
  const numbers = (values: Record<string, number>) => <dl className={styles.facts}>{Object.entries(values).filter(([, n]) => n > 0).map(([key, n]) => <div key={key}><dt>{term(key)}</dt><dd>{n.toLocaleString(locale)}</dd></div>)}</dl>;
  return <section className={styles.panel} aria-labelledby="lifecycle-title" aria-busy={busy}>
    <h3 id="lifecycle-title">{c.title}</h3>
    {!access && !error ? <p role="status">{c.loading}</p> : null}
    {error ? <div role="alert"><p className={styles.error}>{c.error}</p><button type="button" disabled={busy} onClick={() => setRevision(n => n + 1)}>{c.retry}</button></div> : null}
    {saved ? <p role="status">{c.saved}</p> : null}
    {access ? <>
      <dl className={styles.facts}><div><dt>{c.status}</dt><dd><span className={styles.badge}>{term(access.status)}</span></dd></div><div><dt>{c.role}</dt><dd>{term(access.role)}</dd></div><div><dt>{c.permissions}</dt><dd>{access.role === "platform_admin" ? c.platform_admin : access.platformPermissions.map(term).join(" · ") || c.none}</dd></div><div><dt>{c.owner}</dt><dd>{access.ownedSellerId ?? c.none}</dd></div></dl>
      {access.memberships.map(m => <p key={m.sellerId}>{c.seller}: {m.shopName} · {m.role === "admin" ? c.seller_admin : c.seller_staff}{m.canonicalOwner ? ` · ${c.owner}` : ""}</p>)}
      {mutable && !mode ? <div className={styles.actions}><button onClick={() => open("role")}>{c.changeRole}</button><button onClick={() => open("status")}>{access.status === "blocked" ? c.unblock : c.block}</button><button className={styles.danger} onClick={() => open("delete")}>{c.remove}</button></div> : null}
      {mutable && mode ? <form onSubmit={submit}><fieldset disabled={busy} className={styles.form}>
        <h4>{mode === "role" ? c.changeRole : mode === "delete" ? c.review : access.status === "blocked" ? c.unblock : c.block}</h4>
        <p>{mode === "role" ? c.roleHint : mode === "status" ? c.blockHint : c.deleteHint}</p>
        {mode === "role" ? <>
          <label>{c.role}<select value={role} onChange={e => { setRole(e.target.value as ManagedUserRole); setPassword(""); setConfirmation(""); }}>{roles.map(r => <option value={r} key={r}>{term(r)}</option>)}</select></label>
          {role.startsWith("seller_") ? <SearchChoice path={`${base}/role-sellers`} locale={locale} label={c.seller} value={sellerId} onChange={setSellerId} initial={access.memberships.map(m => ({ id: m.sellerId, label: m.shopName, sellerId: m.sellerId, sellerName: null }))} /> : null}
          {role === "platform_staff" ? <fieldset><legend>{c.permissions}</legend><div className={styles.checks}>{permissions.map(p => <label key={p}><input type="checkbox" checked={selectedPermissions.includes(p)} onChange={e => setPermissions(old => e.target.checked ? [...old, p] : old.filter(v => v !== p))} />{term(p)}</label>)}</div></fieldset> : null}
          {ownerBlocked ? <p className={styles.error} role="alert">{c.ownerBlock}</p> : null}
          {emailBlocked ? <p className={styles.error} role="alert">{c.emailBlock}</p> : null}
        </> : null}
        {mode === "delete" ? <>
          {!reviewed ? <SearchChoice path={`${base}/replacements`} locale={locale} label={c.replacement} value={replacement} onChange={value => { setReplacement(value); deletionKey.current = null; }} /> : null}
          {impactBusy ? <p role="status">{c.loading}</p> : null}
          {impact ? <><h4>{c.counts}</h4>{impact.sourceSellerId ? <p>{c.emailBlock}</p> : null}{numbers(impact.counts)}<p>{c.replacement}: {impact.replacementLabel ?? c.none}</p><p>{c.destination}: {impact.destinationSellerId ?? impact.sourceSellerId ?? c.none} · {term(impact.mode)}</p>
            {impact.replacementRequired && !replacement ? <p>{c.required}</p> : null}
            {Object.values(impact.blockers).some(Boolean) ? <><h4 className={styles.error}>{c.blockers}</h4>{numbers(impact.blockers)}</> : null}
            {impact.mode === "merge" ? <><p>{c.mergeHint}</p><h4>{c.conflicts}</h4>{numbers(impact.conflicts)}</> : null}<p>{c.frozenHint}</p></> : null}
        </> : null}
        {mode !== "delete" || reviewed ? <>
          <label>{c.reason}<textarea required minLength={3} maxLength={500} value={reason} onChange={e => setReason(e.target.value)} /></label>
          {privileged ? <><label>{c.password}<input required type="password" autoComplete="current-password" maxLength={128} value={password} onChange={e => setPassword(e.target.value)} /></label><label>{c.confirmation}: <code dir="ltr">{impact && mode === "delete" ? impact.identifier : access.identifier}</code><input required dir="ltr" autoComplete="off" maxLength={254} value={confirmation} onChange={e => setConfirmation(e.target.value)} /></label></> : null}
        </> : null}
        <div className={styles.actions}>
          {mode === "delete" && !reviewed ? <button type="button" disabled={Boolean(blocked)} onClick={() => setReviewed(true)}>{c.next}</button> : <button type="submit" className={mode === "delete" ? styles.danger : undefined} disabled={Boolean(emailBlocked) || Boolean(ownerBlocked) || reason.trim().length < 3 || privileged && (!password || confirmation !== (mode === "delete" ? impact?.identifier : access.identifier)) || mode === "delete" && Boolean(blocked) || mode === "role" && role.startsWith("seller_") && !sellerId}>{busy ? c.loading : mode === "delete" ? c.start : c.save}</button>}
          {reviewed ? <button type="button" onClick={() => { setReviewed(false); setPassword(""); }}>{c.back}</button> : null}<button type="button" onClick={() => open(null)}>{c.cancel}</button>
        </div>
      </fieldset></form> : null}
      {job ? <div className={styles.form}><h4>{c.progress}</h4><p role="status">{term(job.status)} · {term(job.phase)}</p>{job.errorCode ? <code>{job.errorCode}</code> : null}<p>{c.destination}: {job.destinationSellerId ?? job.sourceSellerId ?? c.none}</p>{Object.values(job.conflictReport).some(Boolean) ? <><h4>{c.conflicts}</h4>{numbers(job.conflictReport)}<p>{c.mergeHint}</p></> : null}<div className={styles.table}><table><thead><tr><th>{c.counts}</th>{[c.transferred, c.archived, c.skipped, c.conflicted].map(t => <th key={t}>{t}</th>)}</tr></thead><tbody>{Object.entries(job.progress).map(([phase, counts]) => <tr key={phase}><th>{term(phase)}</th>{[counts.transferred, counts.archived, counts.skipped, counts.conflicted].map((n, i) => <td key={i}>{n.toLocaleString(locale)}</td>)}</tr>)}</tbody></table></div>{job.status === "failed" ? <><p>{c.frozenHint}</p><button type="button" disabled={busy} onClick={() => void retryJob()}>{c.retry}</button></> : null}</div> : null}
      {events.length ? <details><summary>{c.audit}</summary>{events.map(e => <p key={e.id}><time>{new Date(e.created_at).toLocaleString(locale)}</time> · {e.action} · {e.reason}</p>)}</details> : null}
    </> : null}
  </section>;
}
