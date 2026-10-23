import type { Metadata, Route } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { PublicExpertSummary } from "@topgsm/shared-types";
import { DesignIcon } from "@/components/DesignIcon";
import { PublicFooter } from "@/components/PublicFooter";
import { SellerAvatar } from "@/components/seller/SellerAvatar";
import { SERVER_API_BASE } from "@/lib/api/server";
import { getDirection, isLocale, type Locale } from "@/lib/i18n";
import { SITE_URL } from "@/lib/seo";
import { managedSeoMetadata } from "@/lib/seo-settings-server";
import { ExpertStartChat } from "./ExpertStartChat";
import { remoteCopy } from "./remote-copy";
import styles from "./RemotePage.module.css";

type Props = { params: Promise<{ locale: string }> };

async function fetchExperts(): Promise<PublicExpertSummary[] | null> {
  try {
    const response = await fetch(`${SERVER_API_BASE}/seller/directory`, {
      cache: "no-store",
      signal: AbortSignal.timeout(8_000)
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
      Number.isSafeInteger(expert.activeProductCount) && expert.activeProductCount >= 0 &&
      typeof expert.chatAvailable === "boolean"
    )) return null;
    return data;
  } catch {
    return null;
  }
}

function serviceJsonLd(locale: Locale, title: string, description: string) {
  const path = `${SITE_URL}/${locale}/remote`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: remoteCopy[locale].home, item: `${SITE_URL}/${locale}` },
          { "@type": "ListItem", position: 2, name: title, item: path }
        ]
      },
      {
        "@type": "Service",
        name: title,
        description,
        provider: { "@type": "Organization", name: "Top GSM", url: `${SITE_URL}/${locale}` },
        areaServed: "IR",
        serviceType: "Remote mobile phone repair",
        url: path
      }
    ]
  };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const c = remoteCopy[locale];
  return managedSeoMetadata(locale, `/${locale}/remote`, {
    title: c.title,
    description: c.description,
    alternates: {
      canonical: `/${locale}/remote`,
      languages: { fa: "/fa/remote", en: "/en/remote", ar: "/ar/remote", "x-default": "/fa/remote" }
    },
    openGraph: { title: `${c.title} | Top GSM`, description: c.description, url: `/${locale}/remote`, type: "website" }
  });
}

export default async function RemotePage({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const c = remoteCopy[locale];
  const experts = await fetchExperts();

  return (
    <div className={styles.page} dir={getDirection(locale)} data-remote-page>
      <a className="skip-link" href="#remote-main">{c.skip}</a>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceJsonLd(locale, c.title, c.description)) }} />
      <main id="remote-main" className={styles.main}>
        <nav className={styles.breadcrumb} aria-label={c.title}>
          <Link href={`/${locale}` as Route}>{c.home}</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{c.title}</span>
        </nav>

        <section className={styles.hero} aria-labelledby="remote-title">
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>{c.label}</p>
            <h1 id="remote-title">{c.heading} <span>{c.accent}</span></h1>
            <p className={styles.description}>{c.description}</p>
            <div className={styles.actions}>
              <a className={styles.primary} href="#remote-experts">{c.primaryCta}</a>
              <Link className={styles.secondary} href={`/${locale}/products?type=service` as Route}>{c.secondaryCta}</Link>
            </div>
          </div>
          <div className={styles.photo}>
            <Image src="/images/home/offers/remote-software-setup.webp" alt={c.photoAlt} fill priority sizes="(max-width: 900px) 100vw, 42vw" />
          </div>
        </section>

        <section className={styles.benefits} aria-labelledby="remote-benefits-title">
          <h2 id="remote-benefits-title">{c.benefitsTitle}</h2>
          <ul className={styles.benefitGrid}>
            {c.benefits.map((benefit) => (
              <li key={benefit.title}>
                <span className={styles.benefitIcon} aria-hidden="true"><DesignIcon name={benefit.icon} /></span>
                <div>
                  <h3>{benefit.title}</h3>
                  <p>{benefit.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className={styles.process} aria-labelledby="remote-process-title">
          <div className={styles.sectionHeading}>
            <h2 id="remote-process-title">{c.processTitle}</h2>
            <p>{c.processBody}</p>
          </div>
          <ol className={styles.steps}>
            {c.steps.map((step, index) => (
              <li key={step.title}>
                <span className={styles.stepIndex} aria-hidden="true">
                  {new Intl.NumberFormat(locale).format(index + 1).padStart(locale === "en" ? 2 : 1, "0")}
                </span>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className={styles.experts} id="remote-experts" aria-labelledby="remote-experts-title">
          <div className={styles.sectionHeading}>
            <h2 id="remote-experts-title">{c.expertsTitle}</h2>
            <p>{c.expertsBody}</p>
          </div>
          {experts?.length ? (
            <ul className={styles.expertGrid}>
              {experts.map((expert) => (
                <li key={expert.id} className={styles.expert}>
                  <div className={styles.expertIdentity}>
                    <SellerAvatar className={styles.avatar} name={expert.name} picture={expert.profilePicture} locale={locale} size={44} />
                    <div>
                      <h3>{expert.name}</h3>
                      <p>{expert.specialty || c.expertFallback}</p>
                    </div>
                  </div>
                  <ExpertStartChat
                    sellerId={expert.id}
                    sellerName={expert.name}
                    available={expert.chatAvailable}
                    locale={locale}
                    c={{
                      startChat: c.startChat,
                      openingChat: c.openingChat,
                      chatUnavailable: c.chatUnavailable,
                      chatError: c.chatError
                    }}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.state}>{experts === null ? c.expertsUnavailable : c.emptyExperts}</p>
          )}
        </section>

        <section className={styles.rates} aria-labelledby="remote-rates-title">
          <div className={styles.sectionHeading}>
            <h2 id="remote-rates-title">{c.ratesTitle}</h2>
            <p>{c.ratesBody}</p>
          </div>
          <ul className={styles.rateGrid}>
            {c.rates.map((rate, index) => (
              <li key={rate.level} className={styles.rate} data-tier={index + 1}>
                <header>
                  <h3>{rate.level}</h3>
                  <p className={styles.price}>{rate.price}</p>
                </header>
                <div className={styles.rateBody}>
                  <p><strong>{c.softwareLabel}</strong> {rate.software}</p>
                  <p><strong>{c.hardwareLabel}</strong> {rate.hardware}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className={styles.setup} aria-labelledby="remote-setup-title">
          <div>
            <h2 id="remote-setup-title">{c.setupTitle}</h2>
            <p>{c.setupBody}</p>
          </div>
          <div className={styles.setupActions}>
            <a className={styles.primary} href={c.anydeskUrl} target="_blank" rel="noopener noreferrer">{c.setupDownload}</a>
            <Link className={styles.secondary} href={`/${locale}/contact-us` as Route}>{c.setupContact}</Link>
          </div>
        </section>
      </main>
      <PublicFooter locale={locale} />
    </div>
  );
}
