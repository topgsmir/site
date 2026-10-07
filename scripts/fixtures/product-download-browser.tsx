import { createRoot } from "react-dom/client";
import { ProductPage } from "../../apps/web/src/app/[locale]/products/[slug]/ProductPage";
import type { PublicProduct } from "../../apps/web/src/app/[locale]/products/[slug]/product.server";
import { getDictionary } from "../../apps/web/src/lib/i18n";
import "@fontsource-variable/outfit";
import "@fontsource-variable/vazirmatn";
import "../../apps/web/src/app/globals.css";

const query = new URLSearchParams(location.search);
const locale = query.get("locale") === "fa" ? "fa" : "en";
const signedIn = query.get("role") !== "guest";
document.documentElement.dir = locale === "fa" ? "rtl" : "ltr";
document.documentElement.lang = locale;
const product: PublicProduct = {
  id: "11111111-1111-4111-8111-111111111111", slug: "repair-file", title: locale === "fa" ? "فایل تعمیرات و راهنمای تخصصی گوشی سامسونگ" : "Samsung repair file",
  description: locale === "fa" ? "فایل و راهنمای تعمیر برای متخصصان موبایل." : "Repair files and instructions for mobile technicians.",
  category: "Samsung", type: "digital", kind: "simple", currency: "TOMAN", image: null,
  availableLocales: ["en", "fa"], contentLocale: locale, options: [], createdAt: "2026-10-01", updatedAt: "2026-10-01",
  variants: [{ id: "variant-1", name: "SM-A525F", options: [], offers: [{
    id: "22222222-2222-4222-8222-222222222222", price: query.get("scenario") === "free" ? "0" : "1000", currency: "TOMAN",
    seller: { id: "seller-1", shopName: locale === "fa" ? "فروشگاه تخصصی تعمیرات موبایل" : "Repair shop" },
    digital: { maxDownloads: 2, fileCount: 2 }
  }] }]
};
createRoot(document.getElementById("root")!).render(<ProductPage product={product} locale={locale}
  copy={getDictionary(locale).product} signedInUser={signedIn} accountHref={signedIn ? `/${locale}/account` : null} />);
