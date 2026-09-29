"use client";

import { useParams } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { PublicStatePage, errorRetryLabel, publicStateActionClass } from "@/components/PublicStatePage";

export default function PublicError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { locale: value } = useParams<{ locale: string }>();
  const locale = isLocale(value) ? value : "fa";
  return <PublicStatePage locale={locale} kind="error" action={<button className={publicStateActionClass} type="button" onClick={reset}>{errorRetryLabel(locale)}</button>} />;
}
