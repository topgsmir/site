import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";
import type { HomepageContent } from "@topgsm/shared-types";
import { getDirection, type Locale } from "@/lib/i18n";
import styles from "./PublicFooter.module.css";

const copy = {
  fa: {
    title: "تاپ جی‌اس‌ام؛ مرجع تخصصی تعمیرات موبایل",
    description: "فایل، آموزش، ابزار و خدمات تخصصی تعمیرات موبایل را در تاپ جی‌اس‌ام پیدا کنید و برای انتخاب محصول و پیگیری سفارش، مستقیم با کارشناسان در ارتباط باشید.",
    licenses: "نمادها و مجوزها",
    enamad: "نماد اعتماد الکترونیکی",
    ecunion: "اتحادیه کشوری کسب‌وکارهای مجازی",
    samandehi: "ساماندهی پایگاه‌های اینترنتی",
    eanjoman: "انجمن صنفی کسب‌وکارهای اینترنتی",
    legal: "استفاده از مطالب تاپ جی‌اس‌ام برای مقاصد غیرتجاری و با ذکر منبع مجاز است. تمام حقوق این وب‌سایت متعلق به تاپ جی‌اس‌ام است.",
    edit: "ویرایش صفحه اصلی"
  },
  en: {
    title: "Top GSM, specialist mobile repair resources",
    description: "Find mobile repair files, training, tools, and specialist services at Top GSM. Connect directly with experts to choose a product and follow your order.",
    licenses: "Trust marks and licenses",
    enamad: "Electronic Trust Symbol (eNAMAD)",
    ecunion: "National Union of Virtual Businesses",
    samandehi: "Samandehi website registration",
    eanjoman: "Internet Businesses Guild",
    legal: "Top GSM content may be used for non-commercial purposes with source attribution. All rights to this website belong to Top GSM.",
    edit: "Edit homepage"
  },
  ar: {
    title: "Top GSM، مرجع متخصص لصيانة الجوال",
    description: "اعثر على ملفات وتدريب وأدوات وخدمات صيانة الجوال في Top GSM، وتواصل مباشرة مع الخبراء لاختيار المنتج ومتابعة طلبك.",
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

  return (
    <footer className={styles.footer} dir={getDirection(locale)}>
      <div className={styles.inner}>
        <div className={styles.main}>
          <div className={styles.introduction}>
            <h2>{c.title}</h2>
            <p>{content?.description.trim() || c.description}</p>
          </div>
          <ul className={styles.licenses} aria-label={c.licenses} dir="ltr">
            {licenses.map((license) => <li className={styles.license} key={license.src}>
              <Image className={styles.licenseImage} src={license.src} alt={license.alt} width={64} height={64} unoptimized />
            </li>)}
          </ul>
        </div>
        <div className={styles.bottom}>
          <p>{c.legal}</p>
          {editable && <Link className={styles.edit} href={`/${locale}/admin/settings/homepage` as Route}>{c.edit}</Link>}
        </div>
      </div>
    </footer>
  );
}

