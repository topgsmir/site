import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { SellerAvatar } from "@/components/seller/SellerAvatar";
import { notFound } from "next/navigation";
import type { PublicExpertProfile } from "@topgsm/shared-types";
import { DesignIcon } from "@/components/DesignIcon";
import { PublicFooter } from "@/components/PublicFooter";
import { SERVER_API_BASE } from "@/lib/api/server";
import { getDirection, isLocale } from "@/lib/i18n";
import styles from "./ExpertProfile.module.css";

type ExpertProfilePageProps = {
  params: Promise<{ locale: string; id: string }>;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const copy = {
  fa: { label: "کارشناس تأییدشده", about: "درباره کارشناس", fallbackBio: "این کارشناس هنوز توضیحی برای پروفایل خود ثبت نکرده است.", products: "محصول فعال", shop: "رفتن به فروشگاه", back: "بازگشت به کارشناسان" },
  en: { label: "Verified expert", about: "About the expert", fallbackBio: "This expert has not added a profile introduction yet.", products: "active products", shop: "Visit the shop", back: "Back to experts" },
  ar: { label: "خبير معتمد", about: "عن الخبير", fallbackBio: "لم يضف هذا الخبير نبذة إلى ملفه بعد.", products: "منتج نشط", shop: "زيارة المتجر", back: "العودة إلى الخبراء" }
} as const;

async function fetchProfile(id: string): Promise<PublicExpertProfile | null> {
  const response = await fetch(`${SERVER_API_BASE}/seller/directory/${encodeURIComponent(id)}`, { next: { revalidate: 60 } });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("Expert profile request failed");
  return response.json() as Promise<PublicExpertProfile>;
}

export async function generateMetadata({ params }: ExpertProfilePageProps): Promise<Metadata> {
  const { locale, id } = await params;
  if (!isLocale(locale) || !UUID_PATTERN.test(id)) return {};
  const profile = await fetchProfile(id);
  if (!profile) return {};
  return { title: profile.name, description: profile.bio ?? profile.specialty ?? copy[locale].label };
}

export default async function ExpertProfilePage({ params }: ExpertProfilePageProps) {
  const { locale, id } = await params;
  if (!isLocale(locale) || !UUID_PATTERN.test(id)) notFound();
  const profile = await fetchProfile(id);
  if (!profile) notFound();
  const c = copy[locale];
  const count = new Intl.NumberFormat(locale).format(profile.activeProductCount);

  return <div className={styles.page} dir={getDirection(locale)}>
    
    <main className={styles.main}>
      <Link className={styles.back} href={`/${locale}#agents` as Route}><DesignIcon name="arrow" />{c.back}</Link>
      <article className={styles.profile}>
        <header><SellerAvatar className={styles.avatar} name={profile.name} picture={profile.profilePicture} locale={locale} size={68} priority /><div><p className={styles.badge}><DesignIcon name="check" />{c.label}</p><h1>{profile.name}</h1><p className={styles.specialty}>{profile.specialty ?? c.label}</p></div></header>
        <section aria-labelledby="expert-about"><h2 id="expert-about">{c.about}</h2><p>{profile.bio ?? c.fallbackBio}</p></section>
        <footer><span><strong>{count}</strong> {c.products}</span><Link href={`/${locale}/products` as Route}>{c.shop}<DesignIcon name="arrow" /></Link></footer>
      </article>
    </main>
    <PublicFooter locale={locale} />
  </div>;
}
