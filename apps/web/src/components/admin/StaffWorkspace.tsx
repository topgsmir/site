"use client";

import type { PlatformPermission } from "@topgsm/shared-types";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api/client";
import type { Locale } from "@/lib/i18n";
import styles from "./StaffWorkspace.module.css";

const PERMISSIONS: PlatformPermission[] = ["vendors_manage", "catalog_view", "orders_manage", "payouts_manage", "blog_manage", "uploads_manage"];
type Staff = { id: string; fullName: string; email: string; permissions: PlatformPermission[]; createdAt: string };
type Invitation = { id: string; fullName: string; email: string; permissions: PlatformPermission[]; status: string; expiresAt: string };

const COPY = {
  en: { title: "Platform staff", intro: "Only the protected owner can invite staff, grant explicit capabilities, or revoke access. Every permission change ends active sessions.", invite: "Invite staff member", fullName: "Full name", email: "Email", permissions: "Permissions", livePermissions: "Live permissions", create: "Create 48-hour invitation", current: "Current staff", pending: "Pending invitations", revokeStaff: "Revoke staff access", revokeInvite: "Revoke invitation", empty: "No delegated staff accounts.", loading: "Loading…", loadError: "Staff records could not be loaded.", creating: "Creating invitation…", created: "Invitation created. Copy the one-time setup URL now.", createError: "Invitation could not be created.", revoking: "Revoking access…", revoked: "Access revoked and active sessions ended.", revokeError: "Access could not be revoked.", saving: "Saving permissions…", saved: "Permissions updated; existing sessions were revoked.", saveError: "Permissions could not be updated." },
  fa: { title: "کارکنان پلتفرم", intro: "فقط مالک محافظت‌شده می‌تواند همکار دعوت کند، دسترسی مشخص بدهد یا دسترسی را لغو کند. هر تغییر دسترسی، نشست‌های فعال را پایان می‌دهد.", invite: "دعوت همکار", fullName: "نام و نام خانوادگی", email: "ایمیل", permissions: "دسترسی‌ها", livePermissions: "دسترسی‌های فعال", create: "ساخت دعوت‌نامه ۴۸ ساعته", current: "کارکنان فعلی", pending: "دعوت‌نامه‌های در انتظار", revokeStaff: "لغو دسترسی همکار", revokeInvite: "لغو دعوت‌نامه", empty: "هنوز حساب همکاری واگذار نشده است.", loading: "در حال بارگذاری…", loadError: "اطلاعات کارکنان بارگذاری نشد.", creating: "در حال ساخت دعوت‌نامه…", created: "دعوت‌نامه ساخته شد. نشانی یک‌بارمصرف را همین حالا کپی کنید.", createError: "دعوت‌نامه ساخته نشد.", revoking: "در حال لغو دسترسی…", revoked: "دسترسی لغو و نشست‌های فعال پایان داده شد.", revokeError: "لغو دسترسی انجام نشد.", saving: "در حال ذخیره دسترسی‌ها…", saved: "دسترسی‌ها به‌روزرسانی و نشست‌های قبلی لغو شد.", saveError: "دسترسی‌ها ذخیره نشد." },
  ar: { title: "فريق المنصة", intro: "يمكن للمالك المحمي فقط دعوة الموظفين ومنح الصلاحيات المحددة أو إلغاء الوصول. ينهي كل تغيير للصلاحيات الجلسات النشطة.", invite: "دعوة موظف", fullName: "الاسم الكامل", email: "البريد الإلكتروني", permissions: "الصلاحيات", livePermissions: "الصلاحيات الحالية", create: "إنشاء دعوة لمدة 48 ساعة", current: "الفريق الحالي", pending: "الدعوات المعلقة", revokeStaff: "إلغاء وصول الموظف", revokeInvite: "إلغاء الدعوة", empty: "لا توجد حسابات موظفين مفوضة.", loading: "جارٍ التحميل…", loadError: "تعذر تحميل سجلات الفريق.", creating: "جارٍ إنشاء الدعوة…", created: "تم إنشاء الدعوة. انسخ رابط الإعداد لمرة واحدة الآن.", createError: "تعذر إنشاء الدعوة.", revoking: "جارٍ إلغاء الوصول…", revoked: "أُلغي الوصول وأُنهيت الجلسات النشطة.", revokeError: "تعذر إلغاء الوصول.", saving: "جارٍ حفظ الصلاحيات…", saved: "حُدثت الصلاحيات وأُلغيت الجلسات السابقة.", saveError: "تعذر حفظ الصلاحيات." }
} as const;

