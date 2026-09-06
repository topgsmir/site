## `readSessionToken` in apps/api/src/modules/auth/session-token.ts (L3-L16)

**Purpose:** Selects a bearer credential first, otherwise extracts the shared `topgsm_session` cookie value from raw request headers (L3-L16; L1).

---

**Inputs & Assumptions:**
- `cookieHeader` (`string | undefined`): untrusted HTTP Cookie header (L4).
- `authorization` (`string | undefined`): untrusted HTTP Authorization header (L5).
- Precondition: cookie syntax can be represented by semicolon-separated entries whose first equals-delimited field is the name; established by: nothing found (L10-L15).

---

**Outputs & Effects:** Returns a non-whitespace bearer token, a matching cookie value, or `undefined`; it performs no state changes (L7-L15).

---

**Block-by-Block:**

```typescript
// L7-L8
const bearer = authorization?.match(/^Bearer\s+([^\s]+)$/i)?.[1];
if (bearer) return bearer;
```
- **What:** Recognizes one non-whitespace bearer token and returns it immediately.
- **Why here:** Authorization takes precedence over cookie scanning.
- **Assumes:** the runtime has already represented the request's Authorization field as one string; established by the typed caller inputs, while duplicate-header normalization is established by: nothing found (L4-L5).
- **Establishes:** a matching bearer credential is the function's selected token (L7-L8).
- **Depended on by:** controller and guard authentication calls (`auth.controller.ts:L54-L56`, `platform-admin.guard.ts:L32-L36`).

```typescript
// L10-L15
return cookieHeader
  ?.split(";")
  .map((cookie) => cookie.trim().split("="))
  .find(([name]) => name === SESSION_COOKIE)
  ?.slice(1)
  .join("=");
```
- **What:** Splits cookie entries, selects the shared cookie name, and rejoins the remaining fields so equals signs in its value are preserved.
- **Why here:** this is the fallback when no matching bearer value was returned (L7-L10).
- **Assumes:** semicolon and equals splitting matches the received cookie grammar; established by: nothing found (L10-L15).
- **Establishes:** the first matching `topgsm_session` cookie value, or `undefined`, becomes the selected token (L1, L10-L15).
- **Depended on by:** the same controller and guard authentication calls (`auth.controller.ts:L54-L56`, `platform-admin.guard.ts:L32-L36`).

---

**Cross-Function Dependencies:**
- Callees: JavaScript regular-expression and string/array operations (external-source-available runtime) (L7-L15).
- Callers: `AuthController.me` and `PlatformAdminGuard.canActivate` (`auth.controller.ts:L54-L56`, `platform-admin.guard.ts:L32-L36`).
- Shared state: none; both callers share the exported `SESSION_COOKIE` name defined at L1.
- Invariant couplings: both authentication entry paths now use the same bearer precedence and cookie parser (L3-L16).

---

**Open Questions:**
- unclear; need upstream HTTP-adapter/proxy normalization behavior for duplicate Authorization or Cookie headers.
