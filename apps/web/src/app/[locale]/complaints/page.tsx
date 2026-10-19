import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicFooter } from "@/components/PublicFooter";
import { managedSeoMetadata } from "@/lib/seo-settings-server";
import { getDirection, isLocale } from "@/lib/i18n";
import { SERVER_API_BASE } from "@/lib/api/server";
import { complaintsCopy, complaintsTelephoneHref, complaintsTelegramHref } from "./complaints-copy";
import styles from "./ComplaintsPage.module.css";

type Props = { params: Promise<{ locale: string }> };
type ComplaintsSettings = { phoneNumber: string; telegramId: string };

async function fetchComplaints(): Promise<ComplaintsSettings | null> {
  try {
    const response = await fetch(`${SERVER_API_BASE}/complaints`, {
      cache: "no-store",
      signal: AbortSignal.timeout(8_000)
    });
    if (!response.ok) return null;
    const data: unknown = await response.json();
    if (
      data === null ||
      typeof data !== "object" ||
      typeof (data as ComplaintsSettings).phoneNumber !== "string" ||
      typeof (data as ComplaintsSettings).telegramId !== "string"
    ) return null;
    return { phoneNumber: (data as ComplaintsSettings).phoneNumber, telegramId: (data as ComplaintsSettings).telegramId };
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const c = complaintsCopy[locale];
  return managedSeoMetadata(locale, `/${locale}/complaints`, {
    title: c.title,
    description: c.description,
    alternates: {
      canonical: `/${locale}/complaints`,
      languages: { fa: "/fa/complaints", en: "/en/complaints", ar: "/ar/complaints", "x-default": "/fa/complaints" }
    },
    openGraph: { title: `${c.title} | Top GSM`, description: c.description, url: `/${locale}/complaints`, type: "website" }
  });
}

export default async function ComplaintsPage({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const c = complaintsCopy[locale];
  const settings = await fetchComplaints();
  const phone = settings?.phoneNumber.trim() ?? "";
  const telegram = settings?.telegramId.trim() ?? "";
  const hasContacts = Boolean(phone || telegram);

  return (
    <div className={styles.page} dir={getDirection(locale)}>
      <a className="skip-link" href="#complaints-main">{c.skip}</a>
      <main id="complaints-main" className={styles.main}>
        <nav className={styles.breadcrumb} aria-label={c.title}>
          <Link href={`/${locale}` as Route}>{c.home}</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{c.title}</span>
        </nav>
        <section className={styles.hero} aria-labelledby="complaints-title">
          <p className={styles.eyebrow}>{c.label}</p>
          <h1 id="complaints-title">{c.heading} <span>{c.brand}</span></h1>
          <p className={styles.description}>{c.description}</p>
        </section>
        {settings === null ? (
          <p className={styles.error} role="alert">
            {c.unavailable}{" "}
            <Link href={`/${locale}/contact-us` as Route}>{c.contactUs}</Link>
          </p>
        ) : hasContacts ? (
          <section className={styles.contacts} aria-labelledby="complaints-contacts-title">
            <h2 id="complaints-contacts-title">{c.contacts}</h2>
            <p>{c.contactsBody}</p>
            <dl className={styles.details}>
              {phone ? (
                <div className={styles.card}>
                  <dt>{c.phone}</dt>
                  <dd>
                    <span className={styles.value} dir="ltr"><bdi>{phone}</bdi></span>
                    <a className={styles.action} href={complaintsTelephoneHref(phone)}>{c.call}</a>
                  </dd>
                </div>
              ) : null}
              {telegram ? (
                <div className={styles.card}>
                  <dt>{c.telegram}</dt>
                  <dd>
                    <span className={styles.value} dir="ltr"><bdi>@{telegram}</bdi></span>
                    <a className={styles.action} href={complaintsTelegramHref(telegram)} target="_blank" rel="noopener noreferrer">{c.openTelegram}</a>
                  </dd>
                </div>
              ) : null}
            </dl>
          </section>
        ) : (
          <p className={styles.empty}>
            {c.empty}{" "}
            <Link href={`/${locale}/contact-us` as Route}>{c.contactUs}</Link>
          </p>
        )}
      </main>
      <PublicFooter locale={locale} />
    </div>
  );
}
