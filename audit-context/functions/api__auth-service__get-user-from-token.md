## `AuthService.getUserFromToken` in apps/api/src/modules/auth/auth.service.ts (L107-L127)

**Purpose:** Verifies a session token, resolves its subject against current persistent identity state, and maps it to `AppUser` (L107-L127).

---

**Inputs & Assumptions:**
- `token`: untrusted header/cookie-derived string or undefined (`auth.controller.ts:L52-L57`, `platform-admin.guard.ts:L23-L28`).
- Precondition: verified `sub` identifies a user; verified cryptographically by `verifyToken`, then existence enforced at L122-L124.

---

**Outputs & Effects:** Reads selected user, seller, and permission columns; returns `AppUser` or throws (L108-L126).

---

**Block-by-Block:**

```typescript
// L108-L126
const payload = this.verifyToken(token);
const user = await this.prisma.users.findUnique({ where: { id: payload.sub }, select: {...} });
if (!user) throw new UnauthorizedException(...);
return this.toPublicUser(user);
```
- **What:** Verifies before querying, then rejects deleted subjects and maps current data. **Why here:** database identity is not trusted solely from token claims. **Assumes:** first seller relation supplies the relevant permissions; ordering/uniqueness is established by `sellers.user_id @unique` (`schema.prisma:L66`). **Establishes:** result reflects current role and stored permissions. **Depended on by:** `/auth/me` and admin guard.

---

**Cross-Function Dependencies:**
- Callees `verifyToken`, Prisma `findUnique`, `toPublicUser` (L108-L126; L164-L240).
- Shared state: users/sellers/permissions, also modified by `SellerService` (`seller.service.ts:L38-L68`, L98-L147).

---

**Open Questions:**
- No open questions.

