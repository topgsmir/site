## `SellerController.listVendors` in apps/api/src/modules/seller/seller.controller.ts (L35-L39)

**Purpose:** Serves `GET /api/seller/vendors` for platform administrators (L35-L39; `main.ts:L21`).

---

**Inputs & Assumptions:**
- Implicit HTTP identity. Trust: untrusted until `PlatformAdminGuard`; guard attachment at L36 establishes current platform-admin role (`platform-admin.guard.ts:L30-L43`).

---

**Outputs & Effects:** Returns database-backed vendor projections; read-only at handler level (L38; `seller.service.ts:L19-L30`).

---

**Block-by-Block:**

```typescript
// L35-L38
@Get("vendors")
@UseGuards(PlatformAdminGuard)
listVendors() { return this.sellerService.listVendors(); }
```
- **What:** Guards then delegates. **Why here:** framework executes guard before handler. **Assumes:** Nest honors route guard metadata; established by framework registration at `seller.module.ts:L6-L9`. **Establishes:** only guard-approved requests reach the service through this route. **Depended on by:** admin vendor UI.

---

**Cross-Function Dependencies:**
- Callees guard and `SellerService.listVendors` (L36-L38). Caller: HTTP route. Shared state: sellers/users/permissions/counts (`seller.service.ts:L20-L29`).

---

**Open Questions:**
- No open questions.
