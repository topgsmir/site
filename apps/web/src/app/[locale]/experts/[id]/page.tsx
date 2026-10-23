import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { cache } from "react";
import { SellerAvatar } from "@/components/seller/SellerAvatar";
import { notFound } from "next/navigation";
import type { PublicExpertPageBlock, PublicExpertProfile, PublicProductSummary } from "@topgsm/shared-types";
import { DesignIcon } from "@/components/DesignIcon";
import { PublicFooter } from "@/components/PublicFooter";
import { ExpertStartChat } from "../../remote/ExpertStartChat";
import { SERVER_API_BASE } from "@/lib/api/server";
import { getDirection, isLocale, type Locale } from "@/lib/i18n";
import { ExpertProductSlider } from "./ExpertProductSlider";
import { SITE_URL } from "@/lib/seo";
import { managedSeoMetadata } from "@/lib/seo-settings-server";
import styles from "./ExpertProfile.module.css";

type ExpertProfilePageProps = {
  params: Promise<{ locale: string; id: string }>;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const copy = {
  fa: {
    label: "کارشناس تأییدشده",
    about: "درباره کارشناس",
    skip: "رفتن به پروفایل کارشناس",
    fallback: "این کارشناس هنوز معرفی یا محصولی در صفحه خود نگذاشته است.",
    back: "کارشناسان",
    home: "خانه",
    from: "از",
    details: "مشاهده",
    section: "محصولات",
    listed: "محصول",
    products: "محصول فعال",
    digital: "فایل و آموزش",
    physical: "محصول فیزیکی",
    service: "خدمات",
    bridge: "خرید واسطه‌ای",
    startChat: "شروع گفتگو",
    openingChat: "در حال اتصال…",
    chatUnavailable: "گفت‌وگوی مستقیم فعال نیست.",
    chatError: "گفت‌وگو باز نشد. دوباره تلاش کنید."
  },
  en: {
    label: "Verified expert",
    about: "About the expert",
    skip: "Skip to expert profile",
    fallback: "This expert has not published an introduction or products on this page yet.",
    back: "Experts",
    home: "Home",
    from: "From",
    details: "View",
    section: "Products",
    listed: "products",
    products: "active products",
    digital: "Files and training",
    physical: "Physical product",
    service: "Service",
    bridge: "Assisted purchase",
    startChat: "Start chat",
    openingChat: "Connecting…",
    chatUnavailable: "Direct chat is not available.",
    chatError: "Could not open chat. Try again."
  },
  ar: {
    label: "خبير معتمد",
    about: "عن الخبير",
    skip: "انتقل إلى ملف الخبير",
    fallback: "لم ينشر هذا الخبير نبذة أو منتجات في هذه الصفحة بعد.",
    back: "الخبراء",
    home: "الرئيسية",
    from: "من",
    details: "عرض",
    section: "المنتجات",
    listed: "منتج",
    products: "منتج نشط",
    digital: "ملفات وتدريب",
    physical: "منتج فعلي",
    service: "خدمة",
    bridge: "شراء بالوساطة",
    startChat: "بدء المحادثة",
    openingChat: "جارٍ الاتصال…",
    chatUnavailable: "المحادثة المباشرة غير متاحة.",
    chatError: "تعذر فتح المحادثة. حاول مجددًا."
  }
} as const;

function readProduct(value: unknown): PublicProductSummary | null {
  if (!value || typeof value !== "object") return null;
  const product = value as PublicProductSummary;
  if (typeof product.id !== "string" || !UUID_PATTERN.test(product.id)) return null;
  if (typeof product.title !== "string" || product.title.trim().length < 1 || product.title.length > 200) return null;
  if (typeof product.slug !== "string" || product.slug.length < 1 || product.slug.length > 200 || /[\s?#/\\]/.test(product.slug)) return null;
  if (product.type !== "digital" && product.type !== "physical" && product.type !== "service" && product.type !== "bridge") return null;
  const startingPrices = Array.isArray(product.startingPrices)
    ? product.startingPrices.filter((price) => price && typeof price.price === "string" && /^[0-9]+(?:\.[0-9]+)?$/.test(price.price) && typeof price.currency === "string")
    : [];
  const variant = product.image?.variants?.find((item) => item?.name === "thumb" && item.url.startsWith("/media/") && Number.isFinite(item.width) && Number.isFinite(item.height))
    ?? product.image?.variants?.find((item) => item?.url?.startsWith("/media/") && Number.isFinite(item.width) && Number.isFinite(item.height));
  return {
    ...product,
    title: product.title.trim(),
    category: typeof product.category === "string" ? product.category : null,
    startingPrices,
    image: product.image && variant ? { id: product.image.id, variants: [variant] } : null
  };
}

function readPage(value: unknown): PublicExpertPageBlock[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((block): PublicExpertPageBlock[] => {
    if (!block || typeof block !== "object") return [];
    const record = block as { id?: unknown; type?: unknown; title?: unknown; body?: unknown; products?: unknown };
    if (typeof record.id !== "string" || !UUID_PATTERN.test(record.id) || typeof record.title !== "string") return [];
    if (record.type === "text" && typeof record.body === "string" && record.title.trim() && record.body.trim()) {
      return [{ id: record.id, type: "text", title: record.title.trim(), body: record.body.trim() }];
    }
    if (record.type !== "products" || !Array.isArray(record.products)) return [];
    const products = record.products.flatMap((item) => {
      const product = readProduct(item);
      return product ? [product] : [];
    });
    return products.length ? [{ id: record.id, type: "products", title: record.title.trim(), products }] : [];
  });
}

const fetchProfile = cache(async (id: string, locale: Locale): Promise<PublicExpertProfile | null> => {
  const response = await fetch(`${SERVER_API_BASE}/seller/directory/${encodeURIComponent(id)}?locale=${locale}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(8_000)
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("Expert profile request failed");
  const profile = await response.json() as PublicExpertProfile;
  if (!profile || typeof profile.name !== "string" || profile.name.trim().length < 1) return null;
  const activeProductCount = Number.isSafeInteger(profile.activeProductCount) && profile.activeProductCount >= 0
    ? profile.activeProductCount
    : 0;
  return {
    ...profile,
    name: profile.name.trim(),
    specialty: typeof profile.specialty === "string" && profile.specialty.trim() ? profile.specialty.trim() : null,
    bio: typeof profile.bio === "string" && profile.bio.trim() ? profile.bio.trim() : null,
    activeProductCount,
    chatAvailable: profile.chatAvailable === true,
    page: readPage(profile.page)
  };
});

function descriptionFor(profile: PublicExpertProfile, fallback: string) {
  const text = profile.page.find((block) => block.type === "text")?.body ?? profile.bio ?? profile.specialty ?? fallback;
  return text.replace(/\s+/g, " ").trim().slice(0, 180);
}

function pageJsonLd(locale: Locale, profile: PublicExpertProfile, description: string) {
  const url = `${SITE_URL}/${locale}/experts/${profile.id}`;
  const products = profile.page.flatMap((block) => block.type === "products" ? block.products : []);
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: copy[locale].home, item: `${SITE_URL}/${locale}` },
          { "@type": "ListItem", position: 2, name: copy[locale].back, item: `${SITE_URL}/${locale}/experts` },
          { "@type": "ListItem", position: 3, name: profile.name, item: url }
        ]
      },
      {
        "@type": "ProfilePage",
        name: profile.name,
        description,
        url,
        mainEntity: {
          "@type": "Person",
          name: profile.name,
          ...(profile.specialty ? { jobTitle: profile.specialty } : {}),
          ...(profile.bio ? { description: profile.bio } : {}),
          ...(profile.profilePicture ? { image: `${SITE_URL}${profile.profilePicture.url}` } : {})
        }
      },
      ...(products.length ? [{
        "@type": "ItemList",
        numberOfItems: products.length,
        itemListElement: products.map((product, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: product.title,
          url: `${SITE_URL}/${locale}/products/${encodeURIComponent(product.slug)}`
        }))
      }] : [])
    ]
  };
}

export async function generateMetadata({ params }: ExpertProfilePageProps): Promise<Metadata> {
  const { locale, id } = await params;
  if (!isLocale(locale) || !UUID_PATTERN.test(id)) return {};
  const profile = await fetchProfile(id, locale);
  if (!profile) return {};
  const description = descriptionFor(profile, copy[locale].label);
  const path = `/${locale}/experts/${id}`;
  return managedSeoMetadata(locale, path, {
    title: profile.name,
    description,
    alternates: {
      canonical: path,
      languages: {
        fa: `/fa/experts/${id}`,
        en: `/en/experts/${id}`,
        ar: `/ar/experts/${id}`,
        "x-default": `/fa/experts/${id}`
      }
    },
    openGraph: { title: profile.name, description, url: path, type: "profile" }
  });
}

export default async function ExpertProfilePage({ params }: ExpertProfilePageProps) {
  const { locale, id } = await params;
  if (!isLocale(locale) || !UUID_PATTERN.test(id)) notFound();
  const profile = await fetchProfile(id, locale);
  if (!profile) notFound();
  const c = copy[locale];
  const listed = profile.page.reduce((total, block) => total + (block.type === "products" ? block.products.length : 0), 0);
  const count = new Intl.NumberFormat(locale).format(listed > 0 ? listed : profile.activeProductCount);
  const description = descriptionFor(profile, c.label);
  const hasContent = Boolean(profile.bio) || profile.page.length > 0;

  return <div className={styles.page} dir={getDirection(locale)}>
    <a className="skip-link" href="#expert-main">{c.skip}</a>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(pageJsonLd(locale, profile, description)).replace(/</g, "\\u003c") }} />
    <main id="expert-main" className={styles.main}>
      <nav className={styles.breadcrumb} aria-label={c.back}>
        <Link href={`/${locale}` as Route}>{c.home}</Link>
        <span aria-hidden="true">/</span>
        <Link href={`/${locale}/experts` as Route}>{c.back}</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{profile.name}</span>
      </nav>
      <article className={styles.profile}>
        <header className={styles.identity}>
          <SellerAvatar className={styles.avatar} name={profile.name} picture={profile.profilePicture} locale={locale} size={64} priority />
          <div className={styles.identityCopy}>
            <p className={styles.badge}><DesignIcon name="check" />{c.label}</p>
            <h1>{profile.name}</h1>
            {profile.specialty ? <p className={styles.specialty}>{profile.specialty}</p> : null}
            <p className={styles.count}><strong>{count}</strong> {listed > 0 ? c.listed : c.products}</p>
          </div>
          {profile.chatAvailable ? (
            <div className={styles.actions}>
              <ExpertStartChat
                sellerId={profile.id}
                sellerName={profile.name}
                available
                locale={locale}
                nextPath={`/${locale}/experts/${profile.id}`}
                className={styles.chatButton}
                errorClassName={styles.chatError}
                c={{
                  startChat: c.startChat,
                  openingChat: c.openingChat,
                  chatUnavailable: c.chatUnavailable,
                  chatError: c.chatError
                }}
              />
            </div>
          ) : null}
        </header>
        {profile.bio ? (
          <section aria-labelledby="expert-about">
            <h2 id="expert-about">{c.about}</h2>
            <p>{profile.bio}</p>
          </section>
        ) : null}
        {profile.page.map((block) => block.type === "text" ? (
          <section key={block.id} aria-labelledby={`section-${block.id}`}>
            <h2 id={`section-${block.id}`}>{block.title}</h2>
            <p>{block.body}</p>
          </section>
        ) : (
          <ExpertProductSlider key={block.id} locale={locale} sectionId={block.id} title={block.title || c.section} products={block.products} />
        ))}
        {hasContent ? null : (
          <p className={styles.empty}>
            {c.fallback}{" "}
            <Link href={`/${locale}/experts` as Route}>{c.back}</Link>
          </p>
        )}
      </article>
    </main>
    <PublicFooter locale={locale} />
  </div>;
}
