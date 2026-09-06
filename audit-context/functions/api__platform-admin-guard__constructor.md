## `PlatformAdminGuard.constructor` in apps/api/src/modules/auth/platform-admin.guard.ts (L28)

**Purpose:** Captures the authentication service used to resolve and authorize every guarded request (L28).

---

**Inputs & Assumptions:**
- `authService`: trusted Nest provider (L28). Provider registration is established by `AuthModule` (`auth.module.ts:L6-L9`).

---

**Outputs & Effects:** Stores a readonly dependency; no I/O (L28).

---

**Block-by-Block:**

```typescript
// L28
constructor(private readonly authService: AuthService) {}
```
- **What:** Captures the service. **Why here:** construction precedes guard use. **Assumes:** Nest DI resolves it. **Establishes:** `canActivate` can validate users. **Depended on by:** L36.

---

**Cross-Function Dependencies:**
- Callees: none in the body (L28).
- Callers: Nest creates the guard registered by `AuthModule` (auth.module.ts:L8-L9).
- Shared state: service reference only.

---

**Open Questions:**
- No open questions.
