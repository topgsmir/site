## `PaymentService.constructor` in apps/api/src/integrations/payments/payment.service.ts (L12-L16)

**Purpose:** Receives the local payment adapter and registers it under its provider code in the service's provider map (L10-L16).

---

**Inputs & Assumptions:**
- `local` (`BasePaymentAdapter` injected using `LocalGatewayAdapter` token): trusted Nest provider registered in `PaymentsModule` (`payment.module.ts:L5-L7`).
- Precondition: `local.providerCode` is a stable non-empty key and no prior adapter occupies it; the map starts empty per instance (L10, L15), and the concrete adapter fixes the code at `local-gateway.adapter.ts:L10`.

---

**Outputs & Effects:** Mutates the private `adapters` map to associate `local.providerCode` with the injected object (L15). No external I/O.

---

**Block-by-Block:**

```typescript
// L12-L16
constructor(@Inject(LocalGatewayAdapter) private readonly local: BasePaymentAdapter) {
  this.adapters[this.local.providerCode] = local;
}
```
- **What:** Captures and indexes the local adapter. **Why here:** registration completes when the service is constructed, before method calls. **Assumes:** Nest resolves `LocalGatewayAdapter`; module provider registration establishes it (`payment.module.ts:L5-L7`). **Establishes:** key `local-country-gateway` resolves to this adapter for this instance (`local-gateway.adapter.ts:L10`). **Depended on by:** `get` and `initiateWithProvider`.

---

**Cross-Function Dependencies:**
- No called functions; property access and map assignment only.
- Caller: Nest provider construction through `PaymentsModule` (`payment.module.ts:L5-L7`).
- Shared state: instance-local mutable `adapters` object, initialized at L10.

---

**Open Questions:**
- unclear; need provider-extension mechanism for the declared `manual` provider code (`base-payment.adapter.ts:L8`, `payment.interface.ts:L3`); none is registered in this module.

