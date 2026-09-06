## `AuthService.constructor` in apps/api/src/modules/auth/auth.service.ts (L47-L50)

**Purpose:** Captures Prisma and configuration dependencies for identity persistence and token signing (L47-L50).

---

**Inputs & Assumptions:**
- `prisma`, `config`: trusted Nest providers (L47-L50); registration is established by global `PrismaModule` and `ConfigModule` (`app.module.ts:L14-L19`, `prisma.module.ts:L4-L8`).

---

**Outputs & Effects:** Stores readonly references; no I/O (L47-L50).

---

**Block-by-Block:**

```typescript
// L47-L50
constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {}
```
- **What:** Captures dependencies. **Why here:** all service operations follow construction. **Assumes:** DI tokens resolve. **Establishes:** access to database and environment config. **Depended on by:** database methods L61-L120 and secret lookup L206-L217.

---

**Cross-Function Dependencies:**
- Callees: none (L47-L50). Callers: Nest via `AuthModule` (`auth.module.ts:L6-L9`).
- Shared state: one Prisma client and process configuration are shared across service calls (`prisma.module.ts:L4-L8`).

---

**Open Questions:**
- No open questions.

