## `VendorManagement.updateField` in apps/web/src/components/admin/VendorManagement.tsx (L431-L436)

**Purpose:** Updates one typed vendor form field without replacing other current fields (L431-L436).

---

**Inputs & Assumptions:**
- `field` (`keyof VendorFormState`): trusted application-selected field names from render callbacks (L644-L668).
- `value` (`VendorFormState[K]`): mostly user-entered strings or selected status; trust: untrusted for text/numeric strings, application-controlled for permission updates handled elsewhere.

---

**Outputs & Effects:**
- Functionally replaces one key in `form` React state (L435).
- Performs no normalization or runtime validation.

---

**Block-by-Block:**

```tsx
// L431-L436
function updateField<K extends keyof VendorFormState>(field: K, value: VendorFormState[K]) {
  setForm((current) => ({ ...current, [field]: value }));
}
```
- **What:** Applies a computed-property shallow update to latest state.
- **Why here:** Functional update avoids overwriting changes queued from another field.
- **Assumes:** caller field/value pairing is valid at runtime; TypeScript establishes internal compile-time pairing, while the DOM status cast at L661 is not a runtime check.
- **Establishes:** all untouched form fields retain their latest values.
- **Depended on by:** `submitVendor` payload construction (L452-L462).

---

**Cross-Function Dependencies:**
- No project callees.
- Callers: controlled input/select callbacks (L644-L668).
- Shared state: `form` with `togglePermission`, `openCreate`, and `openEdit`.
- Invariant coupling: browser min/max/required attributes constrain normal interaction, while API DTO validation is the persistent boundary.

---

**Open Questions:**
- No open questions.
