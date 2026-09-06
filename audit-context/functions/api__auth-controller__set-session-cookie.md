## `AuthController.setSessionCookie` in apps/api/src/modules/auth/auth.controller.ts (L65-L70)

**Purpose:** Converts a session token into the controller's `Set-Cookie` header using the service TTL (L65-L70).

---

**Inputs & Assumptions:**
- `response`: semi-trusted response object; `token`: trusted output from `AuthService` callers (L65-L69).
- Precondition: token is safe as a cookie value. Established by base64url JWT construction (`auth.service.ts:L153-L162`).

---

**Outputs & Effects:** Writes one response header; no return value (L66-L69).

---

**Block-by-Block:**

```typescript
// L66-L69
response.setHeader("Set-Cookie", this.serializeCookie(token, this.authService.sessionTtlSeconds));
```
- **What:** Serializes and sets the cookie. **Why here:** centralizes register/login behavior. **Assumes:** TTL and token expiry use the same constant; established by `sessionTtlSeconds` and `createSession` (`auth.service.ts:L129-L144`). **Establishes:** cookie max age matches token lifetime in seconds. **Depended on by:** `register` and `login` (L35, L46).

---

**Cross-Function Dependencies:**
- Callees `serializeCookie` and `AuthService.sessionTtlSeconds` (internal) (L69; `auth.service.ts:L129-L131`).
- Callers: `register`, `login` (L34, L45).
- Shared state: response headers only (L66-L69).

---

**Open Questions:**
- No open questions.
