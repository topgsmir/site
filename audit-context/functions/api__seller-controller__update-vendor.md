## `SellerController.updateVendor` in apps/api/src/modules/seller/seller.controller.ts (L53-L65)

**Purpose:** Serves `PATCH /api/seller/vendors/:id`, applying a validated partial update with administrator provenance (L53-L65).

---

**Inputs & Assumptions:**
- `id`: untrusted path string; existence enforced by service lookup (`seller.service.ts:L87-L91`).
- `body`: untrusted JSON constrained by `UpdateVendorDto` and global pipe (`vendor.dto.ts:L75-L126`, `main.ts:L18-L20`).
- `authenticatedUser`: established by route guard (L54; `platform-admin.guard.ts:L30-L43`).

---

**Outputs & Effects:** Returns service promise; updates persistent user/seller/permission state transactionally (L60-L64; `seller.service.ts:L98-L149`).

---

**Block-by-Block:**

```typescript
// L53-L64
@UseGuards(PlatformAdminGuard)
return this.sellerService.updateVendor(id, body, request.authenticatedUser!.id);
```
- **What:** Delegates identity, patch, and grantor id. **Why here:** guard output supplies provenance. **Assumes:** guard metadata executes before handler; established by Nest route decorator L54. **Establishes:** service call is administrator-attributed. **Depended on by:** permission replacement writes.

---

**Cross-Function Dependencies:**
- Callees guard and `SellerService.updateVendor`. Shared state: users/sellers/permissions (`seller.service.ts:L87-L149`).

---

**Open Questions:**
- No open questions.
