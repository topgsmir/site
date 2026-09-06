## `formFromVendor` in apps/web/src/components/admin/VendorManagement.tsx (L243-L255)

**Purpose:** Converts an API `Vendor` projection into editable client form state (L243-L255).

---

**Inputs & Assumptions:**
- `vendor` (`Vendor`): API-sourced object selected from current vendor state. Trust: semi-trusted; TypeScript generic does not runtime-validate Axios response (`L298-L299`, L416-L419).
- Precondition: commission and holdback are fractional numeric values. Established by the backend vendor projection and DTO/service convention (`apps/api/src/modules/seller/seller.service.ts`); runtime check here: nothing found.

---

**Outputs & Effects:**
- Returns copied text/status fields, blank password, percentages multiplied by 100 and stringified, and a cloned permissions array (L244-L254).
- No external interactions or persistent writes.

---

**Block-by-Block:**

```tsx
// L244-L254
return { ... password: "", ... commission: String(vendor.commission * 100), holdbackRate: String(vendor.holdbackRate * 100), permissions: [...vendor.permissions] };
```
- **What:** Adapts the server projection to controlled inputs.
- **Why here:** `openEdit` requires a detached editable copy before opening the panel.
- **Assumes:** multiplying then later dividing by 100 preserves the intended values (`submitVendor` L459-L460).
- **Establishes:** password is not prefilled and permissions do not alias the source array.
- **Depended on by:** `openEdit` (L416-L423).

---

**Cross-Function Dependencies:**
- No project callees.
- Caller: `openEdit` (L418).
- Shared state: source `vendors` and destination `form` state.
- Invariant coupling: inverse conversion occurs in `submitVendor` (L459-L460).

---

**Open Questions:**
- unclear; need backend numeric serialization details to establish precision across multiply/string/divide conversion.
