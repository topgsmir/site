## `AuthController.login` in apps/api/src/modules/auth/auth.controller.ts (L38-L47)

**Purpose:** Implements `POST /api/auth/login`, obtains a session for valid credentials, sets its cookie, and returns the public user (L38-L47; `main.ts:L21`).

---

**Inputs & Assumptions:**
- `body` (`LoginDto`): untrusted HTTP JSON, constrained by decorators under the global validation pipe (`login.dto.ts:L3-L12`, `main.ts:L18-L20).
- `response`: semi-trusted framework response (L42). Precondition: successful authentication returns a token/user pair; established by `AuthService.login` (`auth.service.ts:L82-L105`).

---

**Outputs & Effects:** Writes `Set-Cookie`, returns `{user}`, and declares HTTP 200 (L39-L46).

---

**Block-by-Block:**

```typescript
// L44-L46
const session = await this.authService.login(body);
this.setSessionCookie(response, session.token);
return { user: session.user };
```
- **What:** Authenticates then exposes the session. **Why here:** no cookie is written on a thrown authentication path. **Assumes:** the token came from `createSession`; established at `auth.service.ts:L104`. **Establishes:** response cookie and body agree on the authenticated user. **Depended on by:** the client session flow.

---

**Cross-Function Dependencies:**
- Callees `AuthService.login` and `setSessionCookie` (internal): credential/database checks at `auth.service.ts:L82-L105`; cookie construction at L65-L70 here.
- Callers: anonymous HTTP clients; no route guard (L38-L47).
- Shared state: reads `users`, `sellers`, and `seller_permissions` (`auth.service.ts:L84-L96`).

---

**Open Questions:**
- No open questions.
