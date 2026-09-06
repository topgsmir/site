## `SellerController.constructor` in apps/api/src/modules/seller/seller.controller.ts (L33)

**Purpose:** Captures the seller service used by persistent vendor routes (L33, L38-L64).

---

**Inputs & Assumptions:**
- `sellerService`: trusted Nest provider, registered by `SellerModule` (`seller.module.ts:L6-L10`).

---

**Outputs & Effects:** Stores a readonly reference; no I/O (L33).

---

**Block-by-Block:**

```typescript
// L33
constructor(private readonly sellerService: SellerService) {}
```
- **What:** Captures dependency. **Why here:** precedes handlers. **Assumes:** DI succeeds. **Establishes:** vendor handlers can call the service. **Depended on by:** L38, L47, L60.

---

**Cross-Function Dependencies:**
- Callees: none. Caller: Nest via module registration (`seller.module.ts:L8-L9`). Shared state: service reference.

---

**Open Questions:**
- No open questions.

