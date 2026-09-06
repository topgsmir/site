## `AuthController.constructor` in apps/api/src/modules/auth/auth.controller.ts (L23-L26)

**Purpose:** Receives the authentication and configuration services used by every handler and cookie helper in this controller (L23-L26).

---

**Inputs & Assumptions:**
- `authService` / `config` (Nest providers): trusted dependency-injection inputs (L23-L26). Precondition: Nest resolves both registered providers; established by `AuthModule` and global `ConfigModule` (`apps/api/src/modules/auth/auth.module.ts:L6-L9`, `apps/api/src/app.module.ts:L14-L19`).

---

**Outputs & Effects:** Stores both references as readonly instance fields (L23-L26); no I/O.

---

**Block-by-Block:**

```typescript
// L23-L26
constructor(
  private readonly authService: AuthService,
  private readonly config: ConfigService
) {}
```
- **What:** Captures dependencies. **Why here:** precedes all instance calls. **Assumes:** provider tokens resolve. **Establishes:** helpers and handlers can call both services. **Depended on by:** L34-L35, L45-L46, L55-L56, L69, L81-L84.

---

**Cross-Function Dependencies:**
- Callees: no runtime callees in the body (L23-L26).
- Callers: Nest constructs the controller because `AuthModule` registers it (`auth.module.ts:L6-L8`).
- Shared state / invariant couplings: the same injected `AuthService` and `ConfigService` are reused by all controller methods (L23-L26).

---

**Open Questions:**
- No open questions.
