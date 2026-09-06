## `SellerController.createVendor` in apps/api/src/modules/seller/seller.controller.ts (L41-L51)

**Purpose:** Serves `POST /api/seller/vendors`, passing validated vendor data and the guarded administrator id to persistent creation (L41-L51).

---

**Inputs & Assumptions:**
- `body`: untrusted HTTP JSON constrained by `CreateVendorDto` and global pipe (`vendor.dto.ts:L29-L72`, `main.ts:L18-L20`).
- `request`: untrusted until guard; `authenticatedUser` is established by `PlatformAdminGuard` before handler execution (L42, `platform-admin.guard.ts:L30-L43`).

---

**Outputs & Effects:** Returns service promise; service inserts user, seller, permissions transactionally (L47-L50; `seller.service.ts:L38-L70`).

---

**Block-by-Block:**

```typescript
// L41-L50
@UseGuards(PlatformAdminGuard)
return this.sellerService.createVendor(body, request.authenticatedUser!.id);
```
- **What:** Couples validated body to current admin id. **Why here:** grant provenance is derived from guard output rather than body. **Assumes:** framework guard ran; established by decorator L42. **Establishes:** service receives a platform-admin database id. **Depended on by:** permission `granted_by_id` writes (`seller.service.ts:L58-L65`).

---

**Cross-Function Dependencies:**
- Callees guard, `SellerService.createVendor` (L42, L47-L50). Shared state: users/sellers/permissions.
- Invariant coupling: non-null assertion at L49 relies on guard assignment (`platform-admin.guard.ts:L42`).

---

**Open Questions:**
- No open questions.
