## `PayoutService.recordDraft` in apps/api/src/modules/payout/payout.service.ts (L23-L40)

**Purpose:** Derives commission, holdback, and payable values from an order amount, appends a draft row to the process-local payout ledger, and returns it (L20-L40).

---

**Inputs & Assumptions:**
- `orderId`, `sellerId`, `currency` (`string`): currently passed from unvalidated order HTTP data except generated `orderId` (`order.controller.ts:L39-L47`). Trust: untrusted/semi-trusted mix.
- `grossAmount` (`number`): untrusted order body amount on the visible caller path (`order.controller.ts:L39-L47`).
- Preconditions: amount is finite, non-negative, denominated consistently with currency, and ids identify one order/seller; nothing found in the caller or this function (L23-L38; `order.controller.ts:L38-L47`).

---

**Outputs & Effects:** Calculates fixed 10% commission and 5% holdback (L20-L26), rounds each stored component to two decimal places (L32-L34), creates status `draft`, appends the row to module-level `ledger`, and returns it (L27-L39).

---

**Block-by-Block:**

```typescript
// L23-L26
const commission = grossAmount * this.commissionPercent;
const holdback = grossAmount * this.holdbackPercent;
const payable = grossAmount - commission - holdback;
```
- **What:** Computes the three derived amounts. **Why here:** values feed the row construction. **Assumes:** floating-point arithmetic and fixed service constants represent the intended seller/order terms; no seller-specific values are consulted. **Establishes:** unrounded values satisfy `payable = gross - commission - holdback` under JavaScript number arithmetic. **Depended on by:** L32-L34.

```typescript
// L27-L38
const row: LedgerRow = { id: `payout-${orderId}`, ..., commissionAmount: Number(commission.toFixed(2)), holdbackAmount: Number(holdback.toFixed(2)), payableAmount: Number(payable.toFixed(2)), ..., status: "draft" };
ledger.push(row);
```
- **What:** Materializes and stores the ledger row. **Why here:** all derived values are available. **Assumes:** two-decimal independent rounding preserves required accounting relationships and the derived id is unique; nothing found. **Establishes:** a row with deterministic `payout-<orderId>` id and draft status is visible in this process. **Depended on by:** lookup, request, status update, and listing methods.

---

**Cross-Function Dependencies:**
- Callees `Number.prototype.toFixed`, `Number`, and `Array.push` (runtime built-ins) at L32-L38.
- Caller: `OrderController.create` only (`order.controller.ts:L47`; repository search found no other call).
- Shared state: appends to `ledger`, read/mutated by every other service method (L16, L42-L90).
- Invariant coupling: `updateFromOrderStatus` locates rows by `orderId`, while `get`/`setStatus` use the derived payout id (L42-L45, L63-L64, L83-L88).

---

**Open Questions:**
- unclear; need the source of commission/holdback terms, currency precision rules, and duplicate-order behavior.

