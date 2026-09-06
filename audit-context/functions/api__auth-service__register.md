## `AuthService.register` in apps/api/src/modules/auth/auth.service.ts (L52-L80)

**Purpose:** Normalizes registration data, hashes the password, creates a buyer row, and returns a signed session (L52-L80).

---

**Inputs & Assumptions:**
- `input`: untrusted DTO from `POST /auth/register`; field lengths/types/email form are established by decorators and the global pipe (`register.dto.ts:L3-L16`, `main.ts:L18-L20`).
- Precondition: normalized email uniqueness; enforced by database unique constraint (`schema.prisma:L52`) and mapped P2002 handling (L71-L77).

---

**Outputs & Effects:** Inserts one `users` row and returns token/public user; throws for short trimmed name, duplicate identity, hash/config/database failures (L55-L78).

---

**Block-by-Block:**

```typescript
// L53-L70
const email = this.normalizeEmail(input.email);
const fullName = input.fullName.trim();
if (fullName.length < 2) throw new BadRequestException(...);
const passwordHash = await this.createPasswordHash(input.password);
const user = await this.prisma.users.create({ data: { ..., role: "buyer" } });
return this.createSession(user);
```
- **What:** Canonicalizes, rechecks trimmed name, hashes, persists, then signs. **Why here:** irreversible insert follows validation/hash; session follows successful insert. **Assumes:** Prisma returns the created stored-user fields; established by Prisma create at L61-L68. **Establishes:** persisted buyer with hash and session tied to its id. **Depended on by:** controller register (`auth.controller.ts:L34-L36`).

---

**Cross-Function Dependencies:**
- Callees `normalizeEmail`, `createPasswordHash`, Prisma `users.create`, `createSession` (internal/external-source-available) (L53-L70); all paths inspected at L224-L296 and schema L48-L62.
- Shared state: `users`; uniqueness coupled to login lookup (`schema.prisma:L51-L52`, L82-L104 here).

---

**Open Questions:**
- unclear; need product policy for whether email canonicalization beyond trim/lowercase is required.

