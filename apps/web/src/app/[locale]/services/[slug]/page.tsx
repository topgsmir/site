import type { Metadata, Route } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicFooter } from "@/components/PublicFooter";
import { homepageHeroAds } from "@/components/landing/homepage-defaults";
import { getDirection, isLocale, type Locale } from "@/lib/i18n";
import styles from "./ServiceCampaign.module.css";

type Slug = "modem-unlock" | "samsung-network-unlock" | "frp-removal";
type Props = { params: Promise<{ locale: string; slug: string }> };

const slugs: Slug[] = ["modem-unlock", "samsung-network-unlock", "frp-removal"];
const copy = {
  fa: {
    home: "صفحه اصلی", services: "خدمات تخصصی", ask: "بررسی با کارشناس", browse: "مشاهده خدمات فروشگاه", before: "برای بررسی سرویس", model: "مدل دقیق دستگاه", state: "وضعیت فعلی دستگاه یا شبکه", ownership: "مدرک مالکیت برای سرویس‌های امنیتی", note: "سازگاری، روش انجام و هزینه پس از بررسی دستگاه مشخص می‌شود.",
    details: {
      "modem-unlock": "مدل و وضعیت قفل مودم را با کارشناس بررسی کنید تا گزینه مناسب مشخص شود.",
      "samsung-network-unlock": "مدل گوشی و وضعیت شبکه را بررسی کنید تا روش‌های موجود مشخص شوند.",
      "frp-removal": "اگر مالک دستگاه هستید، مدل گوشی و مدارک مالکیت را برای بررسی روش‌های مجاز آماده کنید."
    }
  },
  en: {
    home: "Home", services: "Specialist services", ask: "Ask a specialist", browse: "Browse store services", before: "For a service review", model: "Exact device model", state: "Current device or network state", ownership: "Proof of ownership for security services", note: "Compatibility, process, and price are confirmed after the device is reviewed.",
    details: {
      "modem-unlock": "Review your modem model and lock state with a specialist to find an appropriate option.",
      "samsung-network-unlock": "Review the phone model and network state to learn which methods are available.",
      "frp-removal": "If you own the device, prepare its model and proof of ownership for a review of permitted options."
    }
  },
  ar: {
    home: "الرئيسية", services: "خدمات متخصصة", ask: "استشر مختصًا", browse: "تصفح خدمات المتجر", before: "لمراجعة الخدمة", model: "طراز الجهاز الدقيق", state: "حالة الجهاز أو الشبكة الحالية", ownership: "إثبات الملكية لخدمات الأمان", note: "يُحدَّد التوافق وطريقة العمل والسعر بعد مراجعة الجهاز.",
    details: {
      "modem-unlock": "راجع طراز المودم وحالة القفل مع مختص لتحديد الخيار المناسب.",
      "samsung-network-unlock": "راجع طراز الهاتف وحالة الشبكة لمعرفة الطرق المتاحة.",
      "frp-removal": "إذا كنت مالك الجهاز، جهّز طرازه وإثبات الملكية لمراجعة الخيارات المسموح بها."
    }
  }
} as const;

function campaign(locale: Locale, slug: string) {
  const index = slugs.indexOf(slug as Slug);
  return index < 0 ? null : { ad: homepageHeroAds(locale)[index], slug: slugs[index] };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const item = campaign(locale, slug);
  if (!item) notFound();
  return { title: item.ad.title, description: copy[locale].details[item.slug] };
}

export default async function ServiceCampaignPage({ params }: Props) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const item = campaign(locale, slug);
  if (!item) notFound();
  const c = copy[locale];

  return <div className={styles.page} dir={getDirection(locale)} data-service-campaign>
    <main className={styles.main}>
      <nav className={styles.breadcrumb} aria-label={c.services}>
        <Link href={`/${locale}` as Route}>{c.home}</Link><span aria-hidden="true">/</span><span>{c.services}</span><span aria-hidden="true">/</span><span aria-current="page">{item.ad.title}</span>
      </nav>
      <article className={styles.campaign}>
        <div className={styles.photo}><Image src={item.ad.image} alt="" fill priority sizes="(max-width: 760px) 100vw, 48vw" /></div>
        <div className={styles.content}>
          <p className={styles.kicker}>{item.ad.label}</p>
          <h1>{item.ad.title}</h1>
          <p className={styles.intro}>{c.details[item.slug]}</p>
          <section className={styles.checklist} aria-labelledby="service-review-title">
            <h2 id="service-review-title">{c.before}</h2>
            <ul><li>{c.model}</li><li>{c.state}</li>{item.slug === "frp-removal" && <li>{c.ownership}</li>}</ul>
          </section>
          <p className={styles.note}>{c.note}</p>
          <div className={styles.actions}>
            <Link className={styles.primary} href={`/${locale}/contact-us` as Route}>{c.ask}</Link>
            <Link className={styles.secondary} href={`/${locale}/products?type=service` as Route}>{c.browse}</Link>
          </div>
        </div>
      </article>
    </main>
    <PublicFooter locale={locale} />
  </div>;
}
