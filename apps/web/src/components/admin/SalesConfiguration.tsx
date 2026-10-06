import type { Route } from "next";
import Link from "next/link";
import type { Locale } from "@/lib/i18n";
import styles from "./SalesConfiguration.module.css";

const copy = {
  fa: {
    title: "پیکربندی فروش",
    intro: "تنظیمات و ابزارهای مرتبط با فروش را از اینجا مدیریت کنید.",
    club: "باشگاه مشتریان",
    clubHint: "امتیازها، سطح‌ها، پاداش‌ها و کمپین‌ها",
    shipping: "تنظیمات ارسال",
    shippingHint: "روش‌های ارسال سفارش‌های فیزیکی",
    vendors: "شرایط فروشنده‌ها",
    vendorsHint: "دسترسی فروش و نرخ کمیسیون هر فروشنده",
  },
  en: {
    title: "Sales configuration",
    intro: "Manage settings and tools related to sales.",
    club: "Customer club",
    clubHint: "Points, tiers, rewards, and campaigns",
    shipping: "Shipping settings",
    shippingHint: "Delivery methods for physical orders",
    vendors: "Seller terms",
    vendorsHint: "Sales access and commission rates for each seller",
  },
  ar: {
    title: "إعدادات المبيعات",
    intro: "إدارة الإعدادات والأدوات المتعلقة بالمبيعات.",
    club: "نادي العملاء",
    clubHint: "النقاط والمستويات والمكافآت والحملات",
    shipping: "إعدادات الشحن",
    shippingHint: "طرق شحن الطلبات المادية",
    vendors: "شروط البائعين",
    vendorsHint: "صلاحيات البيع ونسب العمولة لكل بائع",
  },
} as const;

export function SalesConfiguration({ locale }: { locale: Locale }) {
  const c = copy[locale];
  const destinations = [
    { href: `/${locale}/admin/club` as Route, title: c.club, hint: c.clubHint },
    { href: `/${locale}/admin/settings/shipping` as Route, title: c.shipping, hint: c.shippingHint },
    { href: `/${locale}/admin/vendors` as Route, title: c.vendors, hint: c.vendorsHint },
  ];

  return (
    <section className={styles.configuration} aria-labelledby="sales-configuration-title">
      <header>
        <h1 id="sales-configuration-title">{c.title}</h1>
        <p>{c.intro}</p>
      </header>
      <div className={styles.links}>
        {destinations.map((item) => (
          <Link key={item.href} href={item.href} className={styles.link}>
            <strong>{item.title}</strong>
            <span>{item.hint}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
