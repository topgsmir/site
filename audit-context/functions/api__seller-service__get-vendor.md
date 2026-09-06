## `SellerService.getVendor` in apps/api/src/modules/seller/seller.service.ts (L161-L172)

**Purpose:** Fetches one seller with all fields needed for the shared vendor projection and rejects absence (L161-L172).

---

**Inputs & Assumptions:**
- `sellerId`: internal id returned from create or existing route id after earlier lookup (L70, L149).
- Precondition: related user exists; enforced by required Prisma relation/FK (`schema.prisma:L66`, L76).

---

**Outputs & Effects:** Reads seller/user/permissions/counts; returns mapped Vendor or throws NotFoundException (L162-L171).

---

**Block-by-Block:**

```typescript
// L162-L171
const seller = await this.prisma.sellers.findUnique({ where: { id: sellerId }, include: {...} });
if (!seller) throw new NotFoundException(...);
return this.toVendor(seller);
```
- **What:** Fetches, presence-checks, maps. **Why here:** mapper never receives null. **Assumes:** relation/count query shape matches mapper signature; established by L164-L168 and L184-L198. **Establishes:** returned vendor represents a row visible at query time. **Depended on by:** create/update responses.

---

**Cross-Function Dependencies:**
- Prisma findUnique and `toVendor`. Callers L70, L149. Shared state: seller relations/counts.

---

**Open Questions:**
- No open questions.

