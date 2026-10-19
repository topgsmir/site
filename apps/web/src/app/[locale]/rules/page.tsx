import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicFooter } from "@/components/PublicFooter";
import { getDirection, isLocale } from "@/lib/i18n";
import { managedSeoMetadata } from "@/lib/seo-settings-server";
import { rulesBody, rulesCopy } from "./rules-copy";
import styles from "./RulesPage.module.css";

type RulesPageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: RulesPageProps): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const c = rulesCopy[locale];
  return managedSeoMetadata(locale, `/${locale}/rules`, {
    title: c.title,
    description: c.description,
    alternates: {
      canonical: `/${locale}/rules`,
      languages: { fa: "/fa/rules", en: "/en/rules", ar: "/ar/rules", "x-default": "/fa/rules" }
    },
    openGraph: { title: `${c.title} | Top GSM`, description: c.description, url: `/${locale}/rules`, type: "website" }
  });
}

export default async function RulesPage({ params }: RulesPageProps) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const c = rulesCopy[locale];
  return (
    <div className={styles.page} dir={getDirection(locale)}>
      <a className="skip-link" href="#rules-main">{c.skip}</a>
      <main id="rules-main" className={styles.main}>
        <header className={styles.header}>
          <h1 id="rules-title">{c.title}</h1>
          {c.officialNote ? <p className={styles.note}>{c.officialNote}</p> : null}
        </header>
        <article className={styles.document} aria-labelledby="rules-title" lang="fa" dir="rtl">
          {rulesBody.intro.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          {rulesBody.sections.map((section, index) => {
            const headingId = `rules-section-${index + 1}`;
            return (
              <section key={section.title} className={styles.section} aria-labelledby={headingId}>
                <h2 id={headingId}>{section.title}</h2>
                <ul>
                  {section.items.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </section>
            );
          })}
          <p className={styles.closing}>{rulesBody.closing}</p>
        </article>
        <nav className={styles.actions} aria-label={c.title}>
          <Link className={styles.primary} href={`/${locale}/login` as Route}>{c.back}</Link>
          <Link href={`/${locale}` as Route}>{c.home}</Link>
        </nav>
      </main>
      <PublicFooter locale={locale} />
    </div>
  );
}
