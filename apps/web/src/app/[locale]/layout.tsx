import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import "@fontsource-variable/outfit";
import "@fontsource-variable/vazirmatn";
import "../globals.css";
import "../blog.css";
import { getDirection, isLocale, locales } from "@/lib/i18n";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

type LocaleLayoutProps = Readonly<{
  children: React.ReactNode;
  params: Promise<{
    locale: string;
  }>;
}>;

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export const metadata: Metadata = {
  title: {
    default: "Top GSM",
    template: "%s | Top GSM"
  },
  applicationName: "Top GSM",
  formatDetection: {
    telephone: false
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f4f7fb",
  colorScheme: "light dark"
};

const themeScript = `
  (() => {
    try {
      const storedTheme = localStorage.getItem("topgsm-theme");
      const theme = storedTheme === "light" || storedTheme === "dark"
        ? storedTheme
        : matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      document.documentElement.dataset.theme = theme;
      document.documentElement.style.colorScheme = theme;
      document.querySelector('meta[name="theme-color"]')?.setAttribute(
        "content",
        theme === "dark" ? "#080d16" : "#f4f7fb"
      );
    } catch {
      document.documentElement.dataset.theme = "light";
    }
  })();
`;

export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  return (
    <html
      lang={locale}
      dir={getDirection(locale)}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        {children}
        <ThemeToggle locale={locale} />
      </body>
    </html>
  );
}
