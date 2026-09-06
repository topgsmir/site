## `AuthService.getTokenSecret` in apps/api/src/modules/auth/auth.service.ts (L206-L218)

**Purpose:** Loads the signing secret and enforces presence everywhere plus minimum production conditions (L206-L218).

---

**Inputs & Assumptions:**
- Implicit `JWT_SECRET`, `NODE_ENV` from ConfigService (L207-L213), sourced by `ConfigModule.forRoot` (`app.module.ts:L14-L17`).
- Precondition: environment name accurately identifies production; established by: nothing found.

---

**Outputs & Effects:** Returns secret or throws an Error (L207-L217); reads process configuration.

---

**Block-by-Block:**

```typescript
// L207-L217
const secret = this.config.get<string>("JWT_SECRET");
if (!secret) throw new Error(...);
if (this.config.get("NODE_ENV") === "production" && (secret.length < 32 || secret === "replace-with-secret")) throw new Error(...);
return secret;
```
- **What:** Applies universal presence and production-only value checks. **Why here:** both sign and verify share the same gate. **Assumes:** non-production secrets may be shorter/default by policy; established by this condition only. **Establishes:** returned production secret is at least 32 characters and not the named placeholder. **Depended on by:** signing/verifying (L157, L174).

---

**Cross-Function Dependencies:**
- Callee ConfigService.get (framework) (L207-L213). Callers `signToken`, `verifyToken`.
- Shared state: environment configuration.

---

**Open Questions:**
- unclear; need deployment configuration/secret lifecycle records.

