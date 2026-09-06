## `PayoutService.get` in apps/api/src/modules/payout/payout.service.ts (L63-L65)

**Purpose:** Finds the first payout ledger row with an exact payout id match (L63-L65).

---

**Inputs & Assumptions:**
- `id` (`string`): untrusted route parameter through the visible caller (`payout.controller.ts:L24-L26`).
- Precondition: payout ids are unique; `recordDraft` derives them from order ids and appends without checking, so establishment is nothing found (L28, L38, L64).

---

**Outputs & Effects:** Returns the matched row object or `null`; no mutation (L64).

---

**Block-by-Block:**

```typescript
// L63-L65
get(id: string) {
  return ledger.find((item) => item.id === id) ?? null;
}
```
- **What:** Performs an exact first-match lookup. **Why here:** it is the whole method. **Assumes:** first match is authoritative. **Establishes:** non-null result has `row.id === id`. **Depended on by:** `PayoutController.get` (`payout.controller.ts:L24-L27`).

---

**Cross-Function Dependencies:**
- Callee `Array.find` (language built-in) at L64.
- Caller: `PayoutController.get` only.
- Shared state: reads `ledger` populated by `recordDraft` (L23-L40).

---

**Open Questions:**
- unclear; need id uniqueness and missing-row response policy.

