"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import type { AdminUserSummary, AdminUsersPage } from "@topgsm/shared-types";
import type { Locale } from "@/lib/i18n";
import { api } from "@/lib/api/client";
import { CollapsibleFilters } from "@/components/dashboard/CollapsibleFilters";
import { UserDetailWorkspace } from "./UserDetailWorkspace";
import styles from "./UsersWorkspace.module.css";

const copy = {
  en: { title: "Users", intro: "Search accounts, review their records, and update contact details.", search: "Name, email, username, phone or ID", searchLabel: "Search users", moreFilters: "More filters", role: "Role", all: "All", orders: "Orders", phone: "Phone", yes: "Has", no: "None", joinedFrom: "Joined from", joinedTo: "Joined through", sort: "Sort by", newest: "Newest", oldest: "Oldest", name: "Name", mostOrders: "Most orders", apply: "Apply filters", reset: "Reset filters", empty: "No users match these filters.", loading: "Loading users…", loadError: "Users could not be loaded.", retry: "Try again", previous: "Previous", next: "Next", page: "Page", of: "of", results: "users", contact: "Contact", account: "Account", joined: "Joined", view: "View account", buyer: "Buyer", seller_admin: "Seller admin", seller_staff: "Seller staff", platform_staff: "Platform staff", platform_admin: "Platform admin" },
  fa: { title: "کاربران", intro: "حساب‌ها را جست‌وجو کنید، سوابق را ببینید و اطلاعات تماس را ویرایش کنید.", search: "نام، ایمیل، نام کاربری، تلفن یا شناسه", searchLabel: "جست‌وجوی کاربران", moreFilters: "فیلترهای بیشتر", role: "نقش", all: "همه", orders: "سفارش‌ها", phone: "تلفن", yes: "دارد", no: "ندارد", joinedFrom: "عضویت از", joinedTo: "عضویت تا", sort: "مرتب‌سازی", newest: "جدیدترین", oldest: "قدیمی‌ترین", name: "نام", mostOrders: "بیشترین سفارش", apply: "اعمال فیلترها", reset: "پاک کردن فیلترها", empty: "کاربری با این فیلترها پیدا نشد.", loading: "در حال بارگذاری کاربران…", loadError: "کاربران بارگذاری نشدند.", retry: "تلاش دوباره", previous: "قبلی", next: "بعدی", page: "صفحه", of: "از", results: "کاربر", contact: "راه‌های تماس", account: "حساب", joined: "عضویت", view: "مشاهده حساب", buyer: "خریدار", seller_admin: "مدیر فروشنده", seller_staff: "همکار فروشنده", platform_staff: "همکار پلتفرم", platform_admin: "مدیر پلتفرم" },
  ar: { title: "المستخدمون", intro: "ابحث عن الحسابات وراجع سجلاتها وعدّل بيانات الاتصال.", search: "الاسم أو البريد أو اسم المستخدم أو الهاتف أو المعرّف", searchLabel: "بحث المستخدمين", moreFilters: "مرشحات إضافية", role: "الدور", all: "الكل", orders: "الطلبات", phone: "الهاتف", yes: "يوجد", no: "لا يوجد", joinedFrom: "الانضمام من", joinedTo: "الانضمام حتى", sort: "الترتيب", newest: "الأحدث", oldest: "الأقدم", name: "الاسم", mostOrders: "الأكثر طلبات", apply: "تطبيق المرشحات", reset: "مسح المرشحات", empty: "لا يوجد مستخدمون بهذه المرشحات.", loading: "جارٍ تحميل المستخدمين…", loadError: "تعذر تحميل المستخدمين.", retry: "حاول مجدداً", previous: "السابق", next: "التالي", page: "صفحة", of: "من", results: "مستخدم", contact: "الاتصال", account: "الحساب", joined: "الانضمام", view: "عرض الحساب", buyer: "مشترٍ", seller_admin: "مدير بائع", seller_staff: "موظف بائع", platform_staff: "موظف منصة", platform_admin: "مدير منصة" }
} as const;
const roles = ["all", "buyer", "seller_admin", "seller_staff", "platform_staff", "platform_admin"] as const;
type Filters = { search: string; role: typeof roles[number]; hasOrders: "all" | "yes" | "no"; hasPhone: "all" | "yes" | "no"; joinedFrom: string; joinedTo: string; sort: "newest" | "oldest" | "name" | "orders" };
const initialFilters: Filters = { search: "", role: "all", hasOrders: "all", hasPhone: "all", joinedFrom: "", joinedTo: "", sort: "newest" };
const pageSize = 20;

