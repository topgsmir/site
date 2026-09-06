## `AuthService.createSession` in apps/api/src/modules/auth/auth.service.ts (L137-L151)

**Purpose:** Creates issued/expiry claims, signs them, and pairs the token with a public-user projection (L137-L150).

---

**Inputs & Assumptions:**
- `user`: trusted database-created/fetched `StoredUser` from register/login (L70, L104).
- Implicit wall clock from `Date.now()` (L138). Precondition: system clock is suitable for expiry calculation; established by: nothing found.

---

**Outputs & Effects:** Returns `{token,user}`; reads time/config via `signToken`; no database writes (L138-L150).

---

**Block-by-Block:**

```typescript
// L138-L150
const now = Math.floor(Date.now() / 1000);
const payload = { sub: user.id, email: user.email, role: user.role, iat: now, exp: now + SESSION_TTL_SECONDS };
return { token: this.signToken(payload), user: this.toPublicUser(user) };
```
- **What:** Builds temporal/identity claims and two representations. **Why here:** both derive from the same user and timestamp. **Assumes:** user fields are current at issuance; established by immediate caller queries/inserts. **Establishes:** `exp-iat` equals fixed TTL. **Depended on by:** register/login.

---

**Cross-Function Dependencies:**
- Callees `signToken`, `toPublicUser` (L148-L149; L153-L240). Callers L70, L104.
- Invariant coupling: token role/email are snapshots, while authorization later re-queries current role (`getUserFromToken`, L109-L126).

---

**Open Questions:**
- unclear; need deployment clock synchronization guarantees.

