## `PayoutService.setStatus` in apps/api/src/modules/payout/payout.service.ts (L83-L90)

**Purpose:** Finds a payout row by id and overwrites its status with a supplied value (L83-L90).

---

**Inputs & Assumptions:**
- `id` (`string`): untrusted path value through `PayoutController.setStatus` (`payout.controller.ts:L34-L36`).
- `status` (`PayoutStatus`): untrusted HTTP body value at runtime; the TypeScript union is compile-time only (`payout.controller.ts:L11-L13`, L35-L36; `packages/shared-types/src/index.ts:L10-L15`).
- Preconditions: status belongs to the union and transition is allowed from current row state; no runtime check or transition table establishes these; nothing found (L83-L88).

---

**Outputs & Effects:** Returns a message object without mutation on no match (L84-L87); otherwise assigns `row.status = status` and returns the row (L88-L89).

---

**Block-by-Block:**

```typescript
// L84-L87
const row = ledger.find((item) => item.id === id);
if (!row) return { message: "ledger row not found" };
```
- **What:** Resolves the first exact id match and exits on absence. **Why here:** guards the write. **Assumes:** ids are unique; established by nothing found. **Establishes:** `row` exists for L88-L89. **Depended on by:** assignment.

```typescript
// L88-L89
row.status = status;
return row;
```
- **What:** Directly writes and returns the new state. **Why here:** lookup has succeeded. **Assumes:** supplied status and transition are permitted; nothing found. **Establishes:** stored status strictly equals the supplied runtime value. **Depended on by:** future reads and status writers.

---

**Cross-Function Dependencies:**
- Callee `Array.find` (language built-in) at L84.
- Caller: `PayoutController.setStatus` only (`payout.controller.ts:L34-L37`).
- Shared state: mutates `ledger` status also written by `request` and `updateFromOrderStatus` (L42-L57, L67-L81).

---

**Open Questions:**
- unclear; need caller authorization and legal payout transition policy.

