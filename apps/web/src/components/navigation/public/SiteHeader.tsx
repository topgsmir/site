"use client";

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import type { TemplateConfiguration } from "@topgsm/shared-types";
import { TemplateSettingsProvider } from "../../TemplateSettingsProvider";
import type { Locale } from "@/lib/i18n";
import { PublicHeader } from "./PublicHeader";
import styles from "./SiteHeader.module.css";

type LanguageLinks = Record<Locale, string>;
type RouteLinks = { pathname: string; hrefs: LanguageLinks };
const HeaderLinksContext = createContext<((links: RouteLinks) => () => void) | null>(null);

// Translated articles may have different slugs in each language.
export function HeaderLanguageLinks({ hrefs }: { hrefs?: LanguageLinks }) {
  const register = useContext(HeaderLinksContext);
  const pathname = usePathname();
  const fa = hrefs?.fa, en = hrefs?.en, ar = hrefs?.ar;
  useEffect(() => {
    if (!register || !fa || !en || !ar) return;
    return register({ pathname, hrefs: { fa, en, ar } });
  }, [register, pathname, fa, en, ar]);
  return null;
}

export function SiteHeader({ locale, accountHref, dashboardHref, children }: { locale: Locale; accountHref: string | null; dashboardHref?: string | null; children: ReactNode }) {
  const pathname = usePathname();
  const header = useRef<HTMLDivElement>(null);
  const [routeLinks, setRouteLinks] = useState<RouteLinks | null>(null);
  const register = useCallback((links: RouteLinks) => {
    setRouteLinks(links);
    return () => setRouteLinks((current) => current === links ? null : current);
  }, []);
  const path = pathname.replace(/^\/(fa|en|ar)(?=\/|$)/, "");
  const current = path === "/cart" ? "cart" : path.startsWith("/products") ? "shop" : path.startsWith("/blog") ? "journal" : path === "/contact-us" ? "contact" : path === "/about-us" ? "about" : path === "/complaints" ? "complaints" : path.startsWith("/experts") ? "experts" : path === "/remote" ? "remote" : undefined;
  const languageHrefs = routeLinks?.pathname === pathname ? routeLinks.hrefs : { fa: "/fa" + path, en: "/en" + path, ar: "/ar" + path };
  useLayoutEffect(() => {
    const surface = header.current?.querySelector<HTMLElement>("[data-site-header-main]");
    if (path === "/login" || !surface) {
      document.documentElement.style.removeProperty("--site-header-height");
      return;
    }
    const update = () => document.documentElement.style.setProperty("--site-header-height", surface.offsetHeight + "px");
    update();
    const observer = new ResizeObserver(update);
    observer.observe(surface);
    return () => { observer.disconnect(); document.documentElement.style.removeProperty("--site-header-height"); };
  }, [path]);
  const skip = locale === "fa" ? "رفتن به محتوای صفحه" : locale === "ar" ? "انتقل إلى محتوى الصفحة" : "Skip to page content";
  return <HeaderLinksContext.Provider value={register}>
    <a className="skip-link" href="#site-content">{skip}</a>
<<<<<<< HEAD:apps/web/src/components/SiteHeader.tsx
    {path !== "/login" && <div ref={header} className={styles.header} data-site-header><PublicHeader locale={locale} accountHref={accountHref} dashboardHref={dashboardHref} current={current} languageHrefs={languageHrefs} /></div>}
=======
    {path !== "/login" && <div ref={header} className={styles.header} data-site-header><PublicHeader locale={locale} accountHref={accountHref} current={current} languageHrefs={languageHrefs} appearance={path.startsWith("/seller-dashboard") ? "seller-glass" : undefined} /></div>}
>>>>>>> 920ecff94aef64f18e97fd31dde238dd77b4d4a6:apps/web/src/components/navigation/public/SiteHeader.tsx
    <div id="site-content" tabIndex={-1}>{children}</div>
  </HeaderLinksContext.Provider>;
}

// Next's global 404 bypasses the locale layout, but still shares the site's chrome.
export function GlobalSiteHeader({ configurations, signedIn, dashboardPath, children }: { configurations: Record<Locale, TemplateConfiguration>; signedIn: boolean; dashboardPath?: string | null; children: ReactNode }) {
  const pathname = usePathname();
  const code = pathname.split("/")[1];
  const locale = code === "en" || code === "ar" ? code : "fa";
  return <TemplateSettingsProvider locale={locale} configuration={configurations[locale]}><SiteHeader locale={locale} accountHref={signedIn ? "/" + locale + "/account" : null} dashboardHref={dashboardPath ? `/${locale}${dashboardPath}` : null}>{children}</SiteHeader></TemplateSettingsProvider>;
}
