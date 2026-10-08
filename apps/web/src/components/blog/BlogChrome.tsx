import { HeaderLanguageLinks } from "@/components/SiteHeader";
import { PublicFooter } from "@/components/PublicFooter";
import type { Locale } from "@/lib/i18n";

export function BlogHeader({ languageHrefs }: { locale: Locale; languageHrefs?: Record<Locale, string> }) { return <HeaderLanguageLinks hrefs={languageHrefs} />; }

export function BlogFooter({ locale }: { locale: Locale }) {
  return <PublicFooter locale={locale} />;
}
