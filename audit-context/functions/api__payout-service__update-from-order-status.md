## `PayoutService.updateFromOrderStatus` in apps/api/src/modules/payout/payout.service.ts (L42-L57)

**Purpose:** Projects selected order statuses into the first matching payout ledger row: cancellation becomes disputed and delivery becomes approved (L42-L57).

---

**Inputs & Assumptions:**
- `orderId` (`string`): generated order id on the visible caller path (`order.controller.ts:L55-L67`). Trust: semi-trusted after order lookup.
- `status` (`string`): untrusted HTTP body value forwarded by `OrderController.updateStatus` (L42; `order.controller.ts:L55-L66`).
- Precondition: at most one ledger row has the order id; `recordDraft` appends without a uniqueness check, so establishment is nothing found (L23-L38, L43).

---

**Outputs & Effects:** Returns `null` with no change when no row matches (L43-L46). Sets status to `disputed` for exact input `cancelled` (L48-L51), to `approved` for `delivered` (L52-L55), and otherwise returns the row unchanged (L56).

---

**Block-by-Block:**

```typescript
// L43-L46
const row = ledger.find((item) => item.orderId === orderId);
if (!row) return null;
```
- **What:** Resolves the first order-linked row. **Why here:** every mutation needs a row. **Assumes:** first-match semantics represent the order's ledger state. **Establishes:** `row` exists after the guard. **Depended on by:** L48-L56.

```typescript
// L48-L56
if (status === "cancelled") { row.status = "disputed"; return row; }
if (status === "delivered") { row.status = "approved"; return row; }
return row;
```
- **What:** Applies the two recognized mappings and leaves all others unchanged. **Why here:** mappings are mutually exclusive and return immediately. **Assumes:** these mappings are valid from every prior payout state; nothing found checks prior state. **Establishes:** exact post-state for recognized inputs, identity/no-write for all others. **Depended on by:** `OrderController.updateStatus`, which ignores the return value (`order.controller.ts:L65-L67`).

---

**Cross-Function Dependencies:**
- Callee `Array.find` (language built-in) at L43.
- Caller: `OrderController.updateStatus` only (`order.controller.ts:L66`).
- Shared state: payout `status`, also assigned by `request` and `setStatus` (L79, L88).
- Invariant coupling: last executed writer among order projection, request, and direct status update determines row status.

---

**Open Questions:**
- unclear; need the intended coupling/state graph between all order and payout statuses.

