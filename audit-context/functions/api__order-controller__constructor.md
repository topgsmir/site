## `OrderController.constructor` in apps/api/src/modules/order/order.controller.ts (L28-L31)

**Purpose:** Captures the realtime gateway and payout service used by order creation and status-update handlers (L28-L31, L47-L51, L66-L70).

---

**Inputs & Assumptions:**
- `realtime`: trusted Nest provider exported by `RealtimeModule` (`realtime.module.ts:L4-L7`).
- `payoutService`: trusted Nest provider exported by `PayoutModule` (`payout.module.ts:L5-L9`).

---

**Outputs & Effects:** Stores readonly dependency references; no external I/O (L28-L31).

---

**Block-by-Block:**

```typescript
// L28-L31
constructor(
  private readonly realtime: RealtimeGateway,
  private readonly payoutService: PayoutService
) {}
```
- **What:** Receives and stores two providers. **Why here:** construction precedes route execution. **Assumes:** `OrderModule` imports modules exporting both providers; established at `order.module.ts:L6-L9`. **Establishes:** handlers can call both dependencies. **Depended on by:** `create` and `updateStatus`.

---

**Cross-Function Dependencies:**
- Callees: none.
- Caller: Nest through `OrderModule` controller registration (`order.module.ts:L6-L9`).
- Shared state: references long-lived provider instances.

---

**Open Questions:**
- No open questions.

