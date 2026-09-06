## `PrismaService.onModuleDestroy` in apps/api/src/prisma/prisma.service.ts (L13-L15)

**Purpose:** Disconnects the inherited Prisma client when Nest destroys the module (L13-L15).

---

**Inputs & Assumptions:**
- Implicit: the Prisma client's current connection/pool state (L5-L7).
- Precondition: Nest runs module-destroy hooks during the process termination paths of interest; established by framework lifecycle behavior, with no explicit shutdown-hook registration found in `bootstrap` (main.ts:L6-L23).

---

**Outputs & Effects:** Awaits `$disconnect`, releasing Prisma-managed database resources on paths where the hook is invoked; propagates rejection (L13-L15).

---

**Block-by-Block:**

```typescript
// L13-L15
async onModuleDestroy() {
  await this.$disconnect();
}
```
- **What:** Closes Prisma's database connections. **Why here:** it is the service's destruction hook. **Assumes:** no consumer starts new database work after module destruction begins; established by Nest lifecycle ordering, not local code. **Establishes:** `$disconnect` has resolved before this hook resolves. **Depended on by:** orderly application teardown.

---

**Cross-Function Dependencies:**
- Callee `$disconnect` (external-source-unavailable here): inherited from `PrismaClient` (L5-L7).
- Caller: Nest lifecycle when it destroys `PrismaService`; the provider is registered by `PrismaModule` (`prisma.module.ts:L4-L8`).
- Shared state: the same Prisma client/pool used by auth and seller services.

---

**Open Questions:**
- unclear; need runtime/framework configuration to determine which OS-signal shutdown paths invoke this hook.

