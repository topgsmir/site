"use client";

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import type { TemplateConfiguration } from "@topgsm/shared-types";
import { TemplateSettingsProvider } from "./TemplateSettingsProvider";
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

export function SiteHeader({ locale, accountHref, children }: { locale: Locale; accountHref: string | null; children: ReactNode }) {
  const pathname = usePathname();
  const header = useRef<HTMLDivElement>(null);
  const [routeLinks, setRouteLinks] = useState<RouteLinks | null>(null);
  const register = useCallback((links: RouteLinks) => {
    setRouteLinks(links);
    return () => setRouteLinks((current) => current === links ? null : current);
  }, []);
  const path = pathname.replace(/^\/(fa|en|ar)(?=\/|$)/, "");
  const current = path === "/cart" ? "cart" : path.startsWith("/products") ? "shop" : path.startsWith("/blog") ? "journal" : path === "/contact-us" ? "contact" : undefined;
  const languageHrefs = routeLinks?.pathname === pathname ? routeLinks.hrefs : { fa: "/fa" + path, en: "/en" + path, ar: "/ar" + path };
  useLayoutEffect(() => {
    const surface = header.current?.querySelector<HTMLElement>("[data-site-header-main]");
    if (!surface) return;
    const update = () => document.documentElement.style.setProperty("--site-header-height", surface.offsetHeight + "px");
    update();
    const observer = new ResizeObserver(update);
    observer.observe(surface);
    return () => { observer.disconnect(); document.documentElement.style.removeProperty("--site-header-height"); };
  }, []);
  const skip = locale === "fa" ? "رفتن به محتوای صفحه" : locale === "ar" ? "انتقل إلى محتوى الصفحة" : "Skip to page content";
  return <HeaderLinksContext.Provider value={register}>
    <a className="skip-link" href="#site-content">{skip}</a>
    <div ref={header} className={styles.header} data-site-header><PublicHeader locale={locale} accountHref={accountHref} current={current} languageHrefs={languageHrefs} /></div>
    <div id="site-content" tabIndex={-1}>{children}</div>
  </HeaderLinksContext.Provider>;
}

// Next's global 404 bypasses the locale layout, but still shares the site's chrome.
export function GlobalSiteHeader({ configurations, signedIn, children }: { configurations: Record<Locale, TemplateConfiguration>; signedIn: boolean; children: ReactNode }) {
  const pathname = usePathname();
  const code = pathname.split("/")[1];
  const locale = code === "en" || code === "ar" ? code : "fa";
  return <TemplateSettingsProvider locale={locale} configuration={configurations[locale]}><SiteHeader locale={locale} accountHref={signedIn ? "/" + locale + "/account" : null}>{children}</SiteHeader></TemplateSettingsProvider>;
}