const PERMISSION_COPY: Record<Locale, Record<PlatformPermission, string>> = {
  en: { vendors_manage: "Manage vendors", catalog_view: "View catalog", orders_manage: "Manage orders", payouts_manage: "Manage payouts", blog_manage: "Manage blog", uploads_manage: "Manage uploads" },
  fa: { vendors_manage: "مدیریت فروشندگان", catalog_view: "مشاهده کاتالوگ", orders_manage: "مدیریت سفارش‌ها", payouts_manage: "مدیریت تسویه‌ها", blog_manage: "مدیریت وبلاگ", uploads_manage: "مدیریت آپلود ها" },
  ar: { vendors_manage: "إدارة البائعين", catalog_view: "عرض الكتالوج", orders_manage: "إدارة الطلبات", payouts_manage: "إدارة المدفوعات", blog_manage: "إدارة المدونة", uploads_manage: "إدارة الملفات المرفوعة" }
};

export function StaffWorkspace({ locale }: { locale: Locale }) {
  const c = COPY[locale];
  const permissionCopy = PERMISSION_COPY[locale];
  const [staff, setStaff] = useState<Staff[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [permissions, setPermissions] = useState<PlatformPermission[]>(["blog_manage"]);
  const [message, setMessage] = useState<string>(c.loading);
  const [setupUrl, setSetupUrl] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await api.get<{ staff: Staff[]; invitations: Invitation[] }>("/admin/staff");
      setStaff(response.data.staff); setInvitations(response.data.invitations); setMessage("");
    } catch { setMessage(c.loadError); }
  }, [c.loadError]);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function invite(event: FormEvent) {
    event.preventDefault(); setMessage(c.creating); setSetupUrl("");
    try {
      const response = await api.post<{ setupToken: string }>("/admin/staff", { fullName, email, permissions, expiresInHours: 48 });
      setSetupUrl(`${window.location.origin}/${locale}/staff-setup/${response.data.setupToken}`);
      setFullName(""); setEmail(""); setMessage(c.created); await load();
    } catch { setMessage(c.createError); }
  }

  async function revoke(id: string) {
    setMessage(c.revoking);
    try { await api.delete(`/admin/staff/${id}`); await load(); setMessage(c.revoked); }
    catch { setMessage(c.revokeError); }
  }

  async function toggleStaff(user: Staff, permission: PlatformPermission) {
    const next = user.permissions.includes(permission)
      ? user.permissions.filter((item) => item !== permission)
      : [...user.permissions, permission];
    setMessage(c.saving);
    try { await api.patch(`/admin/staff/${user.id}`, { permissions: next }); await load(); setMessage(c.saved); }
    catch { setMessage(c.saveError); }
  }

  return <section className={styles.workspace} aria-labelledby="platform-staff-title">
    <header className={styles.header}><div><h1 id="platform-staff-title">{c.title}</h1><p>{c.intro}</p></div></header>
    <div className={styles.grid}>
      <section className={styles.panel}><h2>{c.invite}</h2><form className={styles.form} onSubmit={invite}><label className={styles.field}><span>{c.fullName}</span><input required minLength={2} maxLength={200} value={fullName} onChange={(event) => setFullName(event.target.value)} /></label><label className={styles.field}><span>{c.email}</span><input required type="email" maxLength={320} value={email} onChange={(event) => setEmail(event.target.value)} /></label><fieldset className={styles.permissions}><legend className={styles.legend}>{c.permissions}</legend>{PERMISSIONS.map((permission) => <label key={permission}><input type="checkbox" checked={permissions.includes(permission)} onChange={(event) => setPermissions((current) => event.target.checked ? [...current, permission] : current.filter((item) => item !== permission))} />{permissionCopy[permission]}</label>)}</fieldset><button className={`${styles.button} ${styles.primary}`} type="submit">{c.create}</button></form>{setupUrl ? <p className={styles.setup} dir="ltr">{setupUrl}</p> : null}<p className={styles.message} role="status">{message}</p></section>
      <section className={styles.panel}><h2>{c.current}</h2><div className={styles.list}>{staff.map((user) => <article className={styles.card} key={user.id}><header><div><strong>{user.fullName}</strong><p>{user.email}</p></div></header><fieldset className={styles.permissions}><legend className={styles.legend}>{c.livePermissions}</legend>{PERMISSIONS.map((permission) => <label key={permission}><input type="checkbox" checked={user.permissions.includes(permission)} onChange={() => void toggleStaff(user, permission)} />{permissionCopy[permission]}</label>)}</fieldset><footer><button className={`${styles.button} ${styles.danger}`} type="button" onClick={() => void revoke(user.id)}>{c.revokeStaff}</button></footer></article>)}{!staff.length ? <p className={styles.message}>{c.empty}</p> : null}</div><h2>{c.pending}</h2><div className={styles.list}>{invitations.map((invitation) => <article className={styles.card} key={invitation.id}><header><div><strong>{invitation.fullName}</strong><p>{invitation.email}</p></div><time>{new Date(invitation.expiresAt).toLocaleString(locale)}</time></header><p>{invitation.permissions.map((permission) => permissionCopy[permission]).join(" · ")}</p><footer><button className={`${styles.button} ${styles.danger}`} type="button" onClick={() => void revoke(invitation.id)}>{c.revokeInvite}</button></footer></article>)}</div></section>
    </div>
  </section>;
}
