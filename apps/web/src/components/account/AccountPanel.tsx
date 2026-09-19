"use client";

import Link from "next/link";
import type { Route } from "next";
import { useCallback, useEffect, useState } from "react";
import type { AppUser } from "@topgsm/shared-types";
import { api } from "@/lib/api/client";
import { currencyLabel, formatCurrencyAmount } from "@/lib/currency";
import type { Locale } from "@/lib/i18n";
import { LogoutButton } from "@/components/auth/LogoutButton";
import styles from "./AccountPanel.module.css";

type OrderSummary = {
  id: string;
  status: string;
  currency: string;
  totalAmount: string;
  createdAt: string;
  seller: { shopName: string };
  items: Array<{ id: string; productTitle: string; productType: string; quantity: number }>;
};
type OrderPage = { items: OrderSummary[]; nextCursor: string | null };

const COPY = {
  en: { account: "My account", greeting: "Welcome back", overview: "Overview", orders: "Orders", shop: "Shop", cart: "Cart", accountDetails: "Account details", name: "Name", email: "Email", recent: "Recent orders", allOrders: "View all orders", history: "Order history", historyIntro: "Follow purchases, delivery, and downloads in one place.", empty: "No orders yet", emptyHint: "Your purchases will appear here after checkout.", browse: "Browse products", loading: "Loading orders…", error: "Orders could not be loaded.", retry: "Try again", more: "Load more", details: "View order", items: "items", status: { pending: "Payment pending", paid: "Paid", processing: "Processing", awaiting_confirmation: "Awaiting confirmation", shipped: "Shipped", delivered: "Delivered", cancelled: "Cancelled", refunded: "Refunded" } },
  fa: { account: "حساب من", greeting: "خوش آمدید", overview: "نمای کلی", orders: "سفارش‌ها", shop: "فروشگاه", cart: "سبد خرید", accountDetails: "مشخصات حساب", name: "نام", email: "ایمیل", recent: "سفارش‌های اخیر", allOrders: "دیدن همه سفارش‌ها", history: "تاریخچه سفارش‌ها", historyIntro: "خریدها، تحویل و فایل‌های خود را یک‌جا پیگیری کنید.", empty: "هنوز سفارشی ندارید", emptyHint: "پس از خرید، سفارش‌های شما اینجا نمایش داده می‌شوند.", browse: "دیدن محصولات", loading: "در حال دریافت سفارش‌ها…", error: "دریافت سفارش‌ها ممکن نبود.", retry: "تلاش دوباره", more: "نمایش بیشتر", details: "مشاهده سفارش", items: "قلم", status: { pending: "در انتظار پرداخت", paid: "پرداخت‌شده", processing: "در حال پردازش", awaiting_confirmation: "در انتظار تأیید", shipped: "ارسال‌شده", delivered: "تحویل‌شده", cancelled: "لغوشده", refunded: "بازپرداخت‌شده" } },
  ar: { account: "حسابي", greeting: "مرحبًا بعودتك", overview: "نظرة عامة", orders: "الطلبات", shop: "المتجر", cart: "السلة", accountDetails: "تفاصيل الحساب", name: "الاسم", email: "البريد الإلكتروني", recent: "الطلبات الأخيرة", allOrders: "عرض جميع الطلبات", history: "سجل الطلبات", historyIntro: "تابع مشترياتك وتسليماتك وملفاتك في مكان واحد.", empty: "لا توجد طلبات بعد", emptyHint: "ستظهر مشترياتك هنا بعد إتمام الدفع.", browse: "تصفح المنتجات", loading: "جارٍ تحميل الطلبات…", error: "تعذر تحميل الطلبات.", retry: "حاول مجددًا", more: "تحميل المزيد", details: "عرض الطلب", items: "عناصر", status: { pending: "بانتظار الدفع", paid: "مدفوع", processing: "قيد المعالجة", awaiting_confirmation: "بانتظار التأكيد", shipped: "تم الشحن", delivered: "تم التسليم", cancelled: "ملغى", refunded: "مسترد" } }
} as const;

