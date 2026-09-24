export type HomepageLocale = "fa" | "en" | "ar";

export interface HomepageLink { label: string; href: string }
export interface HomepageCard {
  title: string;
  description: string;
  label: string;
  href: string;
  image: string;
}
export interface HomepageSection {
  enabled: boolean;
  title: string;
  description: string;
}
export interface HomepageContent {
  hero: {
    eyebrow: string;
    title: string;
    accent: string;
    description: string;
    image: string;
    imageAlt: string;
    primary: HomepageLink;
    secondary: HomepageLink;
  };
  shortcuts: HomepageCard[];
  collections: HomepageSection & { items: HomepageCard[] };
  offers: HomepageSection & { items: HomepageCard[] };
  experts: HomepageSection;
  latest: HomepageSection;
  about: HomepageSection & { points: string[]; link: HomepageLink };
  footer: { description: string; links: HomepageLink[] };
}
export interface HomepageDocument {
  locale: HomepageLocale;
  version: number;
  content: HomepageContent | null;
  updatedAt: string | null;
}
