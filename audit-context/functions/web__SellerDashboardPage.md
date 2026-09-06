## `SellerDashboardPage` in apps/web/src/app/[locale]/seller-dashboard/page.tsx (L23-L46)

**Purpose:** Validates the localized seller-dashboard route, permits platform/seller administrator/staff roles, and renders the seller navigation shell with logout (L23-L46).

---

**Inputs & Assumptions:**
- `params.locale` (`string`): untrusted URL segment (L17-L23).
- Implicit: incoming cookies and `/auth/me` response through `requireUser`.
- Precondition: listed roles are the intended page audience. Established by the explicit allowed-role array at L29; finer feature permission checks are not exercised by this placeholder page.

---

**Outputs & Effects:**
- Returns not-found for unsupported locale (L24-L26).
- Authorizes `platform-admin`, `seller-admin`, or `seller-staff` through API-backed `requireUser` (L28-L29).
- Renders localized labels and a logout control (L31-L45).

---

**Block-by-Block:**

```tsx
// L24-L29
if (!isLocale(params.locale)) { notFound(); }
const locale = params.locale;
await requireUser(locale, ["platform-admin", "seller-admin", "seller-staff"]);
```
- **What:** Establishes route locale and role admission before rendering.
- **Why here:** The server boundary runs before seller UI is returned.
- **Assumes:** role alone is sufficient for every item currently rendered. The items are labels without data operations (L37-L43); no permission-specific action exists here.
- **Establishes:** normal rendering follows a successful API identity response with a listed role.
- **Depended on by:** entire returned section.

```tsx
// L31-L45
return <section>...<LogoutButton locale={locale} />...localized list...</section>;
```
- **What:** Renders the current dashboard placeholder and logout boundary.
- **Why here:** Translation calls consume the validated locale.
- **Assumes:** labels do not themselves expose persistent seller data; established by static render body.
- **Establishes:** no seller-specific data is fetched or mutated by this page.
- **Depended on by:** localized seller route UI.

---

**Cross-Function Dependencies:**
- Callees `isLocale`, `requireUser`, `t`, and `LogoutButton` (L3-L5, L24-L41).
- Caller: Next.js `/[locale]/seller-dashboard`; middleware requires structurally active session cookie for this prefix (`middleware.ts:L9-L20`).
- Shared state: authentication cookie/user/permissions are read by `requireUser`; logout can clear cookie.
- Invariant coupling: seller permission arrays returned by auth are not consulted because this page has no feature operations yet.

---

**Open Questions:**
- unclear; need future dashboard route/action inventory to determine where seller-staff permissions are enforced once labels become operations.
