## `PayoutService.request` in apps/api/src/modules/payout/payout.service.ts (L67-L81)

**Purpose:** Finds a ledger row matching order and seller, checks the requested amount does not exceed its payable amount, marks it requested, and returns a row or explanatory message (L67-L81).

---

**Inputs & Assumptions:**
- Destructured `orderId`, `sellerId` (`string`) and `requestedAmount` (`number`): untrusted HTTP body fields through `PayoutController.requestPayout` (`payout.controller.ts:L29-L31`).
- Preconditions: requested amount is finite, non-negative, and in the row's currency; only the upper comparison at L74 establishes anything, so the remaining conditions are established by nothing found.
- Precondition: a matching seller id demonstrates the caller represents that seller; the function compares supplied data to stored data (L68-L70) but receives no caller identity; establishment is nothing found.

---

**Outputs & Effects:** Returns `{"message":"ledger row not found"}` without mutation on no match (L68-L73); returns an upper-bound message without mutation when `requestedAmount > payableAmount` (L74-L78); otherwise sets status to `requested` and returns the row (L79-L80). It does not store `requestedAmount`.

---

**Block-by-Block:**

```typescript
// L68-L73
const row = ledger.find((item) => item.orderId === orderId && item.sellerId === sellerId);
if (!row) return { message: "ledger row not found" };
```
- **What:** Resolves the first row matching both supplied identifiers. **Why here:** amount and status operations require it. **Assumes:** caller-supplied seller id can select the correct row and pairs are unique; uniqueness is established by nothing found. **Establishes:** the selected row's stored ids equal the inputs. **Depended on by:** L74-L80.

```typescript
// L74-L78
if (requestedAmount > row.payableAmount) {
  return { message: "requestedAmount must be <= payable amount" };
}
```
- **What:** Applies an upper-bound check. **Why here:** it precedes the status write. **Assumes:** JavaScript numeric comparison receives finite numbers; runtime input validation is nothing found. **Establishes:** on the fallthrough path, the comparison `requestedAmount > payableAmount` evaluated false, which also occurs for `NaN`. **Depended on by:** L79-L80.

```typescript
// L79-L80
row.status = "requested";
return row;
```
- **What:** Marks and returns the selected row. **Why here:** both earlier exits have passed. **Assumes:** current payout state permits requesting and the amount need not be retained. **Establishes:** row status is `requested`. **Depended on by:** later listing/get/status operations.

---

**Cross-Function Dependencies:**
- Callee `Array.find` (language built-in) at L68-L70.
- Caller: `PayoutController.requestPayout` (`payout.controller.ts:L29-L32`).
- Shared state: mutates row status also written by `updateFromOrderStatus` and `setStatus` (L42-L57, L83-L90).
- Invariant coupling: amount eligibility uses `payableAmount` computed and independently rounded in `recordDraft` (L23-L34).

---

**Open Questions:**
- unclear; need repeat-request, partial-request, amount/currency, caller-identity, and state-transition policy.

