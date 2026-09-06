## `PayoutController.setStatus` in apps/api/src/modules/payout/payout.controller.ts (L34-L37)

**Purpose:** Implements `PATCH /api/payouts/requests/:id` by assigning a supplied payout status to a matching ledger row (L15, L34-L37; `main.ts:L21`).

---

**Inputs & Assumptions:**
- `id` (`string`): untrusted path parameter (L35).
- `body` (`ApproveOrSettleDto` type alias): untrusted HTTP JSON with a compile-time `PayoutStatus` field (L11-L13, L35).
- Preconditions: status is a runtime member of the shared union, its transition is permitted, and caller may perform it; no runtime DTO decorators, state-transition check, or route guard establishes these; nothing found (L11-L13, L15-L37).

---

**Outputs & Effects:** Returns a message object when the id is absent; otherwise overwrites the row's status and returns the same row (L36; `payout.service.ts:L83-L90`).

---

**Block-by-Block:**

```typescript
// L34-L37
@Patch("requests/:id")
setStatus(@Param("id") id: string, @Body() body: ApproveOrSettleDto) {
  return this.payoutService.setStatus(id, body.status);
}
```
- **What:** Delegates lookup and status assignment. **Why here:** the controller performs no intermediate work. **Assumes:** `setStatus` embodies all required status policy; it performs an id lookup and direct assignment only (`payout.service.ts:L84-L89`). **Establishes:** response mirrors service outcome. **Depended on by:** HTTP status-management clients.

---

**Cross-Function Dependencies:**
- Callee `PayoutService.setStatus` (internal, `payout.service.ts:L83-L90`): direct status overwrite after lookup.
- Callers: HTTP clients through `PayoutModule` (`payout.module.ts:L5-L9`).
- Shared state: may mutate `ledger` status also written by `updateFromOrderStatus` and `request` (`payout.service.ts:L42-L57`, L67-L81).
- Invariant coupling: multiple functions can assign payout status without consulting one another; their ordering determines the stored value.

---

**Open Questions:**
- unclear; need caller role and allowed payout state-transition policy.

