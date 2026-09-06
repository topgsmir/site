## `AuthService.toPublicUser` in apps/api/src/modules/auth/auth.service.ts (L228-L240)

**Purpose:** Maps Prisma-shaped identity data to the shared `AppUser` contract and optional flat permissions (L228-L240; `shared-types/src/index.ts:L23-L29`).

---

**Inputs & Assumptions:**
- `user`: trusted stored-user projection (L228-L234).
- Precondition: underscore database roles map exactly to hyphenated shared roles; established by enum sets (`schema.prisma:L10-L15`, `shared-types/src/index.ts:L17-L21`).

---

**Outputs & Effects:** Returns a new public object; no persistence (L229-L239).

---

**Block-by-Block:**

```typescript
// L229-L239
const publicUser = { id, fullName, email, role: user.role.replaceAll("_", "-") as Role };
const permissions = user.sellers?.[0]?.permissions.map(...);
if (permissions) publicUser.permissions = permissions;
return publicUser;
```
- **What:** Renames fields, converts role spelling, projects first seller permissions. **Why here:** central mapping serves issuance and current-user lookup. **Assumes:** at most one seller per user; enforced by `sellers.user_id @unique` (`schema.prisma:L66`). **Establishes:** returned object matches shared field names and permission literals. **Depended on by:** `createSession`, `getUserFromToken` (L149, L126).

---

**Cross-Function Dependencies:**
- Callees: string/array methods (L233-L237). Callers listed above.
- Shared state coupling: schema enum and shared union must remain aligned (`schema.prisma:L10-L15`, shared types L17-L21).

---

**Open Questions:**
- No open questions.