export function AccountPanel({ locale, user, view }: { locale: Locale; user: AppUser; view: "overview" | "orders" }) {
  const c = COPY[locale];
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (next?: string) => {
    if (next) setLoadingMore(true); else setLoading(true);
    setError("");
    try {
      const response = await api.get<OrderPage>("/orders", { params: { limit: view === "overview" ? 5 : 20, ...(next ? { cursor: next } : {}) } });
      setOrders((current) => next ? [...current, ...response.data.items] : response.data.items);
      setCursor(response.data.nextCursor);
    } catch {
      setError(c.error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [c.error, view]);

  useEffect(() => { const frame = requestAnimationFrame(() => void load()); return () => cancelAnimationFrame(frame); }, [load]);

  return <div className={styles.shell}>
    <a className="skip-link" href="#account-content">{view === "orders" ? c.history : c.overview}</a>
    <header className={styles.topbar}><Link className={styles.brand} href={`/${locale}` as Route}>topgsm.</Link><div className={styles.toplinks}><Link href={`/${locale}/products` as Route}>{c.shop}</Link><Link href={`/${locale}/cart` as Route}>{c.cart}</Link><LogoutButton locale={locale} /></div></header>
    <div className={styles.layout}>
      <aside className={styles.sidebar}><span className={styles.eyebrow}>{c.account}</span><strong className={styles.identity}>{user.fullName}</strong><nav aria-label={c.account}><Link href={`/${locale}/account` as Route} aria-current={view === "overview" ? "page" : undefined}>{c.overview}</Link><Link href={`/${locale}/account/orders` as Route} aria-current={view === "orders" ? "page" : undefined}>{c.orders}</Link></nav></aside>
      <main id="account-content" className={styles.main}>
        <div className={styles.heading}><span className={styles.eyebrow}>{c.account}</span><h1>{view === "orders" ? c.history : `${c.greeting}, ${user.fullName}`}</h1><p>{c.historyIntro}</p></div>
        {view === "overview" ? <section className={styles.details} aria-labelledby="account-details"><h2 id="account-details">{c.accountDetails}</h2><dl><div><dt>{c.name}</dt><dd>{user.fullName}</dd></div><div><dt>{c.email}</dt><dd dir="ltr">{user.email}</dd></div></dl></section> : null}
        <section className={styles.orders} aria-labelledby="account-orders"><div className={styles.sectionHeading}><h2 id="account-orders">{view === "overview" ? c.recent : c.history}</h2>{view === "overview" ? <Link href={`/${locale}/account/orders` as Route}>{c.allOrders}</Link> : null}</div>
          {loading && !orders.length ? <p className={styles.notice} role="status">{c.loading}</p> : null}
          {error ? <div className={styles.notice} role="alert"><p>{error}</p><button type="button" onClick={() => void load(cursor && orders.length ? cursor : undefined)}>{c.retry}</button></div> : null}
          {!loading && !error && !orders.length ? <div className={styles.empty}><h3>{c.empty}</h3><p>{c.emptyHint}</p><Link href={`/${locale}/products` as Route}>{c.browse}</Link></div> : null}
          {orders.length ? <div className={styles.list}>{orders.map((order) => <article className={styles.order} key={order.id}><div className={styles.orderTop}><span className={styles.date}>{new Date(order.createdAt).toLocaleDateString(locale, { year: "numeric", month: "long", day: "numeric" })}</span><span className={styles.status} data-status={order.status}>{c.status[order.status as keyof typeof c.status] ?? order.status}</span></div><h3>{order.items.map((item) => item.productTitle).join(" · ")}</h3><p>{order.seller.shopName} · {order.items.reduce((total, item) => total + item.quantity, 0)} {c.items}</p><div className={styles.orderBottom}><strong>{formatCurrencyAmount(order.totalAmount, order.currency, locale)} {currencyLabel(order.currency)}</strong><Link href={`/${locale}/orders/${order.id}` as Route}>{c.details}</Link></div></article>)}</div> : null}
          {view === "orders" && cursor && !loading ? <button className={styles.more} type="button" disabled={loadingMore} onClick={() => void load(cursor)}>{loadingMore ? c.loading : c.more}</button> : null}
        </section>
      </main>
    </div>
  </div>;
}
