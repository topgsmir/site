import { GlobalSiteHeader } from "@/components/SiteHeader";
import { getTemplateConfiguration } from "@/lib/template-settings-server";
import { getCurrentUser } from "@/lib/auth/server";
import "@fontsource-variable/outfit";
import "@fontsource-variable/vazirmatn";
import Link from "next/link";
import type { Route } from "next";
import "./globals.css";
import { GlobalNotFoundTitle } from "./GlobalNotFoundTitle";
import styles from "./global-not-found.module.css";

const copy = {
  fa: { label: "خطای ۴۰۴", title: "این صفحه پیدا نشد", description: "ممکن است نشانی تغییر کرده باشد یا صفحه دیگر در دسترس نباشد.", home: "بازگشت به خانه", journal: "مجله", shop: "فروشگاه", navigation: "مسیرهای پیشنهادی" },
  en: { label: "Error 404", title: "Page not found", description: "The address may have changed or the page may no longer be available.", home: "Back to home", journal: "Journal", shop: "Shop", navigation: "Suggested destinations" },
  ar: { label: "خطأ ٤٠٤", title: "لم نعثر على الصفحة", description: "ربما تغيّر العنوان أو لم تعد الصفحة متاحة.", home: "العودة إلى الرئيسية", journal: "المجلة", shop: "المتجر", navigation: "وجهات مقترحة" }
} as const;

const localeScript = `(() => {
  const code = location.pathname.split('/')[1];
  const locale = code === 'en' || code === 'ar' ? code : 'fa';
  document.documentElement.lang = locale;
  document.documentElement.dir = locale === 'en' ? 'ltr' : 'rtl';
  document.documentElement.dataset.notFoundLocale = locale;
  try {
    const stored = localStorage.getItem('topgsm-theme');
    document.documentElement.dataset.theme = stored === 'light' || stored === 'dark' ? stored : matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {}
})();`;

export default async function GlobalNotFound() {
  const [fa, en, ar, user] = await Promise.all([getTemplateConfiguration("fa"), getTemplateConfiguration("en"), getTemplateConfiguration("ar"), getCurrentUser()]);
  return <html lang="fa" dir="rtl" data-not-found-locale="fa" suppressHydrationWarning>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <link rel="icon" href="/brand/favicon.ico" />
      <link rel="apple-touch-icon" href="/brand/apple-touch-icon.png" />
      <title>صفحه پیدا نشد | Top GSM</title>
      <script dangerouslySetInnerHTML={{ __html: localeScript }} />
    </head>
    <body>
      <GlobalSiteHeader configurations={{ fa, en, ar }} signedIn={Boolean(user)}>
        <GlobalNotFoundTitle />
        <div className={styles.page}>
          <main className={styles.main}>
            {(["fa", "en", "ar"] as const).map((locale) => {
              const c = copy[locale];
              return <section key={locale} data-locale={locale} className={styles.content} lang={locale} dir={locale === "en" ? "ltr" : "rtl"} aria-labelledby={`title-${locale}`}>
                <div className={styles.panel}>
                  <p className={styles.label}>{c.label}</p>
                  <h1 id={`title-${locale}`}>{c.title}</h1>
                  <p className={styles.description}>{c.description}</p>
                  <Link className={styles.primary} href={`/${locale}` as Route}>{c.home}<span aria-hidden="true">{locale === "en" ? "→" : "←"}</span></Link>
                </div>
                <nav className={styles.destinations} aria-label={c.navigation}>
                  <Link href={`/${locale}/blog` as Route}>{c.journal}<span aria-hidden="true">{locale === "en" ? "↗" : "↖"}</span></Link>
                  <Link href={`/${locale}/products` as Route}>{c.shop}<span aria-hidden="true">{locale === "en" ? "↗" : "↖"}</span></Link>
                </nav>
              </section>;
            })}
          </main>
        </div>
      </GlobalSiteHeader>
    </body>
  </html>;
}
