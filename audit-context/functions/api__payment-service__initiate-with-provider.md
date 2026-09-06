## `PaymentService.initiateWithProvider` in apps/api/src/integrations/payments/payment.service.ts (L22-L27)

**Purpose:** Selects a payment adapter by code and delegates payment-intent initiation to it (L22-L27).

---

**Inputs & Assumptions:**
- `providerCode` (`string`): provider selector from an internal caller; no caller exists in repository source (L23).
- `input` (`PaymentIntentInput`): order, seller, buyer, amount, currency, and optional metadata defined at `payment.interface.ts:L5-L12`. Trust: unknown because no visible caller exists.
- Preconditions: provider exists and input satisfies the selected adapter's contract; only local adapter registration is visible, and no runtime validation is performed here; other cases are established by nothing found (L26; constructor L12-L16).

---

**Outputs & Effects:** Returns the promise produced by the selected adapter's `initiate` method (L25-L26). For the local adapter, this resolves to a pending reference/relative payment URL without external I/O (`local-gateway.adapter.ts:L12-L18`).

---

**Block-by-Block:**

```typescript
// L22-L27
initiateWithProvider(providerCode: string, input: PaymentIntentInput): Promise<PaymentIntentResult> {
  return this.get(providerCode).initiate(input);
}
```
- **What:** Resolves and invokes an adapter. **Why here:** provider selection precedes provider-specific work. **Assumes:** `get` returns an object with `initiate`; for unknown codes it returns `undefined` at runtime (L18-L20). **Establishes:** returned promise/result is wholly the adapter's result. **Depended on by:** no visible repository caller.

---

**Cross-Function Dependencies:**
- Callee `PaymentService.get` (internal, L18-L20): direct map lookup, registered only for the local adapter.
- Dynamic callee `PaymentAdapter.initiate` (internal for the registered local implementation, `local-gateway.adapter.ts:L12-L18`; otherwise external/unknown): assumes the selected provider honors `PaymentIntentResult` (`payment.interface.ts:L14-L19`).
- Callers: none found in repository source. `PaymentService` is exported by `PaymentsModule` (`payment.module.ts:L5-L8`) but no consumer injects it.
- Shared state: reads the adapter registry; selected adapters may perform provider-specific effects.

---

**Open Questions:**
- unclear; need the intended HTTP/application entry point, provider-code validation, and payment intent persistence contract.