export function UsersWorkspace({ locale }: { locale: Locale }) {
  const c = copy[locale];
  const [draft, setDraft] = useState<Filters>(initialFilters);
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<AdminUsersPage | null>(null);
  const [selected, setSelected] = useState<AdminUserSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const openedUserId = useRef<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(false);
    void api.get<AdminUsersPage>("/admin/users", { params: { ...filters, joinedFrom: filters.joinedFrom || undefined, joinedTo: filters.joinedTo || undefined, page, limit: pageSize }, signal: controller.signal })
      .then((response) => { if (!controller.signal.aborted) setResult(response.data); })
      .catch(() => { if (!controller.signal.aborted) setError(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [filters, page, revision]);

  function apply(event: FormEvent) { event.preventDefault(); setPage(1); setFilters({ ...draft }); }
  function reset() { setDraft(initialFilters); setFilters(initialFilters); setPage(1); }
  function closeDetail() {
    const id = openedUserId.current;
    setSelected(null);
    window.requestAnimationFrame(() => { if (id) document.getElementById(`admin-user-${id}`)?.focus(); });
  }
  const activeFilters = [filters.role !== "all", filters.hasOrders !== "all", filters.hasPhone !== "all", !!filters.joinedFrom, !!filters.joinedTo].filter(Boolean).length;
  const totalActiveFilters = activeFilters + Number(Boolean(filters.search.trim())) + Number(filters.sort !== "newest");
  const pageCount = Math.max(1, Math.ceil((result?.total ?? 0) / pageSize));

  return <section className={styles.workspace} aria-labelledby="admin-users-title">
    <header className={styles.header}><h1 id="admin-users-title">{c.title}</h1><p>{c.intro}</p></header>
    {selected ? <UserDetailWorkspace locale={locale} user={selected} onBack={closeDetail} onSaved={(updated) => { setSelected(updated); setRevision((current) => current + 1); }} /> : <>
      <CollapsibleFilters className={styles.filters} surface={false} locale={locale} title={c.searchLabel} description={c.search} activeCount={totalActiveFilters}>
      <form onSubmit={apply}>
        <div className={styles.filterTop}><label className={styles.search}><span>{c.searchLabel}</span><input type="search" placeholder={c.search} maxLength={100} value={draft.search} onChange={(event) => setDraft({ ...draft, search: event.target.value })} /></label>
          <label className={styles.sort}><span>{c.sort}</span><select value={draft.sort} onChange={(event) => setDraft({ ...draft, sort: event.target.value as Filters["sort"] })}><option value="newest">{c.newest}</option><option value="oldest">{c.oldest}</option><option value="name">{c.name}</option><option value="orders">{c.mostOrders}</option></select></label>
          <button className={styles.primary} type="submit">{c.apply}</button>
        </div>
        <details className={styles.moreFilters} open={activeFilters > 0 ? true : undefined}><summary>{c.moreFilters}{activeFilters ? <span className={styles.filterCount}>{activeFilters}</span> : null}</summary>
          <div className={styles.advancedGrid}>
            <label><span>{c.role}</span><select value={draft.role} onChange={(event) => setDraft({ ...draft, role: event.target.value as Filters["role"] })}>{roles.map((role) => <option key={role} value={role}>{role === "all" ? c.all : c[role]}</option>)}</select></label>
            <label><span>{c.orders}</span><select value={draft.hasOrders} onChange={(event) => setDraft({ ...draft, hasOrders: event.target.value as Filters["hasOrders"] })}><option value="all">{c.all}</option><option value="yes">{c.yes}</option><option value="no">{c.no}</option></select></label>
            <label><span>{c.phone}</span><select value={draft.hasPhone} onChange={(event) => setDraft({ ...draft, hasPhone: event.target.value as Filters["hasPhone"] })}><option value="all">{c.all}</option><option value="yes">{c.yes}</option><option value="no">{c.no}</option></select></label>
            <label><span>{c.joinedFrom}</span><input type="date" value={draft.joinedFrom} onChange={(event) => setDraft({ ...draft, joinedFrom: event.target.value })} /></label>
            <label><span>{c.joinedTo}</span><input type="date" min={draft.joinedFrom || undefined} value={draft.joinedTo} onChange={(event) => setDraft({ ...draft, joinedTo: event.target.value })} /></label>
          </div><div className={styles.filterFooter}><button className={styles.primary} type="submit">{c.apply}</button><button className={styles.secondaryButton} type="button" onClick={reset}>{c.reset}</button></div>
        </details>
      </form>
      </CollapsibleFilters>
      <div className={styles.listToolbar}><strong>{result ? `${result.total.toLocaleString(locale)} ${c.results}` : c.results}</strong><span>{c.page} {page.toLocaleString(locale)} {c.of} {pageCount.toLocaleString(locale)}</span></div>
      {loading ? <p className={styles.state} role="status">{c.loading}</p> : null}
      {error ? <div className={styles.errorState} role="alert"><p>{c.loadError}</p><button className={styles.secondaryButton} type="button" onClick={() => setRevision((current) => current + 1)}>{c.retry}</button></div> : null}
      {!loading && !error && result?.items.length === 0 ? <div className={styles.emptyState}><p>{c.empty}</p><button className={styles.secondaryButton} type="button" onClick={reset}>{c.reset}</button></div> : null}
      {!loading && !error && result?.items.length ? <div className={styles.list} role="list"><div className={styles.listHead} aria-hidden="true"><span>{c.account}</span><span>{c.contact}</span><span>{c.orders}</span><span>{c.joined}</span><span /></div>{result.items.map((user) => <div role="listitem" key={user.id}><button id={`admin-user-${user.id}`} className={styles.userRow} type="button" onClick={() => { openedUserId.current = user.id; setSelected(user); }} aria-label={`${c.view}: ${user.fullName}`}><span className={styles.rowIdentity}><strong>{user.fullName}</strong><small>{c[user.role as keyof typeof c] ?? user.role}</small></span><span className={styles.rowContact}><span dir="ltr">{user.email}</span><small dir="ltr">{user.phoneNumber ?? "—"}</small></span><span className={styles.rowCount}><span className={styles.mobileLabel}>{c.orders}: </span>{user.orderCount.toLocaleString(locale)}</span><time><span className={styles.mobileLabel}>{c.joined}: </span>{new Date(user.createdAt).toLocaleDateString(locale)}</time><span className={styles.rowArrow} aria-hidden="true">›</span></button></div>)}</div> : null}
      {!loading && !error && result && pageCount > 1 ? <nav className={styles.pagination} aria-label={c.title}><button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>{c.previous}</button><span>{c.page} {page.toLocaleString(locale)} {c.of} {pageCount.toLocaleString(locale)}</span><button type="button" disabled={page >= pageCount} onClick={() => setPage(page + 1)}>{c.next}</button></nav> : null}
    </>}
  </section>;
}
