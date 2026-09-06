## `SellerService.toVendor` in apps/api/src/modules/seller/seller.service.ts (L184-L220)

**Purpose:** Maps Prisma seller/user/grants/counts into the shared API `Vendor` shape (L184-L220).

---

**Inputs & Assumptions:**
- `seller`: trusted query result with specified relations/counts (L184-L198).
- Precondition: decimal values convert acceptably to JavaScript numbers; bounds for stored legacy values are established by: nothing found, while new DTO writes constrain 0..1 (`vendor.dto.ts:L57-L67`, L108-L120).

---

**Outputs & Effects:** Returns a new Vendor with derived status, numeric decimals, ISO dates, and flattened permissions; no writes (L199-L219).

---

**Block-by-Block:**

```typescript
// L199-L219
const status = seller.suspended_at ? "suspended" : seller.approved ? "active" : "invited";
return { ..., commission: Number(...), holdbackRate: Number(...), permissions: ...map(...), createdAt: ...toISOString(), updatedAt: ...toISOString() };
```
- **What:** Derives and reshapes the public representation. **Why here:** one mapper keeps list/get responses aligned. **Assumes:** `suspended_at` takes precedence and unapproved/non-suspended means invited; encoded by `statusData` for current writes (L174-L181), legacy database combinations enforcement is nothing found. **Establishes:** shared `Vendor` field names/types. **Depended on by:** list/get (L29, L171).

---

**Cross-Function Dependencies:**
- Callees Number, Array.map, Date.toISOString. Callers list/get.
- Invariant coupling: inverse of `statusData`; schema stores flags rather than status enum (`schema.prisma:L68-L73`).

---

**Open Questions:**
- unclear; need interpretation for legacy rows with `invited=false`, `approved=false`, `suspended_at=null`.
