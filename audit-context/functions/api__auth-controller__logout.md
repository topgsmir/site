## `AuthController.logout` in apps/api/src/modules/auth/auth.controller.ts (L59-L63)

**Purpose:** Implements `POST /api/auth/logout` by replacing the browser cookie with an empty, immediately expired value (L59-L63).

---

**Inputs & Assumptions:**
- `response`: semi-trusted framework response (L61).
- Implicit: client uses the `topgsm_session` cookie. Established by login/register cookie writes and the shared cookie-name constant (`auth.controller.ts:L34`, `L45`; `session-token.ts:L1`).

---

**Outputs & Effects:** Writes `Set-Cookie` and responds with HTTP 204 (L60-L62). It does not update database or server-side session state (L61-L63).

---

**Block-by-Block:**

```typescript
// L61-L63
logout(...) {
  response.setHeader("Set-Cookie", this.serializeCookie("", 0));
}
```
- **What:** Expires the cookie. **Why here:** it is the route's sole effect. **Assumes:** clearing the client cookie is sufficient to end the client session; server-side revocation state is established by: nothing found. **Establishes:** the response instructs the browser to expire the cookie. **Depended on by:** client logout behavior.

---

**Cross-Function Dependencies:**
- Callee `serializeCookie` (internal): applies the same path/domain/security attributes (`auth.controller.ts:L72-L86`).
- Callers: HTTP clients; no guard decorates logout (L59-L63).
- Shared state: no persistent writes (L61-L63).

---

**Open Questions:**
- unclear; need to inspect deployment cookie-domain behavior to confirm an emitted deletion cookie matches every cookie previously issued.
