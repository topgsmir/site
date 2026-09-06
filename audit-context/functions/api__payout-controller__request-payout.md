## `PayoutController.requestPayout` in apps/api/src/modules/payout/payout.controller.ts (L29-L32)

**Purpose:** Implements `POST /api/payouts/requests` by forwarding a requested order/seller/amount tuple to the payout ledger service (L15, L29-L32; `main.ts:L21`).

---

**Inputs & Assumptions:**
- `body` (`CreateRequestDto` type alias): untrusted HTTP JSON containing `orderId`, `sellerId`, and `requestedAmount` by compile-time declaration (L5-L9, L30).
- Preconditions: fields have the declared runtime shapes and the caller represents the supplied seller; the alias is erased, no runtime DTO decorators/local validation are present, and no guard is declared; nothing found (L5-L9, L15-L32).

---

**Outputs & Effects:** Returns either the matching ledger row after changing its status to `requested`, or a message object from the service when no row matches or the amount exceeds payable (L31; `payout.service.ts:L67-L81`).

---

**Block-by-Block:**

```typescript
// L29-L32
@Post("requests")
requestPayout(@Body() body: CreateRequestDto) {
  return this.payoutService.request(body);
}
```
- **What:** Passes the complete request body to the service. **Why here:** there is no controller-side parsing or identity binding. **Assumes:** the service performs all required eligibility checks; the callee checks exact order/seller match and only an upper amount bound (`payout.service.ts:L68-L79`). **Establishes:** response and state transition are exactly the service result. **Depended on by:** HTTP payout-request clients.

---

**Cross-Function Dependencies:**
- Callee `PayoutService.request` (internal, `payout.service.ts:L67-L81`): searches by both ids, rejects only `requestedAmount > payableAmount`, then sets status to `requested`; it does not store the requested amount.
- Callers: HTTP clients through `PayoutModule` (`payout.module.ts:L5-L9`).
- Shared state: may mutate a matching `ledger` row.

---

**Open Questions:**
- unclear; need request eligibility, seller identity binding, amount domain, and repeat-request policy.

