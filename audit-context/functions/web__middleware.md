## `middleware` in apps/web/src/middleware.ts (L4-L30)

**Purpose:** Normalizes non-localized requests to the default locale and performs an early session-presence/expiry gate for localized admin and seller-dashboard URLs (L4-L29).

---

**Inputs & Assumptions:**
- `request` (`NextRequest`): framework request containing an untrusted URL and cookies (L4-L6, L15).
- Implicit: `defaultLocale` and `isLocale` imported from the i18n module (L2).
- Precondition: a cookie that `hasActiveSession` accepts represents an authenticated user authorized for the requested dashboard. Established by: nothing found; this function only parses an unsigned payload/expiry (L15, L32-L40). Server page guards independently establish identity and role for the two current pages (`apps/web/src/app/[locale]/admin/page.tsx:L23-L31`, `apps/web/src/app/[locale]/seller-dashboard/page.tsx:L22-L28`).

---

**Outputs & Effects:**
- Returns `NextResponse.next()` for already-localized, unprotected paths and protected paths with a locally accepted token (L8-L24).
- Returns a redirect to `/{locale}/login?next={pathname}` for protected paths without a locally accepted token (L15-L20).
- Returns a redirect that prefixes `defaultLocale` for all other matched paths (L26-L29).
- Does not modify cookies or persistent state (L4-L30).

---

**Block-by-Block:**

```ts
// L5-L8
const { pathname } = request.nextUrl;
const firstSegment = pathname.split("/")[1];
if (isLocale(firstSegment)) {
```
- **What:** Extracts and recognizes the first URL segment.
- **Why here:** Route protection and locale normalization branch on this result.
- **Assumes:** `request.nextUrl.pathname` uses the framework-normalized path representation (L5).
- **Establishes:** `firstSegment` is a `Locale` inside the branch because `isLocale` checks membership (`apps/web/src/lib/i18n/locales.ts:L6-L8`).
- **Depended on by:** protected-route construction and localized redirects (L9-L23).

```ts
// L9-L23
const protectedRoute = pathname === `/${firstSegment}/admin` || ...;
if (protectedRoute && !hasActiveSession(request.cookies.get("topgsm_session")?.value)) { ... }
return NextResponse.next();
```
- **What:** Identifies two route families, consults the session prefilter, and otherwise continues.
- **Why here:** It prevents obviously absent/expired sessions from reaching dashboard rendering.
- **Assumes:** the protected-route list stays synchronized with every privileged web route. Established by: nothing found.
- **Establishes:** only that a continued protected request carried a token with a parseable future `exp`; it does not establish signature, user existence, or role (L15, L32-L40).
- **Depended on by:** current admin and seller pages as an early redirect; their server-side `requireUser` call remains the authoritative check.

```ts
// L26-L29
const url = request.nextUrl.clone();
url.pathname = `/${defaultLocale}${pathname === "/" ? "" : pathname}`;
return NextResponse.redirect(url);
```
- **What:** Prefixes the default locale while preserving the original query.
- **Why here:** Runs only after locale recognition fails.
- **Assumes:** all matched non-localized paths are intended to live below a locale prefix. Established by the matcher exclusion list only for API/static/file paths (L46-L47).
- **Establishes:** the redirect target begins with the configured default locale.
- **Depended on by:** public entry URLs such as `/`.

---

**Cross-Function Dependencies:**
- Callee `isLocale` (internal): exact allowlist membership over `fa`, `en`, `ar` (`apps/web/src/lib/i18n/locales.ts:L1-L8`).
- Callee `hasActiveSession` (internal): accepts only payloads with numeric, future `exp`, and returns false on parse errors (L32-L43).
- Callee `NextResponse.redirect` / `NextResponse.next` (external-source-available framework): constructs routing responses (L20, L23, L29).
- Callers: Next.js invokes it for `config.matcher`, excluding API, framework assets, brand assets, and paths containing a file extension (L46-L47).
- Shared state: reads `topgsm_session`; the API writes it during login/register (`apps/api/src/modules/auth/auth.controller.ts:L29-L47`, L66-L86).
- Invariant couplings: privileged page access is finally coupled to `requireUser` and the API token verifier (`apps/web/src/lib/auth/server.ts:L27-L49`; `apps/api/src/modules/auth/auth.service.ts:L107-L127`, L164-L203).

---

**Open Questions:**
- unclear; need to inventory future privileged routes to know whether the hard-coded route families remain complete.

