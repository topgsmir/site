"use client";

import type { PlatformPermission } from "@topgsm/shared-types";
import NextLink from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api/client";
import type { Locale } from "@/lib/i18n";
import styles from "./StaffWorkspace.module.css";

const PERMISSIONS: PlatformPermission[] = ["vendors_manage", "catalog_view", "orders_manage", "payouts_manage", "blog_manage"];
type Staff = { id: string; fullName: string; email: string; permissions: PlatformPermission[]; createdAt: string };
type Invitation = { id: string; fullName: string; email: string; permissions: PlatformPermission[]; status: string; expiresAt: string };

export function StaffWorkspace({ locale }: { locale: Locale }) {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [permissions, setPermissions] = useState<PlatformPermission[]>(["blog_manage"]);
  const [message, setMessage] = useState("Loading…");
  const [setupUrl, setSetupUrl] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await api.get<{ staff: Staff[]; invitations: Invitation[] }>("/admin/staff");
      setStaff(response.data.staff); setInvitations(response.data.invitations); setMessage("");
    } catch { setMessage("Staff records could not be loaded."); }
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function invite(event: FormEvent) {
    event.preventDefault(); setMessage("Creating invitation…"); setSetupUrl("");
    try {
      const response = await api.post<{ setupToken: string }>("/admin/staff", { fullName, email, permissions, expiresInHours: 48 });
      setSetupUrl(`${window.location.origin}/${locale}/staff-setup/${response.data.setupToken}`);
      setFullName(""); setEmail(""); setMessage("Invitation created. Copy the one-time setup URL now."); await load();
    } catch { setMessage("Invitation could not be created."); }
  }

  async function revoke(id: string) {
    setMessage("Revoking access…");
    try { await api.delete(`/admin/staff/${id}`); await load(); setMessage("Access revoked and active sessions ended."); }
    catch { setMessage("Access could not be revoked."); }
  }

  async function toggleStaff(user: Staff, permission: PlatformPermission) {
    const next = user.permissions.includes(permission)
      ? user.permissions.filter((item) => item !== permission)
      : [...user.permissions, permission];
    setMessage("Saving permissions…");
    try { await api.patch(`/admin/staff/${user.id}`, { permissions: next }); await load(); setMessage("Permissions updated; existing sessions were revoked."); }
    catch { setMessage("Permissions could not be updated."); }
  }

  return <main className={styles.shell}>
    <header className={styles.header}><div><h1>Platform staff</h1><p>Only the protected owner can invite staff, grant explicit capabilities, or revoke access. Every permission change ends active sessions.</p></div><NextLink href={`/${locale}/admin`}>Back to admin</NextLink></header>
    <div className={styles.grid}>
      <section className={styles.panel}><h2>Invite staff member</h2><form className={styles.form} onSubmit={invite}><label className={styles.field}><span>Full name</span><input required minLength={2} maxLength={200} value={fullName} onChange={(event) => setFullName(event.target.value)} /></label><label className={styles.field}><span>Email</span><input required type="email" maxLength={320} value={email} onChange={(event) => setEmail(event.target.value)} /></label><fieldset className={styles.permissions}><legend className={styles.legend}>Permissions</legend>{PERMISSIONS.map((permission) => <label key={permission}><input type="checkbox" checked={permissions.includes(permission)} onChange={(event) => setPermissions((current) => event.target.checked ? [...current, permission] : current.filter((item) => item !== permission))} />{permission}</label>)}</fieldset><button className={`${styles.button} ${styles.primary}`} type="submit">Create 48-hour invitation</button></form>{setupUrl ? <p className={styles.setup}>{setupUrl}</p> : null}<p className={styles.message} role="status">{message}</p></section>
      <section className={styles.panel}><h2>Current staff</h2><div className={styles.list}>{staff.map((user) => <article className={styles.card} key={user.id}><header><div><strong>{user.fullName}</strong><p>{user.email}</p></div></header><fieldset className={styles.permissions}><legend className={styles.legend}>Live permissions</legend>{PERMISSIONS.map((permission) => <label key={permission}><input type="checkbox" checked={user.permissions.includes(permission)} onChange={() => void toggleStaff(user, permission)} />{permission}</label>)}</fieldset><footer><button className={`${styles.button} ${styles.danger}`} type="button" onClick={() => void revoke(user.id)}>Revoke staff access</button></footer></article>)}{!staff.length ? <p className={styles.message}>No delegated staff accounts.</p> : null}</div><h2>Pending invitations</h2><div className={styles.list}>{invitations.map((invitation) => <article className={styles.card} key={invitation.id}><header><div><strong>{invitation.fullName}</strong><p>{invitation.email}</p></div><time>{new Date(invitation.expiresAt).toLocaleString()}</time></header><p>{invitation.permissions.join(" · ")}</p><footer><button className={`${styles.button} ${styles.danger}`} type="button" onClick={() => void revoke(invitation.id)}>Revoke invitation</button></footer></article>)}</div></section>
    </div>
  </main>;
}
