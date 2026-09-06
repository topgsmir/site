## `PayoutService.listAll` in apps/api/src/modules/payout/payout.service.ts (L59-L61)

**Purpose:** Returns the complete process-local payout ledger to its caller (L59-L61).

---

**Inputs & Assumptions:**
- No explicit parameters. Implicit input: module-level `ledger` (L16).
- Precondition: caller is entitled to the complete collection; this service performs no caller check or filtering (L59-L60), and the visible HTTP caller adds neither (`payout.controller.ts:L19-L22`); nothing found.

---

**Outputs & Effects:** Returns the actual mutable `ledger` array reference; no copy and no direct write (L60).

---

**Block-by-Block:**

```typescript
// L59-L61
listAll() {
  return ledger;
}
```
- **What:** Exposes the array. **Why here:** it is the whole method. **Assumes:** returning all rows and the backing reference is acceptable to every internal caller; nothing found documents this. **Establishes:** the caller receives current insertion order and object identities. **Depended on by:** `PayoutController.list` (`payout.controller.ts:L19-L22`).

---

**Cross-Function Dependencies:**
- No callees.
- Caller: `PayoutController.list` only (repository search; `payout.controller.ts:L21`).
- Shared state: reads the array populated by `recordDraft` and whose rows are mutated by three methods (L23-L40, L42-L57, L67-L90).

---

**Open Questions:**
- unclear; need service API ownership rules for the returned mutable reference.

