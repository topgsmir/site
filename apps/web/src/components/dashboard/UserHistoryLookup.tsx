"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import type { AdminUsersPage, SellerCustomersPage } from "@topgsm/shared-types";
import { api } from "@/lib/api/client";
import type { Locale } from "@/lib/i18n";
import styles from "./UserHistoryLookup.module.css";

const copy = {
  en: {
    title: "Find user history",
    hint: "Search by name, email, phone, username or support code.",
    label: "User search",
    placeholder: "Enter at least 3 characters",
    search: "Search",
    loading: "Searching…",
    empty: "No matching users found.",
    error: "Search failed. Try again.",
    many: "Several users match. Choose the account to view its history.",
    refine: "More users match. Refine your search.",
    orders: "orders",
  },
  fa: {
    title: "جستجوی سابقه کاربر",
    hint: "با نام، ایمیل، تلفن، نام کاربری یا کد اشتراک جستجو کنید.",
    label: "جستجوی کاربر",
    placeholder: "حداقل ۳ نویسه وارد کنید",
    search: "جستجو",
    loading: "در حال جستجو…",
    empty: "کاربر منطبقی پیدا نشد.",
    error: "جستجو انجام نشد. دوباره تلاش کنید.",
    many: "چند کاربر پیدا شد. حساب موردنظر را برای دیدن سابقه انتخاب کنید.",
    refine: "نتایج بیشتری وجود دارد. جستجو را دقیق‌تر کنید.",
    orders: "سفارش",
  },
  ar: {
    title: "البحث في سجل المستخدم",
    hint: "ابحث بالاسم أو البريد أو الهاتف أو اسم المستخدم أو معرّف الدعم.",
    label: "بحث المستخدم",
    placeholder: "أدخل 3 أحرف على الأقل",
    search: "بحث",
    loading: "جارٍ البحث…",
    empty: "لم يتم العثور على مستخدم مطابق.",
    error: "تعذر البحث. حاول مجددًا.",
    many: "تطابق عدة مستخدمين. اختر الحساب لعرض سجله.",
    refine: "توجد نتائج أخرى. حدّد البحث أكثر.",
    orders: "طلبات",
  },
} as const;
const sellerTitle = {
  en: "Find user history",
  fa: "جستجوی سابقه کاربر",
  ar: "البحث في سجل المستخدم",
} as const;

type Result = {
  id: string;
  name: string;
  contact: string | null;
  orderCount: number;
};

export function UserHistoryLookup({
  locale,
  audience,
}: {
  locale: Locale;
  audience: "admin" | "seller";
}) {
  const c = copy[locale];
  const router = useRouter();
  const requestId = useRef(0);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  function open(id: string) {
    const path =
      audience === "admin"
        ? `/${locale}/admin/users/${encodeURIComponent(id)}`
        : `/${locale}/seller-dashboard/customers/${encodeURIComponent(id)}`;
    router.push(path as Route);
  }

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const term = query.trim();
    if (term.length < 3 || loading) return;
    const currentRequest = ++requestId.current;
    setLoading(true);
    setError(false);
    setResults(null);
    try {
      if (audience === "admin") {
        const response = await api.get<AdminUsersPage>("/admin/users", {
          params: { search: term, limit: 8, page: 1 },
        });
        if (currentRequest !== requestId.current) return;
        const matches = response.data.items.map((user) => ({
          id: user.id,
          name: user.fullName,
          contact: user.phoneNumber ?? user.email,
          orderCount: user.orderCount,
        }));
        setHasMore(response.data.total > matches.length);
        if (matches.length === 1 && response.data.total === 1) {
          open(matches[0].id);
          return;
        }
        setResults(matches);
      } else {
        const response = await api.get<SellerCustomersPage>(
          "/seller/customers",
          { params: { search: term, limit: 8 } },
        );
        if (currentRequest !== requestId.current) return;
        const matches = response.data.items.map((user) => ({
          id: user.id,
          name: user.fullName,
          contact: user.phoneNumber ?? user.email,
          orderCount: user.orderCount,
        }));
        setHasMore(Boolean(response.data.nextCursor));
        if (matches.length === 1 && !response.data.nextCursor) {
          open(matches[0].id);
          return;
        }
        setResults(matches);
      }
    } catch {
      if (currentRequest === requestId.current) setError(true);
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }

  return (
    <section
      className={styles.lookup}
      aria-labelledby={`user-history-lookup-${audience}`}
    >
      <div className={styles.heading}>
        <h2 id={`user-history-lookup-${audience}`}>
          {audience === "seller" ? sellerTitle[locale] : c.title}
        </h2>
        <p className={styles.srOnly} id={`user-history-hint-${audience}`}>{c.hint}</p>
      </div>
      <form onSubmit={(event) => void search(event)}>
        <label
          className={styles.srOnly}
          htmlFor={`user-history-search-${audience}`}
        >
          {c.label}
        </label>
        <input
          id={`user-history-search-${audience}`}
          aria-describedby={`user-history-hint-${audience}`}
          type="search"
          maxLength={100}
          value={query}
          placeholder={c.placeholder}
          onChange={(event) => {
            requestId.current++;
            setQuery(event.target.value);
            setResults(null);
            setLoading(false);
          }}
        />
        <button type="submit" disabled={loading || query.trim().length < 3}>
          {loading ? c.loading : c.search}
        </button>
      </form>
      {error ? (
        <p className={styles.error} role="alert">
          {c.error}
        </p>
      ) : null}
      {results?.length === 0 ? (
        <p className={styles.state} role="status">
          {c.empty}
        </p>
      ) : null}
      {results && results.length > 0 ? (
        <div className={styles.matches}>
          <p className={styles.state}>{c.many}</p>
          <ul>
            {results.map((user) => (
              <li key={user.id}>
                <button type="button" onClick={() => open(user.id)}>
                  <strong>{user.name}</strong>
                  <span dir="ltr">{user.contact ?? "—"}</span>
                  <small>
                    {user.orderCount.toLocaleString(locale)} {c.orders}
                  </small>
                </button>
              </li>
            ))}
          </ul>
          {hasMore ? <p className={styles.state}>{c.refine}</p> : null}
        </div>
      ) : null}
    </section>
  );
}
