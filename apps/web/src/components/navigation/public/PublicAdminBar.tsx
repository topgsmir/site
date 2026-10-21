import Link from "next/link";
import type { Route } from "next";
import type { AppUser } from "@/lib/auth/server";
import type { Locale } from "@/lib/i18n";
import styles from "./PublicAdminBar.module.css";

type Props = { locale: Locale; user: AppUser | null; editHref?: string };

const copy = {
  fa: { edit: "ویرایش", history: "تاریخچه کاربران", admin: "مدیریت", editTitle: "ویرایش این برگه", historyTitle: "تاریخچه کاربران", adminTitle: "پنل مدیریت" },
  en: { edit: "Edit", history: "User history", admin: "Admin", editTitle: "Edit this page", historyTitle: "User history", adminTitle: "Admin panel" },
  ar: { edit: "تعديل", history: "سجل المستخدمين", admin: "الإدارة", editTitle: "تعديل هذه الصفحة", historyTitle: "سجل المستخدمين", adminTitle: "لوحة الإدارة" }
} as const;

function Icon({ name }: { name: "edit" | "history" | "admin" }) {
  if (name === "edit") return <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m3 11.8-.7 2 2-.7L13 4.4 11.6 3 3 11.8Z"/><path d="m10.8 3.8 1.4 1.4M2.5 14.5h11"/></svg>;
  if (name === "history") return <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.2 7a5.8 5.8 0 1 1 .7 3.8M2 3.5V7h3.5M8 4.5V8l2.3 1.4"/></svg>;
  return <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 13.5h12M3.5 13V6l4.5-3 4.5 3v7M6 13V9h4v4M2 6h12"/></svg>;
}

export function PublicAdminBar({ locale, user, editHref }: Props) {
  if (!user || user.role === "buyer") return null;
  const labels = copy[locale];
  const isPlatformAdmin = user.role === "platform-admin";
  const isPlatformStaff = user.role === "platform-staff";
  const canManageUsers = isPlatformAdmin;
  const canOpenAdmin = isPlatformAdmin || isPlatformStaff && Boolean(user.isPlatformOwner || user.platformPermissions?.length);
  const visible = canOpenAdmin || Boolean(editHref);
  if (!visible) return null;
  return <nav className={styles.bar} aria-label={locale === "fa" ? "نوار مدیریت" : locale === "ar" ? "شريط الإدارة" : "Admin toolbar"}>
    <div className={styles.inner}>
      {canOpenAdmin ? <Link href={`/${locale}/admin` as Route} title={labels.adminTitle}><Icon name="admin"/><span>{labels.admin}</span></Link> : null}
      {editHref ? <Link href={editHref as Route} title={labels.editTitle}><Icon name="edit"/><span>{labels.edit}</span></Link> : null}
      {canManageUsers ? <Link href={`/${locale}/admin/users` as Route} title={labels.historyTitle}><Icon name="history"/><span>{labels.history}</span></Link> : null}
    </div>
  </nav>;
}
