import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicFooter } from "@/components/PublicFooter";
import { managedSeoMetadata } from "@/lib/seo-settings-server";
import { getDirection, isLocale } from "@/lib/i18n";
import { aboutCopy } from "./about-copy";
import styles from "./AboutPage.module.css";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const c = aboutCopy[locale];
  return managedSeoMetadata(locale, `/${locale}/about-us`, {
    title: c.title,
    description: c.description,
    alternates: {
      canonical: `/${locale}/about-us`,
      languages: { fa: "/fa/about-us", en: "/en/about-us", ar: "/ar/about-us", "x-default": "/fa/about-us" }
    },
    openGraph: { title: `${c.title} | Top GSM`, description: c.description, url: `/${locale}/about-us`, type: "website" }
  });
}

export default async function AboutPage({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const c = aboutCopy[locale];

  return (
    <div className={styles.page} dir={getDirection(locale)}>
      <a className="skip-link" href="#about-main">{c.skip}</a>
      <main id="about-main" className={styles.main}>
        <nav className={styles.breadcrumb} aria-label={c.title}>
          <Link href={`/${locale}` as Route}>{c.home}</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{c.title}</span>
        </nav>
        <section className={styles.hero} aria-labelledby="about-title">
          <p className={styles.eyebrow}>{c.label}</p>
          <h1 id="about-title">{c.heading} <span>{c.brand}</span></h1>
          <p className={styles.description}>{c.description}</p>
        </section>
        <section className={styles.mission} aria-labelledby="about-mission-title">
          <h2 id="about-mission-title">{c.mission}</h2>
          <p>{c.missionBody}</p>
        </section>
        <section className={styles.offer} aria-labelledby="about-offer-title">
          <h2 id="about-offer-title">{c.offer}</h2>
          <ul className={styles.offerList}>
            {c.offerItems.map(([title, body]) => (
              <li key={title}>
                <h3>{title}</h3>
                <p>{body}</p>
              </li>
            ))}
          </ul>
        </section>
        <section className={styles.contact} aria-labelledby="about-contact-title">
          <h2 id="about-contact-title">{c.contact}</h2>
          <p>{c.contactHint}</p>
          <Link className={styles.contactLink} href={`/${locale}/contact-us` as Route}>
            {c.contact}
            <span aria-hidden="true"> ↗</span>
          </Link>
        </section>
      </main>
      <PublicFooter locale={locale} />
    </div>
  );
}
