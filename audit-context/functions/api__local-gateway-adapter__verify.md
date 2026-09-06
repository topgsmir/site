## `LocalGatewayAdapter.verify` in apps/api/src/integrations/payments/providers/local-gateway/local-gateway.adapter.ts (L20-L22)

**Purpose:** Classifies a provider reference as verified when its string begins with `local-` (L20-L22).

---

**Inputs & Assumptions:**
- `providerReferenceId` (`string`): caller-supplied provider reference. Trust: unknown; no visible caller invokes `verify`.
- Precondition: prefix membership is the complete local-gateway verification contract; no persisted intent lookup, amount comparison, or provider interaction is present, so establishment beyond the prefix is nothing found (L20-L21).

---

**Outputs & Effects:** Resolves to `true` exactly when `startsWith("local-")` is true, otherwise `false`; no I/O or state write (L20-L22).

---

**Block-by-Block:**

```typescript
// L20-L22
async verify(providerReferenceId: string) {
  return providerReferenceId.startsWith("local-");
}
```
- **What:** Performs a prefix test. **Why here:** it is the whole verification implementation. **Assumes:** input is a string and prefix proves the desired provider state; string shape is declared by the abstract contract (`base-payment.adapter.ts:L11`) but no runtime caller check is visible. **Establishes:** only prefix membership. **Depended on by:** no visible caller.

---

**Cross-Function Dependencies:**
- Callee `String.startsWith` (language built-in) at L21.
- Callers: none found in repository source; the method fulfills the abstract adapter contract (`base-payment.adapter.ts:L11`).
- Shared state: none; it does not consult results created by `initiate`.

---

**Open Questions:**
- unclear; need the local gateway's definition of verification and intended caller/data source.

