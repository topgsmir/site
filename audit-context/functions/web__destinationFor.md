## `destinationFor` in apps/web/src/app/[locale]/login/LoginForm.tsx (L42-L64)

**Purpose:** Chooses a role-appropriate post-authentication route and conditionally accepts a localized `next` query path.

---

**Inputs & Assumptions:**
- `user` (`AuthUser`): API response; semi-trusted after successful auth response but cast without client runtime validation (L96-L107).
- `locale` (`Locale`): validated server route prop.
- `nextPath` (`string | undefined`): untrusted query input forwarded by `LoginPage` (login page L13, L23).
- Precondition: role strings follow the local union. Runtime establishment: nothing found in the client; API public-user conversion supplies current values (`apps/api/src/modules/auth/auth.service.ts:L228-L239`).

---

**Outputs & Effects:**
- Returns role fallback: platform admin dashboard, seller dashboard, or locale home (L43-L48).
- Accepts `nextPath` only when it starts with `/{locale}/`, contains no `://`, and passes role checks for admin/seller prefixes (L50-L63).
- No side effects.

---

**Block-by-Block:**

```tsx
// L43-L48
const fallback = user.role === "platform-admin" ? ... : ...;
```
- **What:** Derives default destination from role.
- **Why here:** Every rejection path returns this value.
- **Assumes:** unknown runtime roles may go home. Established by final ternary fallback.
- **Establishes:** fallback stays within locale.
- **Depended on by:** L50-L60 and caller navigation.

```tsx
// L50-L63
if (!nextPath?.startsWith(`/${locale}/`) || nextPath.includes("://")) return fallback;
if (nextPath.startsWith(`/${locale}/admin`) && user.role !== "platform-admin") return fallback;
if (nextPath.startsWith(`/${locale}/seller-dashboard`) && ![...].includes(user.role)) return fallback;
return nextPath;
```
- **What:** Applies syntactic locale/origin tests and two path-prefix role policies.
- **Why here:** Prevents the raw query value from unconditionally controlling navigation.
- **Assumes:** path-prefix matching represents route authorization boundaries. Established by current page guards, which independently authorize exact dashboard pages/subtrees at render/API boundaries (`middleware.ts:L9-L20`; admin page L29; seller page L28).
- **Establishes:** returned untrusted continuation is localized and not an explicit scheme URL; authorization for destination is still enforced by destination pages/APIs.
- **Depended on by:** `router.push` in `submit` (L107).

---

**Cross-Function Dependencies:**
- No project callees.
- Caller: `LoginForm.submit` (L107).
- Shared state: none.
- Invariant couplings: fallback role mapping duplicates `dashboardFor` (`server.ts:L19-L25`); synchronization is manual.

---

**Open Questions:**
- unclear; need a complete localized route inventory to know whether other privileged path families require role-sensitive continuation handling.

