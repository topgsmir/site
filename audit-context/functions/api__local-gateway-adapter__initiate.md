## `LocalGatewayAdapter.initiate` in apps/api/src/integrations/payments/providers/local-gateway/local-gateway.adapter.ts (L12-L18)

**Purpose:** Produces a pending local-gateway payment intent descriptor from an input order id (L12-L18).

---

**Inputs & Assumptions:**
- `input` (`PaymentIntentInput`): contains ids, amount, currency, and optional metadata (`payment.interface.ts:L5-L12`). Trust: unknown; no visible application caller reaches `PaymentService.initiateWithProvider`.
- Preconditions: `input.orderId` is a usable identifier and the rest of the payment input has already been validated/recorded; this method inspects only `orderId`, so establishment for all other fields is nothing found (L12-L16).
- Precondition: millisecond time plus order id produces a unique provider reference; nothing found (L14).

---

**Outputs & Effects:** Returns an already-resolved async promise containing a `local-<orderId>-<time>` reference, status `pending`, and relative `/pay/local/<orderId>` URL (L12-L18). No network call or persistent write is present.

---

**Block-by-Block:**

```typescript
// L12-L18
async initiate(input: PaymentIntentInput): Promise<PaymentIntentResult> {
  return {
    providerReferenceId: `local-${input.orderId}-${Date.now()}`,
    status: "pending",
    paymentUrl: `/pay/local/${input.orderId}`
  };
}
```
- **What:** Constructs the provider result locally. **Why here:** it is the complete adapter initiation path. **Assumes:** a relative URL is meaningful to the consumer and no provider-side creation/persistence is required; no such interaction appears. **Establishes:** result has the three shown fields and pending status. **Depended on by:** dynamic call from `PaymentService.initiateWithProvider` when local provider is selected (`payment.service.ts:L22-L27`).

---

**Cross-Function Dependencies:**
- Callee `Date.now` (runtime built-in) at L14.
- Caller: dynamically through `PaymentService.initiateWithProvider`; no direct caller found (`payment.service.ts:L22-L27`).
- Shared state: none.
- Invariant coupling: `verify` later recognizes any reference beginning `local-`, not specifically values generated here (L20-L22).

---

**Open Questions:**
- unclear; need payment persistence/provider protocol and the consumer's base URL resolution rules.

