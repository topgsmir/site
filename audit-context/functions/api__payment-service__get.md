## `PaymentService.get` in apps/api/src/integrations/payments/payment.service.ts (L18-L20)

**Purpose:** Looks up a payment adapter by provider-code string in the service's registry (L18-L20).

---

**Inputs & Assumptions:**
- `providerCode` (`string`): caller-supplied internal argument; no visible repository call reaches this method except `initiateWithProvider` (L18-L19, L26). Trust: semi-trusted/unknown future caller.
- Precondition: the map contains the key. Constructor registration establishes only the concrete local provider code (`L15`; `local-gateway.adapter.ts:L10`); all other strings are established by nothing found.

---

**Outputs & Effects:** Returns the indexed value at runtime, which is the adapter for a registered key and `undefined` for an absent key; the declared return type is `BasePaymentAdapter` (L18-L19). No mutation.

---

**Block-by-Block:**

```typescript
// L18-L20
get(providerCode: string): BasePaymentAdapter {
  return this.adapters[providerCode];
}
```
- **What:** Performs direct object-key lookup. **Why here:** it centralizes selection for `initiateWithProvider`. **Assumes:** key is registered; nothing found for arbitrary strings. **Establishes:** no additional property beyond JavaScript lookup semantics. **Depended on by:** immediate `.initiate` call at L26.

---

**Cross-Function Dependencies:**
- No callees.
- Caller: `PaymentService.initiateWithProvider` only (L26; repository search found no other use).
- Shared state: reads `adapters`, written only by the constructor at L15.

---

**Open Questions:**
- unclear; need intended behavior for unknown provider codes and whether external controllers will call this service later.

