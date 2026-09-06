## `SellerService.createVendor` in apps/api/src/modules/seller/seller.service.ts (L32-L80)

**Purpose:** Creates a seller-admin user, seller profile, and permission grants atomically, then returns the full vendor projection (L32-L80).

---

**Inputs & Assumptions:**
- `input`: untrusted but DTO-validated/guarded controller input (`seller.controller.ts:L41-L50`, `vendor.dto.ts:L29-L72`).
- `adminUserId`: trusted guard-derived current platform-admin id (`seller.controller.ts:L45-L50`). Database existence is enforced when permissions are inserted by FK (`schema.prisma:L88-L94`); when permission list is empty, existence enforcement is nothing found (L58-L66).

---

**Outputs & Effects:** Transactionally inserts user/seller/optional permissions, then reads projection; maps P2002 to ConflictException (L37-L79).

---

**Block-by-Block:**

```typescript
// L33-L68
const email = ...; const passwordHash = await ...; const status = this.statusData(...);
const sellerId = await this.prisma.$transaction(async (transaction) => {
  const user = await transaction.users.create(...);
  const seller = await transaction.sellers.create(...);
  if (input.permissions.length) await transaction.seller_permissions.createMany(...adminUserId...);
  return seller.id;
});
```
- **What:** Prepares values and performs coupled inserts atomically. **Why here:** user id feeds seller; seller id feeds grants. **Assumes:** transaction rollback covers every thrown path; Prisma contract. **Establishes:** successful transaction has linked user/seller and requested unique grants. **Depended on by:** `getVendor` at L70.

---

**Cross-Function Dependencies:**
- Callees AuthService hash, `statusData`, Prisma transaction/create/createMany, `getVendor` (L34-L70). Schema FKs/unique keys at `schema.prisma:L52`, L66, L90-L94.
- Shared state: users/sellers/seller_permissions.

---

**Open Questions:**
- unclear; need policy for whether empty grants still require recording/verifying the acting admin.

