## `AuthService.login` in apps/api/src/modules/auth/auth.service.ts (L82-L105)

**Purpose:** Looks up an email-or-username identity, verifies its password, and returns a session containing current role/permissions (L82-L105).

---

**Inputs & Assumptions:**
- `input`: untrusted validated `LoginDto` (`login.dto.ts:L3-L12`, `main.ts:L18-L20).
- Implicit database user/seller/permission state (L84-L92). Precondition: identifiers containing `@` are emails and all others are usernames; established by this branch only (L84-L92), with product-level validity established by: nothing found.

---

**Outputs & Effects:** Reads user relations; returns signed session or throws one generic UnauthorizedException (L84-L104).

---

**Block-by-Block:**

```typescript
// L83-L104
const identifier = input.identifier.trim().toLowerCase();
const user = identifier.includes("@") ? await ...email... : await ...username...;
const passwordMatches = await this.verifyPassword(input.password, user?.password_hash ?? DUMMY_HASH);
if (!user || !user.password_hash || !passwordMatches) throw new UnauthorizedException(...);
return this.createSession(user);
```
- **What:** Canonicalizes lookup key, fetches relations, always runs verification, then signs. **Why here:** dummy hash keeps absent-user path within the password derivation flow. **Assumes:** stored hash follows service format; checked by `verifyPassword` (L255-L276). **Establishes:** returned session belongs to a current row whose password matched. **Depended on by:** controller login (`auth.controller.ts:L45-L47`).

---

**Cross-Function Dependencies:**
- Prisma `findUnique`, `verifyPassword`, `createSession` (L84-L104); uniqueness comes from schema (`schema.prisma:L51-L52`).
- Shared state: `users`, `sellers`, `seller_permissions` (`schema.prisma:L48-L95`).

---

**Open Questions:**
- unclear; need username provisioning path: registration writes no username (L61-L68).

