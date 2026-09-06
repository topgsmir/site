## `requireUser` in apps/web/src/lib/auth/server.ts (L27-L50)

**Purpose:** Authenticates the current server-rendered request through the API, enforces an allowed-role set, redirects failures, and returns the current public user (L27-L49).

---

**Inputs & Assumptions:**
- `locale` (`Locale`): target locale for redirects. Trust: trusted after page-level `isLocale` checks (`apps/web/src/app/[locale]/admin/page.tsx:L23-L29`; seller page L22-L28).
- `allowedRoles` (`Role[]`): authorization policy supplied by the page. Trust: trusted internal configuration (admin page L29; seller page L28).
- Implicit: request cookies from `next/headers`, `API_BASE`, network/API availability (L1, L14-L17, L28-L35).
- Precondition: `/auth/me` returns the `AppUser` shape when successful. Established by: API handler and service (`apps/api/src/modules/auth/auth.controller.ts:L50-L58`; `apps/api/src/modules/auth/auth.service.ts:L107-L127`, L228-L239).

---

**Outputs & Effects:**
- Sends the complete incoming cookie header to `${API_BASE}/auth/me` with cache disabled (L28-L35).
- Redirects to localized login on transport failure or non-OK response (L31-L42).
- Redirects authenticated but disallowed roles via `dashboardFor` (L44-L47).
- Returns an `AppUser` for allowed roles (L49).
- Does not write application state directly; the API reads the user and seller permissions from PostgreSQL through Prisma (`apps/api/src/modules/auth/auth.service.ts:L107-L126`).

---

**Block-by-Block:**

```ts
// L28-L38
const cookieHeader = cookies().toString();
response = await fetch(`${API_BASE}/auth/me`, { headers: { cookie: cookieHeader }, cache: "no-store" });
```
- **What:** Forwards browser cookies to the server API's current-user endpoint.
- **Why here:** Identity and role are established before page rendering.
- **Assumes:** `API_BASE` identifies the intended API and the cookie scope is appropriate to forward. Established by environment/deployment configuration: nothing found in this function.
- **Establishes:** either a `Response` exists or redirect is invoked on transport failure.
- **Depended on by:** response status and JSON handling (L40-L49).

```ts
// L40-L49
if (!response.ok) redirect(`/${locale}/login`);
const user = (await response.json()) as AppUser;
if (!allowedRoles.includes(user.role)) redirect(dashboardFor(user, locale));
return user;
```
- **What:** Converts API status/body into authentication and role-control decisions.
- **Why here:** JSON is consumed only after success status.
- **Assumes:** successful JSON is an `AppUser`; runtime validation in this function: nothing found.
- **Establishes:** on normal return, the user came from a successful `/auth/me` response and `allowedRoles` contains `user.role`.
- **Depended on by:** dashboard pages and their client-component props.

---

**Cross-Function Dependencies:**
- Callee `/auth/me` (external-source-available API): reads cookie/bearer token, verifies HMAC/claims, loads the user, and returns public fields (`apps/api/src/modules/auth/auth.controller.ts:L50-L58`; auth service L107-L127, L164-L203).
- Callee `dashboardFor` (internal): maps rejected authenticated roles to a localized dashboard/home (L19-L25).
- Callee `redirect` (external-source-available framework): terminates rendering through a navigation response (L37, L41, L46).
- Callers: `AdminPanelPage` allows only `platform-admin`; `SellerDashboardPage` allows platform and seller roles (admin page L29; seller page L28).
- Shared state: incoming cookie; API users and seller-permission rows (auth service L109-L120).
- Invariant couplings: every privileged server page must call this helper with its correct role set; current callers do.

---

**Open Questions:**
- unclear; need deployment configuration to establish the concrete `API_BASE` and whether forwarding the entire cookie header is intended across that boundary.

