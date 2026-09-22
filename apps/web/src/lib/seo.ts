import type { Locale } from "./i18n";

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://top-gsm.ir").replace(/\/+$/, "");
export const PRODUCT_TYPES = ["digital", "physical", "service", "bridge"] as const;
export type SearchQuery = Record<string, string | string[] | undefined>;
export const UUID_CURSOR = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function cursorFrom(query: SearchQuery): string | undefined {
  if (query.cursor === undefined) return undefined;
  if (typeof query.cursor !== "string" || !UUID_CURSOR.test(query.cursor)) throw new Error("INVALID_CURSOR");
  return query.cursor.toLowerCase();
}

export function catalogQuery(query: SearchQuery) {
  const searches = Array.isArray(query.search) ? query.search : [query.search];
  const search = searches.find((value) => typeof value === "string" && value.trim()) ?? "";
  return {
    search: search.replace(/\s+/g, " ").trim().slice(0, 100).trimEnd(),
    type: typeof query.type === "string" && PRODUCT_TYPES.includes(query.type as typeof PRODUCT_TYPES[number]) ? query.type : "all",
    cursor: cursorFrom(query)
  };
}

export function listingHref(path: string, input: { search?: string; type?: string; cursor?: string | null }) {
  const query = new URLSearchParams();
  if (input.type && input.type !== "all") query.set("type", input.type);
  if (input.search?.trim()) query.set("search", input.search.replace(/\s+/g, " ").trim());
  if (input.cursor) query.set("cursor", input.cursor);
  return `${path}${query.size ? `?${query}` : ""}`;
}

export const catalogCopy = {
  fa: { all: "فروشگاه فایل، ابزار و خدمات تعمیرات موبایل", digital: "فایل و آموزش تعمیرات موبایل", physical: "ابزار تعمیرات موبایل", service: "خدمات تخصصی تعمیرات موبایل", bridge: "خدمات خرید واسطه‌ای", description: "محصولات و پیشنهادهای فروشندگان تاپ جی‌اس‌ام را ببینید و مقایسه کنید.", search: "نتایج جست‌وجو", next: "صفحه بعد", first: "صفحه اول", pagination: "صفحه‌های نتایج" },
  en: { all: "Mobile repair files, tools and services", digital: "Mobile repair files and training", physical: "Mobile repair tools", service: "Specialist mobile repair services", bridge: "Assisted purchase services", description: "Browse and compare products and seller offers at Top GSM.", search: "Search results", next: "Next page", first: "First page", pagination: "Result pages" },
  ar: { all: "ملفات وأدوات وخدمات صيانة الهواتف", digital: "ملفات وتدريب صيانة الهواتف", physical: "أدوات صيانة الهواتف", service: "خدمات متخصصة لصيانة الهواتف", bridge: "خدمات الشراء بالوساطة", description: "تصفّح منتجات وعروض بائعي Top GSM وقارن بينها.", search: "نتائج البحث", next: "الصفحة التالية", first: "الصفحة الأولى", pagination: "صفحات النتائج" }
} satisfies Record<Locale, Record<string, string>>;
