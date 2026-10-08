export type TemplateLocale = "fa" | "en" | "ar";
export const templateIcons = ["bag", "file", "layers", "headphones", "settings", "spark", "gift"] as const;
export type TemplateIcon = typeof templateIcons[number];
export interface TemplateMenuItem { label: string; href: string; icon: TemplateIcon; enabled: boolean }
export interface TemplateConfiguration {
  tagline: string;
  banner: { enabled: boolean; text: string; linkLabel: string; href: string; image: string; imageAlt: string };
  navigation: TemplateMenuItem[];
  categories: { enabled: boolean; title: string; items: TemplateMenuItem[] };
}
export interface TemplateSettingsDocument { locale: TemplateLocale; version: number; configuration: TemplateConfiguration; updatedAt: string | null }

export function defaultTemplateConfiguration(locale: TemplateLocale): TemplateConfiguration {
  const c = {
    fa: { tagline: "همراه متخصصان موبایل", banner: "فایل، آموزش و ابزار تخصصی تعمیرات موبایل", shop: "فروشگاه", services: "خدمات", experts: "کارشناسان", journal: "مجله", contact: "تماس با ما", categories: "دسته‌بندی محصولات", digital: "فایل و آموزش", physical: "ابزار و تجهیزات", service: "خدمات آنلاین", bridge: "خرید واسطه‌ای" },
    en: { tagline: "For the craft of repair", banner: "Specialist files, training and mobile repair tools", shop: "Shop", services: "Services", experts: "Experts", journal: "Journal", contact: "Contact", categories: "Product categories", digital: "Files & training", physical: "Tools & equipment", service: "Online services", bridge: "Assisted purchases" },
    ar: { tagline: "رفيق متخصصي الصيانة", banner: "ملفات وتدريب وأدوات متخصصة لصيانة الجوال", shop: "المتجر", services: "الخدمات", experts: "الخبراء", journal: "المجلة", contact: "اتصل بنا", categories: "فئات المنتجات", digital: "ملفات وتدريب", physical: "أدوات ومعدات", service: "خدمات عن بعد", bridge: "شراء بالوساطة" }
  }[locale];
  const base = "/" + locale;
  const item = (label: string, href: string, icon: TemplateIcon): TemplateMenuItem => ({ label, href, icon, enabled: true });
  return {
    tagline: c.tagline,
    banner: { enabled: true, text: c.banner, linkLabel: c.shop, href: base + "/products", image: "", imageAlt: "" },
    navigation: [item(c.shop, base + "/products", "bag"), item(c.services, base + "#services", "settings"), item(c.experts, base + "#agents", "headphones"), item(c.journal, base + "/blog", "file"), item(c.contact, base + "/contact-us", "headphones")],
    categories: { enabled: true, title: c.categories, items: [item(c.digital, base + "/products?type=digital", "file"), item(c.physical, base + "/products?type=physical", "layers"), item(c.service, base + "/products?type=service", "headphones"), item(c.bridge, base + "/products?type=bridge", "bag")] }
  };
}
