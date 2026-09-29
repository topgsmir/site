"use client";

import { useEffect, useId, useState } from "react";
import type { Locale } from "@/lib/i18n";
import { api } from "@/lib/api/client";
import { productPublicUrl } from "./ProductPublicUrl";
import styles from "./ProductSlugEditor.module.css";

const SLUG_PATTERN = /^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u;

const COPY = {
  en: { label: "Product link / slug", checking: "Checking link…", available: "Link is available", taken: "This link is already used or reserved", invalid: "Use letters, numbers and hyphens", failed: "Could not check the link; saving will check again" },
  fa: { label: "لینک محصول / نامک", checking: "در حال بررسی لینک…", available: "این لینک آزاد است", taken: "این لینک قبلاً استفاده یا رزرو شده است", invalid: "فقط حروف، عدد و خط تیره وارد کنید", failed: "بررسی لینک انجام نشد؛ هنگام ذخیره دوباره بررسی می‌شود" },
  ar: { label: "رابط المنتج / المعرّف", checking: "جارٍ التحقق من الرابط…", available: "الرابط متاح", taken: "هذا الرابط مستخدم أو محجوز", invalid: "استخدم الحروف والأرقام والشرطات", failed: "تعذّر التحقق؛ ستتم المراجعة عند الحفظ" }
} as const;

export function normalizeProductSlug(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase("en-US").trim()
    .replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "").slice(0, 200);
}

export function ProductSlugEditor({ locale, slug, onChange, mode, currentProductId, className, formId }: {
  locale: Locale;
  slug: string;
  onChange: (slug: string) => void;
  mode: "admin" | "seller";
  currentProductId?: string;
  className?: string;
  formId?: string;
}) {
  const hintId = useId();
  const copy = COPY[locale];
  const valid = slug.length <= 200 && SLUG_PATTERN.test(slug) && normalizeProductSlug(slug) === slug;
  const [checked, setChecked] = useState<{ slug: string; available?: boolean } | null>(null);

  useEffect(() => {
    if (!valid) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await api.get<{ available: boolean }>(`/products/${mode === "admin" ? "admin" : "mine"}/slug-availability`, {
          params: { slug, ...(currentProductId ? { currentProductId } : {}) }, signal: controller.signal
        });
        setChecked({ slug, available: response.data.available });
      } catch {
        if (!controller.signal.aborted) setChecked({ slug });
      }
    }, 350);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [slug, valid, mode, currentProductId]);

  const state = !slug || !valid ? "invalid" : checked?.slug !== slug ? "checking" : checked.available === undefined ? "failed" : checked.available ? "available" : "taken";

  return <div className={`${styles.field} ${className ?? ""}`}>
    <div className={styles.url} id={`${hintId}-url`} dir="ltr">{productPublicUrl(locale, slug)}</div>
    <label htmlFor={hintId}>{copy.label}</label>
    <input id={hintId} form={formId} required minLength={1} maxLength={200} pattern="[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*" dir="ltr" spellCheck={false} autoComplete="off" value={slug} aria-invalid={state === "taken" || (Boolean(slug) && state === "invalid")} aria-describedby={`${hintId}-url ${hintId}-status`} onChange={(event) => onChange(event.target.value)} onBlur={() => onChange(normalizeProductSlug(slug))} />
    {slug ? <small id={`${hintId}-status`} className={styles.status} data-state={state} role="status">{copy[state]}</small> : <span id={`${hintId}-status`} className={styles.visuallyHidden}>{copy.invalid}</span>}
  </div>;
}
