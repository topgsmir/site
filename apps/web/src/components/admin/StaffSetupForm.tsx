"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api/client";
import type { Locale } from "@/lib/i18n";
import styles from "./StaffWorkspace.module.css";

export function StaffSetupForm({ locale, token }: { locale: Locale; token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (password !== confirm) { setMessage("Passwords do not match."); return; }
    setBusy(true); setMessage("");
    try {
      await api.post(`/admin/staff/setup/${token}`, { password });
      router.push(`/${locale}/login`);
    } catch { setMessage("This invitation is invalid, expired, already used, or the email already has an account."); setBusy(false); }
  }
  return <main className={styles.shell}><section className={styles.panel} style={{ maxWidth: 520, marginInline: "auto" }}><h1>Complete staff setup</h1><p className={styles.message}>Choose a password with at least 12 characters. This setup link can be used once.</p><form className={styles.form} onSubmit={submit}><label className={styles.field}><span>Password</span><input type="password" minLength={12} maxLength={128} required value={password} onChange={(event) => setPassword(event.target.value)} /></label><label className={styles.field}><span>Confirm password</span><input type="password" minLength={12} maxLength={128} required value={confirm} onChange={(event) => setConfirm(event.target.value)} /></label><button className={`${styles.button} ${styles.primary}`} type="submit" disabled={busy}>{busy ? "Creating account…" : "Create staff account"}</button></form>{message ? <p className={styles.message} role="alert">{message}</p> : null}</section></main>;
}
