import { NextResponse, type NextRequest } from "next/server";
import { defaultLocale, isLocale } from "@/lib/i18n";

export function proxy(request: NextRequest) {
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
