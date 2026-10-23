import type { Metadata, Route } from "next";
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
import { expertsCopy } from "./experts-copy";
import styles from "./ExpertsPage.module.css";

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

function directoryJsonLd(locale: Locale, title: string, description: string, experts: PublicExpertSummary[]) {
  const path = `${SITE_URL}/${locale}/experts`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: expertsCopy[locale].home, item: `${SITE_URL}/${locale}` },
          { "@type": "ListItem", position: 2, name: title, item: path }
        ]
      },
      {
        "@type": "CollectionPage",
        name: title,
        description,
        url: path,
        isPartOf: { "@type": "WebSite", name: "Top GSM", url: `${SITE_URL}/${locale}` },
        ...(experts.length ? {
          mainEntity: {
            "@type": "ItemList",
            numberOfItems: experts.length,
            itemListElement: experts.map((expert, index) => ({
              "@type": "ListItem",
              position: index + 1,
              name: expert.name,
              url: `${SITE_URL}/${locale}/experts/${expert.id}`
            }))
          }
        } : {})
      }
    ]
  };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const c = expertsCopy[locale];
  return managedSeoMetadata(locale, `/${locale}/experts`, {
    title: c.title,
    description: c.description,
    alternates: {
      canonical: `/${locale}/experts`,
      languages: { fa: "/fa/experts", en: "/en/experts", ar: "/ar/experts", "x-default": "/fa/experts" }
    },
    openGraph: { title: `${c.title} | Top GSM`, description: c.description, url: `/${locale}/experts`, type: "website" }
  });
}

export default async function ExpertsPage({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const c = expertsCopy[locale];
  const experts = await fetchExperts();
  const list = experts ?? [];
  const countLabel = c.count(new Intl.NumberFormat(locale).format(list.length));

  return (
    <div className={styles.page} dir={getDirection(locale)} data-experts-page>
      <a className="skip-link" href="#experts-main">{c.skip}</a>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(directoryJsonLd(locale, c.title, c.description, list)) }}
      />
      <main id="experts-main" className={styles.main}>
        <nav className={styles.breadcrumb} aria-label={c.title}>
          <Link href={`/${locale}` as Route}>{c.home}</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{c.title}</span>
        </nav>

        <section className={styles.hero} aria-labelledby="experts-title">
          <p className={styles.eyebrow}>{c.label}</p>
          <h1 id="experts-title">{c.heading} <span>{c.accent}</span></h1>
          <p className={styles.description}>{c.description}</p>
          <div className={styles.actions}>
            <a className={styles.primary} href="#experts-directory">{c.directoryTitle}</a>
            <Link className={styles.secondary} href={`/${locale}/contact-us` as Route}>{c.contact}</Link>
            <Link className={styles.secondary} href={`/${locale}/remote` as Route}>{c.remote}</Link>
          </div>
        </section>

        <section className={styles.directory} id="experts-directory" aria-labelledby="experts-directory-title">
          <div className={styles.sectionHeading}>
            <h2 id="experts-directory-title">{c.directoryTitle}</h2>
            <p>{c.directoryBody}</p>
          </div>
          {list.length ? (
            <>
              <div className={styles.toolbar}>
                <p>{countLabel}</p>
                <Link href={`/${locale}/products` as Route}>{c.shop}</Link>
              </div>
              <ul className={styles.expertGrid}>
                {list.map((expert) => (
                  <li key={expert.id} className={styles.expert}>
                    <div className={styles.expertIdentity}>
                      <SellerAvatar className={styles.avatar} name={expert.name} picture={expert.profilePicture} locale={locale} size={44} />
                      <div>
                        <h3>{expert.name}</h3>
                        <p>{expert.specialty || c.expertFallback}</p>
                        <p className={styles.meta}>
                          <strong>{new Intl.NumberFormat(locale).format(expert.activeProductCount)}</strong>
                          {" "}
                          {c.products}
                        </p>
                      </div>
                    </div>
                    <Link
                      className={styles.profileLink}
                      href={`/${locale}/experts/${expert.id}` as Route}
                      aria-label={`${c.viewProfile}: ${expert.name}`}
                    >
                      {c.viewProfile}
                      <DesignIcon name="arrow" />
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className={styles.state}>{experts === null ? c.expertsUnavailable : c.emptyExperts}</p>
          )}
        </section>
      </main>
      <PublicFooter locale={locale} />
    </div>
  );
}
