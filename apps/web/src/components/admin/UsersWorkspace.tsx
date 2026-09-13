"use client";

import { useCallback, useEffect, useState } from "react";
import type { AdminUserSummary, AdminUsersPage } from "@topgsm/shared-types";
import type { Locale } from "@/lib/i18n";
import { api } from "@/lib/api/client";
import styles from "./UsersWorkspace.module.css";

const copy = {
  en: {
    title: "Users",
    intro: "View customer accounts and their order activity.",
    orders: "Orders",
    joined: "Joined",
    phoneMissing: "No phone number",
    empty: "No customer accounts yet.",
    loading: "Loading users…",
    loadMore: "Load more",
    loadError: "Users could not be loaded. Refresh and try again."
  },
  fa: {
    title: "کاربران",
    intro: "حساب مشتریان و سابقه سفارش‌های آن‌ها را مشاهده کنید.",
    orders: "سفارش",
    joined: "عضویت",
    phoneMissing: "بدون شماره تماس",
    empty: "هنوز حساب مشتری‌ای وجود ندارد.",
    loading: "در حال بارگذاری کاربران…",
    loadMore: "بارگذاری بیشتر",
    loadError: "کاربران بارگذاری نشدند. صفحه را تازه کنید."
  },
  ar: {
    title: "المستخدمون",
    intro: "اعرض حسابات العملاء ونشاط طلباتهم.",
    orders: "الطلبات",
    joined: "تاريخ الانضمام",
    phoneMissing: "لا يوجد رقم هاتف",
    empty: "لا توجد حسابات عملاء بعد.",
    loading: "جارٍ تحميل المستخدمين…",
    loadMore: "تحميل المزيد",
    loadError: "تعذر تحميل المستخدمين. حدّث الصفحة وحاول مجدداً."
  }
} as const;

export function UsersWorkspace({ locale }: { locale: Locale }) {
  const c = copy[locale];
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (cursor?: string) => {
    setLoading(true);
    setError("");
    try {
      const response = await api.get<AdminUsersPage>("/admin/users", {
        params: { limit: 20, ...(cursor ? { cursor } : {}) }
      });
      setUsers((current) => cursor ? [...current, ...response.data.items] : response.data.items);
      setNextCursor(response.data.nextCursor);
    } catch {
      setError(c.loadError);
    } finally {
      setLoading(false);
    }
  }, [c.loadError]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className={styles.workspace} aria-labelledby="admin-users-title">
      <header className={styles.header}>
        <h1 id="admin-users-title">{c.title}</h1>
        <p>{c.intro}</p>
      </header>

      {error ? <p className={styles.error} role="alert">{error}</p> : null}
      {!loading && !error && users.length === 0 ? <p className={styles.empty}>{c.empty}</p> : null}

      {users.length ? (
        <div className={styles.list}>
          {users.map((user) => (
            <article className={styles.card} key={user.id}>
              <div className={styles.identity}>
                <strong>{user.fullName}</strong>
                <a href={`mailto:${user.email}`}>{user.email}</a>
                <span dir="ltr">{user.phoneNumber ?? c.phoneMissing}</span>
              </div>
              <dl className={styles.meta}>
                <div><dt>{c.orders}</dt><dd>{user.orderCount.toLocaleString(locale)}</dd></div>
                <div><dt>{c.joined}</dt><dd>{new Date(user.createdAt).toLocaleDateString(locale)}</dd></div>
              </dl>
            </article>
          ))}
        </div>
      ) : null}

      {loading ? <p className={styles.loading} role="status">{c.loading}</p> : null}
      {!loading && nextCursor ? (
        <button className={styles.more} type="button" onClick={() => void load(nextCursor)}>
          {c.loadMore}
        </button>
      ) : null}
    </section>
  );
}
