## `dashboardFor` in apps/web/src/lib/auth/server.ts (L19-L25)

**Purpose:** Maps an authenticated user's role to the locale-specific landing page used after an authorization mismatch (L19-L24).

---

**Inputs & Assumptions:**
- `user` (`AppUser`): API-derived user object. Trust: semi-trusted until returned by `/auth/me`; `requireUser` obtains it at L44.
- `locale` (`Locale`): validated by page callers before `requireUser` (admin page L23-L29; seller page L22-L28).
- Precondition: `user.role` belongs to the local role union (L5-L12). Established by: TypeScript only at the JSON cast (L44); runtime API conversion maps database roles (`apps/api/src/modules/auth/auth.service.ts:L228-L239`).

---

**Outputs & Effects:**
- Returns admin, seller-dashboard, or locale-home path according to role (L20-L24).
- No state writes or external interactions.

---

**Block-by-Block:**

```ts
// L20-L24
if (user.role === "platform-admin") return `/${locale}/admin`;
if (user.role === "seller-admin" || user.role === "seller-staff") return `/${locale}/seller-dashboard`;
return `/${locale}`;
```
- **What:** Partitions roles into platform admin, seller roles, and buyer/default.
- **Why here:** `requireUser` needs a safe destination after it rejects a page role (L45-L46).
- **Assumes:** an unknown runtime role may use the home fallback. Established by this final return (L24).
- **Establishes:** returned paths stay within the supplied locale.
- **Depended on by:** `requireUser` forbidden-role redirect (L45-L46).

---

**Cross-Function Dependencies:**
- No callees beyond comparisons and template construction.
- Callers: `requireUser` (L46).
- Shared state: none.
- Invariant couplings: role spelling is coupled to the API's underscore-to-hyphen conversion (`apps/api/src/modules/auth/auth.service.ts:L228-L239`).

---

**Open Questions:**
- No open questions.

