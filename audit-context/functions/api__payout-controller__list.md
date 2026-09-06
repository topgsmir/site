## `PayoutController.list` in apps/api/src/modules/payout/payout.controller.ts (L19-L22)

**Purpose:** Implements `GET /api/payouts` by returning every process-local ledger row through `PayoutService.listAll` (L15, L19-L22; `main.ts:L21`).

---

**Inputs & Assumptions:**
- No explicit parameters. Implicit input: the service's module-level `ledger` (`payout.service.ts:L16`, L59-L61).
- Precondition: all ledger rows are visible to any caller reaching this route; no guard or caller-derived filter is declared, so establishment is nothing found (L15-L22; `app.module.ts:L12-L27`).

---

**Outputs & Effects:** Returns the service's ledger array reference for framework serialization; no direct mutation (L21; `payout.service.ts:L59-L61`).

---

**Block-by-Block:**

```typescript
// L19-L22
@Get()
list() {
  return this.payoutService.listAll();
}
```
- **What:** Delegates collection retrieval. **Why here:** there is no controller-side transformation. **Assumes:** service-wide collection scope is the intended response scope; nothing found establishes per-caller scope. **Establishes:** response value is exactly what `listAll` returns. **Depended on by:** HTTP consumers; none found in repository source.

---

**Cross-Function Dependencies:**
- Callee `PayoutService.listAll` (internal, `payout.service.ts:L59-L61`): returns the actual module-level array without copying or filtering.
- Callers: HTTP clients via `PayoutModule` (`payout.module.ts:L5-L9`).
- Shared state: reads all `ledger` entries created/mutated by payout service methods.

---

**Open Questions:**
- unclear; need payout visibility/tenancy policy.

