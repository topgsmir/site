## `SellerService.constructor` in apps/api/src/modules/seller/seller.service.ts (L14-L17)

**Purpose:** Captures database and password-hashing services for vendor management (L14-L17).

---

**Inputs & Assumptions:**
- `prisma`, `authService`: trusted Nest providers, established by `PrismaModule` global export and `SellerModule` importing `AuthModule` (`prisma.module.ts:L4-L8`, `seller.module.ts:L6-L9`).

---

**Outputs & Effects:** Stores readonly references; no I/O.

---

**Block-by-Block:**

```typescript
// L14-L17
constructor(private readonly prisma: PrismaService, private readonly authService: AuthService) {}
```
- **What:** Captures dependencies. **Why here:** precedes service operations. **Assumes:** Nest DI resolves both. **Establishes:** database/hash access. **Depended on by:** L20-L171.

---

**Cross-Function Dependencies:**
- Callees: none. Caller: Nest module registration (`seller.module.ts:L9`). Shared state: Prisma client.

---

**Open Questions:**
- No open questions.

