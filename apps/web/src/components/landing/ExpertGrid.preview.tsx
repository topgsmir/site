// Development-only fixture. These names and counts are sample data, never homepage content.
import type { PublicExpertSummary } from "@topgsm/shared-types";
import type { Locale } from "@/lib/i18n";
import { ExpertGrid } from "./ExpertGrid";
import { DesignIcon } from "@/components/DesignIcon";
import styles from "./LandingPage.module.css";

const names = ["مریم رضایی", "علی محمدی", "مرتضی", "رضا احمدی", "سارا کریمی", "امیر حسینی"];
const specialties = ["تعمیرات برد و سخت‌افزار", "فایل و آموزش تعمیرات موبایل", null, "آنلاک و خدمات نرم‌افزاری", "ابزار و تجهیزات تعمیرگاهی", "خدمات تخصصی سامسونگ و شیائومی"];
export const previewExperts: PublicExpertSummary[] = Array.from({ length: 20 }, (_, index) => ({
  id: `preview-${index + 1}`,
  name: names[index % names.length],
  specialty: specialties[index % specialties.length],
  activeProductCount: index === 0 ? 0 : index + 2,
  profilePicture: null
}));

export function ExpertGridPreview({ count = 20, locale = "fa" }: { count?: number; locale?: Locale }) {
  return <div className={styles.page} dir={locale === "en" ? "ltr" : "rtl"}>
    <section className={`${styles.section} ${styles.expertsSection}`} id="agents" aria-labelledby="experts-title">
      <div className={styles.expertsHeading}>
        <h2 id="experts-title">ستاره‌های ایران</h2>
        <div className={styles.expertsIntro}>
          <p>تخصص‌های متفاوت، یک هدف مشترک: حل مشکل شما.</p>
          <a className={styles.expertsSupport} href="#support">ارتباط با پشتیبانی<DesignIcon name="arrow" /></a>
        </div>
      </div>
      <ExpertGrid experts={previewExperts.slice(0, count)} locale={locale} />
    </section>
  </div>;
}
