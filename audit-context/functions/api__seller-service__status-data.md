## `SellerService.statusData` in apps/api/src/modules/seller/seller.service.ts (L174-L182)

**Purpose:** Converts the shared vendor status into the three persisted invitation/approval/suspension fields (L174-L182).

---

**Inputs & Assumptions:**
- `status`: validated/shared `VendorStatus` (`vendor.dto.ts:L24-L27`, L54-L55, L104-L106; shared types L38).
- Implicit clock for suspension timestamp (L179). Clock quality established by: nothing found.

---

**Outputs & Effects:** Returns a field patch; creates Date only for suspended status (L175-L181).

---

**Block-by-Block:**

```typescript
// L175-L181
if (status === "invited") return { invited: true, approved: false, suspended_at: null };
if (status === "suspended") return { invited: false, approved: false, suspended_at: new Date() };
return { invited: false, approved: true, suspended_at: null };
```
- **What:** Maps three logical states to stored flags/timestamp. **Why here:** centralizes create/update encoding. **Assumes:** any non-invited/non-suspended union value means active; TypeScript/DTO establish current callers. **Establishes:** known status combinations. **Depended on by:** create/update (L35, L129).

---

**Cross-Function Dependencies:**
- Callee Date constructor. Callers create/update. Coupled inverse mapping in `toVendor` (L199-L203).

---

**Open Questions:**
- unclear; need policy on preserving original suspension timestamp when repeatedly setting suspended.

