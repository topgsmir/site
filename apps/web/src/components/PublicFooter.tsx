import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";
import type { HomepageContent } from "@topgsm/shared-types";
import { getDirection, type Locale } from "@/lib/i18n";
import styles from "./PublicFooter.module.css";

const copy = {
  fa: {
    brand: "تاپ جی‌اس‌ام",
    title: "مرجع تخصصی تعمیرات موبایل",
    description: "فایل، آموزش، ابزار و خدمات تخصصی تعمیرات موبایل را در تاپ جی‌اس‌ام پیدا کنید و برای انتخاب محصول و پیگیری سفارش، مستقیم با کارشناسان در ارتباط باشید.",
    explore: "دسترسی سریع",
    products: "محصولات",
    services: "خدمات آنلاین",
    blog: "مجله تعمیرات",
    contact: "ارتباط با ما",
    rules: "قوانین و مقررات",
    licenses: "نمادها و مجوزها",
    enamad: "نماد اعتماد الکترونیکی",
    ecunion: "اتحادیه کشوری کسب‌وکارهای مجازی",
    samandehi: "ساماندهی پایگاه‌های اینترنتی",
    eanjoman: "انجمن صنفی کسب‌وکارهای اینترنتی",
    legal: "استفاده از مطالب تاپ جی‌اس‌ام برای مقاصد غیرتجاری و با ذکر منبع مجاز است. تمام حقوق این وب‌سایت متعلق به تاپ جی‌اس‌ام است.",
    edit: "ویرایش صفحه اصلی"
  },
  en: {
    brand: "Top GSM",
    title: "Specialist mobile repair resources",
    description: "Find mobile repair files, training, tools, and specialist services at Top GSM. Connect directly with experts to choose a product and follow your order.",
    explore: "Explore",
    products: "Products",
    services: "Online services",
    blog: "Repair journal",
    contact: "Contact us",
    rules: "Rules and regulations",
    licenses: "Trust marks and licenses",
    enamad: "Electronic Trust Symbol (eNAMAD)",
    ecunion: "National Union of Virtual Businesses",
    samandehi: "Samandehi website registration",
    eanjoman: "Internet Businesses Guild",
    legal: "Top GSM content may be used for non-commercial purposes with source attribution. All rights to this website belong to Top GSM.",
    edit: "Edit homepage"
  },
  ar: {
    brand: "Top GSM",
    title: "مرجع متخصص لصيانة الجوال",
    description: "اعثر على ملفات وتدريب وأدوات وخدمات صيانة الجوال في Top GSM، وتواصل مباشرة مع الخبراء لاختيار المنتج ومتابعة طلبك.",
    explore: "روابط سريعة",
    products: "المنتجات",
    services: "الخدمات عن بُعد",
    blog: "مجلة الصيانة",
    contact: "تواصل معنا",
    rules: "القواعد والأحكام",
    licenses: "شعارات الثقة والتراخيص",
    enamad: "رمز الثقة الإلكترونية (eNAMAD)",
    ecunion: "الاتحاد الوطني للأعمال الافتراضية",
    samandehi: "تسجيل المواقع لدى ساماندهی",
    eanjoman: "جمعية الأعمال عبر الإنترنت",
    legal: "يمكن استخدام محتوى Top GSM لأغراض غير تجارية مع ذكر المصدر. جميع حقوق هذا الموقع محفوظة لـ Top GSM.",
    edit: "تعديل الصفحة الرئيسية"
  }
} as const;

type PublicFooterProps = {
  locale: Locale;
  content?: HomepageContent["footer"];
  editable?: boolean;
};

export function PublicFooter({ locale, content, editable = false }: PublicFooterProps) {
  const c = copy[locale];
  // Local logo assets; issuer-specific verification links must use Top GSM's own credentials.
  const licenses = [
    { src: "/images/licenses/enamad.png", alt: c.enamad },
    { src: "/images/licenses/ecunion.png", alt: c.ecunion },
    { src: "/images/licenses/samandehi.png", alt: c.samandehi },
    { src: "/images/licenses/eanjoman.png", alt: c.eanjoman }
  ];
  const links = [
    { href: `/${locale}/products`, label: c.products },
    { href: `/${locale}/products?type=service`, label: c.services },
    { href: `/${locale}/blog`, label: c.blog },
    { href: `/${locale}/contact-us`, label: c.contact },
    { href: `/${locale}/rules`, label: c.rules }
  ];

  return (
    <footer className={styles.footer} dir={getDirection(locale)}>
      <div className={styles.inner}>
        <div className={styles.main}>
          <div className={styles.introduction}>
            <Link className={styles.brand} href={`/${locale}` as Route} aria-label={c.brand}>
              <Image className={styles.brandMark} src="/brand/topgsm-mark.webp" alt="" width={48} height={48} unoptimized />
              <span className={styles.brandText}>
                <span className={styles.brandName}>{c.brand}</span>
                <span className={styles.brandTagline}>{c.title}</span>
              </span>
            </Link>
            <p>{content?.description.trim() || c.description}</p>
            <nav className={styles.navigation} aria-label={c.explore}>
              <ul>{links.map((link) => <li key={link.href}>
                <Link href={link.href as Route}>{link.label}</Link>
              </li>)}</ul>
            </nav>
          </div>
          <section className={styles.trust} aria-labelledby={`footer-licenses-${locale}`}>
            <h2 id={`footer-licenses-${locale}`}>{c.licenses}</h2>
            <ul className={styles.licenses} dir="ltr">
              {licenses.map((license) => <li className={styles.license} key={license.src}>
                <Image className={styles.licenseImage} src={license.src} alt={license.alt} width={64} height={64} unoptimized />
              </li>)}
            </ul>
          </section>
        </div>
        <div className={styles.bottom}>
          <p>{c.legal}</p>
          {editable && <Link className={styles.edit} href={`/${locale}/admin/settings/homepage` as Route}>{c.edit}</Link>}
        </div>
      </div>
    </footer>
  );
}

