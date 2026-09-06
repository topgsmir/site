## `SellerService.listVendors` in apps/api/src/modules/seller/seller.service.ts (L19-L30)

**Purpose:** Fetches all sellers with owner, permissions, and aggregate counts, newest first, then maps them to shared `Vendor` values (L19-L30).

---

**Inputs & Assumptions:**
- No explicit inputs. Implicit persistent tables and Prisma relation correctness (`schema.prisma:L48-L114`, L149-L183).
- Authorization is a caller precondition; established for the only controller caller by guard (`seller.controller.ts:L35-L38`).

---

**Outputs & Effects:** Reads database rows and returns mapped array; no writes (L20-L29).

---

**Block-by-Block:**

```typescript
// L20-L29
const sellers = await this.prisma.sellers.findMany({ include: {...}, orderBy: { created_at: "desc" } });
return sellers.map((seller) => this.toVendor(seller));
```
- **What:** Eager-loads needed relations/counts and maps. **Why here:** one query supplies mapper inputs. **Assumes:** mapper accepts exact query shape; established by include/select fields and signature L184-L198. **Establishes:** output is descending by creation time. **Depended on by:** vendor list handler.

---

**Cross-Function Dependencies:**
- Prisma findMany (external-source-available), `toVendor` (internal) (L20-L29). Shared state: seller/user/permissions/product/order tables.

---

**Open Questions:**
- unclear; need pagination/ordering requirements for large datasets.

