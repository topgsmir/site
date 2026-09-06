## `PercentField` in apps/web/src/components/admin/VendorManagement.tsx (L747-L755)

**Purpose:** Renders a named controlled percentage input constrained for normal browser interaction to 0–100 with two-decimal steps (L747-L755).

---

**Inputs & Assumptions:**
- `name`, `label`, `value`: application form key/label and current untrusted numeric string.
- `onChange(value)`: trusted parent callback that updates either commission or holdback form state (L667-L668).

---

**Outputs & Effects:**
- Renders required `type="number"` input with input mode, min 0, max 100, step 0.01, and autocomplete metadata (L749-L752).
- Forwards raw string values without numeric conversion (L751); conversion occurs in `submitVendor` (L459-L460).

---

**Block-by-Block:**

```tsx
// L749-L753
<label className="vendor-field vendor-percent-field">
  <span>{label}</span>
  <input name={name} type="number" inputMode="decimal" min="0" max="100" step="0.01" value={value} onChange={(event) => onChange(event.target.value)} required autoComplete="off" />
  <b aria-hidden="true">%</b>
</label>
```
- **What:** Defines the displayed range and passes edited text upward.
- **Why here:** Browser constraint validation occurs before normal form submission.
- **Assumes:** browser numeric syntax and later `Number(value)/100` agree with server decimal expectations. Established across this component and API DTO/service; exact precision policy: nothing found here.
- **Establishes:** normal user submission is blocked by the browser for values outside attributes.
- **Depended on by:** fractional payload conversion in `submitVendor`.

---

**Cross-Function Dependencies:**
- Calls parent-provided `onChange`; current call sites invoke `updateField` (L667-L668).
- Caller: `VendorManagement` panel form.
- Shared state: commission and holdback strings.
- Invariant coupling: inverse display conversion is performed by `formFromVendor` (L251-L252).

---

**Open Questions:**
- unclear; need backend/database decimal precision policy to establish exact round-trip behavior.
