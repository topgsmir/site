## `AuthService.sessionTtlSeconds` in apps/api/src/modules/auth/auth.service.ts (L129-L131)

**Purpose:** Exposes the fixed seven-day session lifetime for cookie construction (L24, L129-L131).

---

**Inputs & Assumptions:**
- No explicit inputs. Implicit constant `SESSION_TTL_SECONDS` is trusted source code (L24).

---

**Outputs & Effects:** Returns `604800`; no state changes (L24, L129-L131).

---

**Block-by-Block:**

```typescript
// L129-L131
get sessionTtlSeconds() { return SESSION_TTL_SECONDS; }
```
- **What:** Returns the signing lifetime constant. **Why here:** public getter avoids duplicating it in the controller. **Assumes:** cookie Max-Age units are seconds; established by HTTP cookie semantics outside this source. **Establishes:** callers use the same duration as `createSession` (L144). **Depended on by:** `AuthController.setSessionCookie` (`auth.controller.ts:L69`).

---

**Cross-Function Dependencies:**
- Callees: none. Caller: cookie helper (`auth.controller.ts:L69`). Shared state: none.

---

**Open Questions:**
- No open questions.

