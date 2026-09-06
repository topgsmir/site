## `PayoutController.get` in apps/api/src/modules/payout/payout.controller.ts (L24-L27)

**Purpose:** Implements `GET /api/payouts/:id` by looking up a process-local ledger row (L15, L24-L27; `main.ts:L21`).

---

**Inputs & Assumptions:**
- `id` (`string`): untrusted path parameter (L24-L26).
- Precondition: the caller may view the row identified by `id`; no guard or ownership check is declared, so establishment is nothing found (L15-L27).

---

**Outputs & Effects:** Returns the first matching ledger row or `null`; no mutation (L26; `payout.service.ts:L63-L65`).

---

**Block-by-Block:**

```typescript
// L24-L27
@Get(":id")
get(@Param("id") id: string) {
  return this.payoutService.get(id);
}
```
- **What:** Delegates identifier lookup. **Why here:** the controller adds no transformation. **Assumes:** service first-match/null behavior is the HTTP contract. **Establishes:** any non-null response has an exact id match in `ledger`. **Depended on by:** HTTP consumers; none found in repository source.

---

**Cross-Function Dependencies:**
- Callee `PayoutService.get` (internal, `payout.service.ts:L63-L65`): uses `Array.find` and returns `null` on miss.
- Callers: HTTP clients via `PayoutModule` (`payout.module.ts:L5-L9`).
- Shared state: reads `ledger`, populated by `recordDraft` (`payout.service.ts:L23-L40`).

---

**Open Questions:**
- unclear; need API response and payout visibility policy for missing and existing rows.

