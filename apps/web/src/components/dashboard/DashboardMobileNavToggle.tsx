import type { Locale } from "@/lib/i18n";
import styles from "./DashboardNavigation.module.css";

const COPY = {
  en: { menu: "Menu", close: "Close navigation", current: "Current section" },
  fa: { menu: "منو", close: "بستن منو", current: "بخش فعلی" },
  ar: { menu: "القائمة", close: "إغلاق القائمة", current: "القسم الحالي" }
} as const;

export function DashboardMobileNavToggle({
  locale,
  currentLabel,
  open,
  controls,
  onToggle
}: {
  locale: Locale;
  currentLabel: string;
  open: boolean;
  controls: string;
  onToggle: () => void;
}) {
  const copy = COPY[locale];

  return <div className={styles.mobileControl}>
    <span className={styles.mobileContext}>
      <small>{copy.current}</small>
      <strong>{currentLabel}</strong>
    </span>
    <button
      className={styles.mobileToggle}
      type="button"
      aria-expanded={open}
      aria-controls={controls}
      aria-label={open ? copy.close : copy.menu}
      onClick={onToggle}
    >
      <span>{open ? copy.close : copy.menu}</span>
      <i aria-hidden="true"><span /><span /></i>
    </button>
  </div>;
}
