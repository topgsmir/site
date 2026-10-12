import Image from "next/image";
import styles from "./BrandLogo.module.css";

export const BRAND_ASSETS = {
  wordmark: "/brand/topgsm-wordmark.webp",
  mark: "/brand/topgsm-mark.webp",
  appleIcon: "/brand/apple-touch-icon.png"
} as const;

type BrandLogoProps = {
  variant?: "full" | "wordmark" | "mark";
  layout?: "horizontal" | "stacked";
  tone?: "default" | "inverse";
  className?: string;
  eager?: boolean;
};

/** Shared artwork; size with --brand-mark-size / --brand-wordmark-width. */
export function BrandLogo({ variant = "full", layout = "horizontal", tone = "default", className = "", eager = false }: BrandLogoProps) {
  return <span className={`${styles.logo} ${className}`} data-variant={variant} data-layout={layout} data-tone={tone}>
    {variant !== "wordmark" && <Image className={styles.mark} src={BRAND_ASSETS.mark} alt={variant === "mark" ? "Top GSM" : ""} width={256} height={260} unoptimized loading={eager ? "eager" : "lazy"} />}
    {variant !== "mark" && <Image className={styles.wordmark} src={BRAND_ASSETS.wordmark} alt="تاپ جی‌اس‌ام — Top GSM" width={640} height={152} unoptimized loading={eager ? "eager" : "lazy"} />}
  </span>;
}
