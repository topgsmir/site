## `PayoutController.constructor` in apps/api/src/modules/payout/payout.controller.ts (L17)

**Purpose:** Captures the payout service used by all payout HTTP handlers (L17, L21-L36).

---

**Inputs & Assumptions:**
- `payoutService`: trusted Nest provider registered by `PayoutModule` (`payout.module.ts:L5-L9`).

---

**Outputs & Effects:** Stores a readonly service reference; no I/O (L17).

---

**Block-by-Block:**

```typescript
// L17
constructor(private readonly payoutService: PayoutService) {}
```
- **What:** Receives and stores the service. **Why here:** construction precedes route execution. **Assumes:** Nest resolves the registered provider. **Establishes:** all handlers can delegate to one service instance. **Depended on by:** L21, L26, L31, and L36.

---

**Cross-Function Dependencies:**
- No callees.
- Caller: Nest via `PayoutModule` controller registration (`payout.module.ts:L5-L9`).
- Shared state: reference to the service that accesses module-level `ledger` (`payout.service.ts:L16-L19`).

---

**Open Questions:**
- No open questions.

