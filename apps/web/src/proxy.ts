import { NextResponse, type NextRequest } from "next/server";
import { defaultLocale, isLocale } from "@/lib/i18n";
import { proxySeoConfiguration } from "@/lib/seo-proxy";
import { isPublicSeoPath, seoPath } from "@/lib/seo-settings-core";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const firstSegment = pathname.split("/")[1];

  if (isLocale(firstSegment)) {
    const protectedRoute =
      pathname === `/${firstSegment}/admin` ||
      pathname.startsWith(`/${firstSegment}/admin/`) ||
      pathname === `/${firstSegment}/seller-dashboard` ||
      pathname.startsWith(`/${firstSegment}/seller-dashboard/`);

    if (protectedRoute && !hasActiveSession(request.cookies.get("topgsm_session")?.value)) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = `/${firstSegment}/login`;
      loginUrl.search = "";
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }

    if (isPublicSeoPath(pathname) && ["GET", "HEAD"].includes(request.method)) {
      try {
        const seo = await proxySeoConfiguration();
        const path = seoPath(pathname);
        const rule = seo.redirects.find((item) => item.enabled && item.source === path);
        if (rule) {
          const url = request.nextUrl.clone();
          url.pathname = rule.destination;
          // Tracking/search parameters from the old resource do not define the target.
          url.search = "";
          const response = NextResponse.redirect(url, rule.status);
          response.headers.set("Cache-Control", "public, max-age=60");
          return response;
        }
        const response = NextResponse.next();
        if (!seo.indexingEnabled || seo.pages.some((item) => item.path === path && item.noIndex)) response.headers.set("X-Robots-Tag", "noindex, follow");
        return response;
      } catch {
        return new NextResponse("Site configuration temporarily unavailable", { status: 503, headers: { "Retry-After": "60", "Cache-Control": "no-store" } });
      }
    }
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = `/${defaultLocale}${pathname === "/" ? "" : pathname}`;

  return NextResponse.redirect(url);
}

function hasActiveSession(token: string | undefined) {
  // This is only a redirect optimization. The protected page verifies the
  // opaque session against the API and its current database state.
  return typeof token === "string" && /^[A-Za-z0-9_-]{43}$/.test(token);
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|brand|.*\\..*).*)"]
};
