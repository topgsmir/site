## `AuthController.me` in apps/api/src/modules/auth/auth.controller.ts (L49-L57)

**Purpose:** Implements `GET /api/auth/me` and resolves the current database-backed public user from a bearer token or session cookie (L49-L57; `main.ts:L21`).

---

**Inputs & Assumptions:**
- `cookieHeader` / `authorization`: untrusted HTTP headers (L51-L52).
- Precondition: a parseable, valid token identifies an existing user; parsing is delegated at L55 and verification/database lookup at L54 (`auth.service.ts:L107-L127`).

---

**Outputs & Effects:** Returns a promise for `AppUser`; reads persistent user and permission state through the service (L54-L56; `auth.service.ts:L109-L120`).

---

**Block-by-Block:**

```typescript
// L54-L56
return this.authService.getUserFromToken(
  readSessionToken(cookieHeader, authorization)
);
```
- **What:** Parses credentials then resolves the user. **Why here:** token extraction precedes cryptographic and database checks. **Assumes:** header parsing selects the intended credential; established by `readSessionToken` precedence (`session-token.ts:L7-L15`). **Establishes:** on success, result reflects current database role/permissions (`auth.service.ts:L109-L126`). **Depended on by:** the client identity bootstrap.

---

**Cross-Function Dependencies:**
- Callees `readSessionToken` and `AuthService.getUserFromToken` (internal) (`session-token.ts:L3-L16`, `auth.service.ts:L107-L127`).
- Callers: HTTP clients; no Nest guard decorates this route (L49-L57), while the service itself rejects invalid credentials (`auth.service.ts:L108`, L122-L124).
- Shared state: `users`, related sellers, permissions (`auth.service.ts:L109-L120`).

---

**Open Questions:**
- No open questions.
