import type { Metadata, Route } from "next";
import type { PublicExpertSummary } from "@topgsm/shared-types";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { PublicHeader } from "@/components/PublicHeader";
import { getDirection, isLocale } from "@/lib/i18n";
import { dashboardFor, getCurrentUser } from "@/lib/auth/server";
import { SERVER_API_BASE } from "@/lib/api/server";
import { ContactChat } from "./ContactChat";
import { contactCopy, contactEmail, telephoneHref } from "./contact-copy";
import styles from "./ContactPage.module.css";

type Props = { params: Promise<{ locale: string }> };

async function fetchExperts(): Promise<PublicExpertSummary[] | null> {
  try {
    const response = await fetch(`${SERVER_API_BASE}/seller/directory`, {
      cache: "no-store", signal: AbortSignal.timeout(8_000)
    });
    if (!response.ok) return null;
    const data: unknown = await response.json();
    if (!Array.isArray(data) || !data.every((expert): expert is PublicExpertSummary =>
      expert !== null && typeof expert === "object" &&
      typeof expert.id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(expert.id) &&
      typeof expert.name === "string" && expert.name.trim().length > 0 &&
      (expert.specialty === null || typeof expert.specialty === "string") &&
      (expert.profilePicture === null || (
        typeof expert.profilePicture === "object" && typeof expert.profilePicture.id === "string" &&
        typeof expert.profilePicture.url === "string" && typeof expert.profilePicture.width === "number" &&
        typeof expert.profilePicture.height === "number"
      )) &&
      Number.isSafeInteger(expert.activeProductCount) && expert.activeProductCount >= 0
    )) return null;
    return data;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const c = contactCopy[locale];
  return {
    title: c.title, description: c.description,
    alternates: { canonical: `/${locale}/contact-us`, languages: { fa: "/fa/contact-us", en: "/en/contact-us", ar: "/ar/contact-us", "x-default": "/fa/contact-us" } },
    openGraph: { title: `${c.title} | Top GSM`, description: c.description, url: `/${locale}/contact-us`, type: "website" }
  };
}

export default async function ContactPage({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const c = contactCopy[locale];
  const [user, experts] = await Promise.all([getCurrentUser(), fetchExperts()]);
  return <div className={styles.page} dir={getDirection(locale)}>
    <a className="skip-link" href="#contact-main">{c.skip}</a>
    <PublicHeader locale={locale} accountHref={user ? dashboardFor(user, locale) : null} current="contact" />
    <main id="contact-main" className={styles.main}>
      <nav className={styles.breadcrumb} aria-label={c.title}><Link href={`/${locale}` as Route}>{c.home}</Link><span aria-hidden="true">/</span><span aria-current="page">{c.title}</span></nav>
      <section className={styles.hero} aria-labelledby="contact-title">
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>{c.label}</p>
          <h1 id="contact-title">{c.heading}<br /><span>{c.brand}</span></h1>
          <p className={styles.description}>{c.description}</p>
          <div className={styles.actions}><ContactChat label={c.chat} opening={c.opening} unavailable={c.unavailable} /><a className={styles.emailAction} href={`mailto:${contactEmail}`}>{c.emailAction}<span aria-hidden="true">↗</span></a></div>
        </div>
        <aside className={styles.guide} aria-labelledby="guide-title">
          <h2 id="guide-title">{c.guide}</h2>
          <ol>{c.steps.map(([title, body], index) => <li key={title}><span className={styles.step} aria-hidden="true">{new Intl.NumberFormat(locale).format(index + 1).padStart(locale === "en" ? 2 : 1, "0")}</span><div><h3>{title}</h3><p>{body}</p></div></li>)}</ol>
        </aside>
      </section>
      <section className={styles.team} aria-labelledby="team-title">
        <div className={styles.sectionHeading}><h2 id="team-title">{c.team}</h2><p>{c.teamBody}</p></div>
        {experts?.length ? <ul className={styles.experts}>{experts.map((expert) => {
          return <li key={expert.id} className={styles.expert}>
            <div className={styles.expertIdentity}>
              <div className={styles.avatar} aria-hidden="true">{expert.profilePicture ? <Image src={expert.profilePicture.url} alt="" width={42} height={42} /> : expert.name.trim().split(/\s+/).slice(0, 2).map((part) => part.charAt(0)).join(" ")}</div>
              <div><h3>{expert.name}</h3><p>{expert.specialty || c.expertFallback}</p></div>
            </div>
            <Link className={styles.profileLink} href={`/${locale}/experts/${expert.id}` as Route} aria-label={`${c.viewProfile}: ${expert.name}`}>{c.viewProfile}<span aria-hidden="true">↗</span></Link>
          </li>;
        })}</ul> : <p className={styles.directoryState}>{experts === null ? c.expertsUnavailable : c.emptyExperts}</p>}
      </section>
      <section className={styles.contacts} aria-labelledby="details-title">
        <div><h2 id="details-title">{c.contacts}</h2><p>{c.contactsBody}</p></div>
        <dl className={styles.details}>
          <div><dt>{c.landline}</dt><dd><a href={telephoneHref("05132728049")}><bdi>051 3272 8049</bdi></a><a href={telephoneHref("07737253719")}><bdi>077 3725 3719</bdi></a></dd></div>
          <div><dt>{c.mobile}</dt><dd><a href={telephoneHref("09925739301")}><bdi>0992 573 9301</bdi></a></dd></div>
          <div><dt>{c.email}</dt><dd><a href={`mailto:${contactEmail}`}><bdi>{contactEmail}</bdi></a></dd></div>
          <div className={styles.address}><dt>{c.addressLabel}</dt><dd><address>{c.address}</address><span className={styles.postcode}>{c.postcode}: <bdi>7539135738</bdi></span></dd></div>
        </dl>
      </section>
      <blockquote className={styles.quote}><p lang="ar" dir="rtl">{c.quote}</p>{c.quoteMeaning && <p>{c.quoteMeaning}</p>}</blockquote>
    </main>
    <footer className={styles.footer}><Link href={`/${locale}` as Route} className={styles.wordmark} translate="no">topgsm<span>.</span></Link><nav aria-label={c.title}><Link href={`/${locale}/products` as Route}>{c.shop}</Link><Link href={`/${locale}/blog` as Route}>{c.journal}</Link></nav><span dir="ltr">© {new Date().getFullYear()} Top GSM</span></footer>
  </div>;
}
