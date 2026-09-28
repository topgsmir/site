export type SeoLocale = "fa" | "en" | "ar";
export type SeoLocaleDefaults = { locale: SeoLocale; siteName: string; titleTemplate: string; description: string; socialImage: string };
export type SeoPageOverride = { path: string; title: string; description: string; socialImage: string; noIndex: boolean; excludeFromSitemap: boolean };
export type SeoRedirect = { source: string; destination: string; status: 301 | 302; enabled: boolean };
export type SeoConfiguration = {
  indexingEnabled: boolean;
  locales: SeoLocaleDefaults[];
  googleVerification: string;
  bingVerification: string;
  organizationName: string;
  organizationLogo: string;
  sameAs: string[];
  pages: SeoPageOverride[];
  redirects: SeoRedirect[];
};
export type AdminSeoSettings = { version: number; updatedAt: string | null; configuration: SeoConfiguration };
export type SeoHistoryEntry = AdminSeoSettings & { actorUserId: string };
