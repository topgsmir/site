## `AuthController.register` in apps/api/src/modules/auth/auth.controller.ts (L28-L36)

**Purpose:** Implements `POST /api/auth/register`, delegates account creation, sets a session cookie, and returns the public user (L28-L36; `main.ts:L21`).

---

**Inputs & Assumptions:**
- `body` (`RegisterDto`): untrusted HTTP JSON; DTO constraints are applied by the global `ValidationPipe` (`main.ts:L18-L20`, `register.dto.ts:L3-L16).
- `response`: semi-trusted framework response (L31). Precondition: `AuthService.register` returns a signed token and public user; established on its success path (`auth.service.ts:L52-L80`).

---

**Outputs & Effects:** Creates a database user via the service, writes `Set-Cookie`, and returns `{user}` (L33-L35).

---

**Block-by-Block:**

```typescript
// L33-L35
const session = await this.authService.register(body);
this.setSessionCookie(response, session.token);
return { user: session.user };
```
- **What:** Creates and publishes the session. **Why here:** cookie emission occurs only after account creation succeeds. **Assumes:** service output matches the session shape; established by `createSession` (`auth.service.ts:L137-L150`). **Establishes:** successful response carries a cookie and public user. **Depended on by:** the HTTP client.

---

**Cross-Function Dependencies:**
- Callee `AuthService.register` (internal): normalizes, hashes, creates the user, then creates the session (`auth.service.ts:L52-L80`).
- Callee `setSessionCookie` (internal): serializes cookie attributes (`auth.controller.ts:L65-L70`).
- Callers: anonymous HTTP clients can reach the route; no guard decorates it (L28-L36).
- Shared state: `users` table through Prisma (`auth.service.ts:L61-L68`).

---

**Open Questions:**
- No open questions.
