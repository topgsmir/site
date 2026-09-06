## `AdminPanelPage` in apps/web/src/app/[locale]/admin/page.tsx (L23-L32)

**Purpose:** Validates the localized admin route, authorizes a platform administrator, and hands identity context to the vendor-management client (L23-L32).

---

**Inputs & Assumptions:**
- `params.locale` (`string`): untrusted URL segment (L17-L23).
- Implicit: incoming cookies and server-to-API connectivity through `requireUser`.
- Precondition: `notFound` and `requireUser` terminate on invalid/unauthorized paths. Established by framework redirects and `requireUser` implementation (`server.ts:L27-L49`).

---

**Outputs & Effects:**
- Returns not-found for unsupported locales (L24-L26).
- Calls `/auth/me` through `requireUser`, allowing only `platform-admin` (L28-L29).
- Renders `VendorManagement` with validated locale and authenticated user's full name (L31).

---

**Block-by-Block:**

```tsx
// L24-L29
if (!isLocale(params.locale)) { notFound(); }
const locale = params.locale;
const user = await requireUser(locale, ["platform-admin"]);
```
- **What:** Establishes supported locale and current platform-admin identity.
- **Why here:** No privileged client workspace is rendered before server authorization.
- **Assumes:** `/auth/me` successful body matches `AppUser`; `requireUser` runtime body validation: nothing found (`server.ts:L44-L49`).
- **Establishes:** normal return from `requireUser` has an allowed role according to its response.
- **Depended on by:** component render at L31.

```tsx
// L31
return <VendorManagement locale={locale} adminName={user.fullName} />;
```
- **What:** Crosses server-authenticated data into a client component.
- **Why here:** UI mounts only after the server check.
- **Assumes:** client-side vendor operations remain independently protected. Established by `PlatformAdminGuard` on all list/create/update routes (`seller.controller.ts:L35-L64`).
- **Establishes:** initial client props identify locale and display name, not session authority.
- **Depended on by:** `VendorManagement` copy and account display.

---

**Cross-Function Dependencies:**
- Callee `isLocale` exact allowlist (`locales.ts:L6-L8`).
- Callee `requireUser` forwards cookies to `/auth/me`, checks role, and redirects (`server.ts:L27-L50`; record `web__requireUser.md`).
- Callee `VendorManagement` performs guarded API operations.
- Caller: Next.js `/[locale]/admin` route; middleware also recognizes `/admin` and requires cookie presence before page execution (`middleware.ts:L9-L20`).
- Shared state: authentication cookie/user database row and vendor-management API state.
- Invariant coupling: middleware checks token structure/presence, page checks current user role through API, API mutations check platform-admin again.

---

**Open Questions:**
- unclear; need deployment behavior for server-side API URL/cookie forwarding, as recorded in `web__requireUser.md`.
