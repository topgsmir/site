## `PrismaService.onModuleInit` in apps/api/src/prisma/prisma.service.ts (L9-L11)

**Purpose:** Opens the Prisma client's database connection during Nest module initialization (L9-L11).

---

**Inputs & Assumptions:**
- Implicit: Prisma client configuration generated from `schema.prisma`, whose datasource reads `DATABASE_URL` (`schema.prisma:L1-L9`). Trust: semi-trusted deployment configuration.
- Precondition: the configured database is reachable and compatible with the generated client; delegated to Prisma `$connect` at L10.

---

**Outputs & Effects:** Awaits a database connection; returns `Promise<void>` on success and propagates connection rejection (L9-L11).

---

**Block-by-Block:**

```typescript
// L9-L11
async onModuleInit() {
  await this.$connect();
}
```
- **What:** Connects the inherited Prisma client. **Why here:** Nest calls the lifecycle hook after provider construction and before normal service use. **Assumes:** `$connect` fully establishes a usable pool on resolution; Prisma contract. **Establishes:** subsequent injected `PrismaService` calls have completed the explicit connection attempt. **Depended on by:** `AuthService` and `SellerService`, which inject this global provider (`auth.service.ts:L46-L50`, `seller.service.ts:L13-L17`).

---

**Cross-Function Dependencies:**
- Callee `$connect` (external-source-unavailable here): inherited from `PrismaClient` (L5-L7).
- Caller: Nest lifecycle, because the class implements `OnModuleInit` (L5-L9) and is registered globally (`prisma.module.ts:L4-L8`).
- Shared state: Prisma connection pool/client state shared by all consumers of the global provider.

---

**Open Questions:**
- unclear; need runtime deployment settings to know pool sizing, timeout, and retry behavior.

