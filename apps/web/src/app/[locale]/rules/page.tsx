import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDirection, isLocale } from "@/lib/i18n";
import styles from "./RulesPage.module.css";

const copy = {
  fa: { title: "قوانین تاپ جی اس ام", pending: "متن قوانین تاپ جی اس ام در حال آماده‌سازی است و به‌زودی در این صفحه منتشر می‌شود.", back: "بازگشت به ورود و ثبت نام", home: "صفحه اصلی" },
  en: { title: "Top GSM rules", pending: "The Top GSM rules are being prepared and will be published on this page soon.", back: "Back to sign in or register", home: "Home" },
  ar: { title: "قواعد Top GSM", pending: "يجري إعداد قواعد Top GSM، وستُنشر في هذه الصفحة قريباً.", back: "العودة إلى تسجيل الدخول أو إنشاء حساب", home: "الرئيسية" }
} as const;

type RulesPageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: RulesPageProps): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return { title: copy[locale].title, robots: { index: false, follow: false } };
}

export default async function RulesPage({ params }: RulesPageProps) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const c = copy[locale];
  return <main className={styles.page} dir={getDirection(locale)}>
    <section className={styles.panel} aria-labelledby="rules-title">
      <h1 id="rules-title">{c.title}</h1>
      <p>{c.pending}</p>
      <nav className={styles.actions} aria-label={c.title}>
        <Link className={styles.primary} href={`/${locale}/login` as Route}>{c.back}</Link>
        <Link href={`/${locale}` as Route}>{c.home}</Link>
      </nav>
    </section>
  </main>;
}
