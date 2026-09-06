## `Field` in apps/web/src/components/admin/VendorManagement.tsx (L709-L745)

**Purpose:** Renders a reusable named controlled text-like input and forwards raw browser string changes to vendor form state (L709-L745).

---

**Inputs & Assumptions:**
- `name`, `label`, `value`, `type`, `required`, `minLength`, `autoComplete`, `spellCheck`: application-controlled form/presentation props (L709-L729).
- `onChange(value)`: trusted parent callback, instantiated as `updateField` wrappers in `VendorManagement` (L644-L657).
- User-entered input value is untrusted.

---

**Outputs & Effects:**
- Renders a named controlled input with supplied native attributes (L730-L744).
- On browser change, passes `event.target.value` without transformation to the parent callback (L737).

---

**Block-by-Block:**

```tsx
// L730-L744
return <label className="vendor-field"><span>{label}</span><input name={name} type={type} value={value} onChange={(event) => onChange(event.target.value)} required={required} minLength={minLength} autoComplete={autoComplete} spellCheck={spellCheck} /></label>;
```
- **What:** Couples label, controlled value, constraints, and raw string propagation.
- **Why here:** Native validation metadata lives beside the input that supplies the request field.
- **Assumes:** supplied name/type/constraints match the API contract. Established by individual call sites for email/password/text (L644-L657), with server DTO validation authoritative.
- **Establishes:** normal form submission is browser-constrained by the supplied attributes; arbitrary callback invocation remains possible.
- **Depended on by:** `submitVendor` payload fields (L452-L462).

---

**Cross-Function Dependencies:**
- Calls parent-provided `onChange`; current callers invoke `updateField` (L644-L657).
- Caller: `VendorManagement` panel form.
- Shared state: controlled `form` fields.
- Invariant coupling: empty edit password is omitted by `submitVendor`, while create password is marked required/minimum eight at L648-L657.

---

**Open Questions:**
- No open questions.
