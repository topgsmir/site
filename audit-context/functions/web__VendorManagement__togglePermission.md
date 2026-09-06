## `VendorManagement.togglePermission` in apps/web/src/components/admin/VendorManagement.tsx (L438-L445)

**Purpose:** Adds or removes one vendor permission in editable form state (L438-L445).

---

**Inputs & Assumptions:**
- `permission` (`VendorPermission`): application-selected value produced by mapping `permissionOrder` (L18-L24, L675-L686). Trust: trusted UI constant.
- Implicit: latest form state through a functional updater.

---

**Outputs & Effects:**
- Replaces `form.permissions` with a filtered or appended array while preserving other fields (L439-L444).
- No persistent write until `submitVendor`.

---

**Block-by-Block:**

```tsx
// L439-L444
setForm((current) => ({
  ...current,
  permissions: current.permissions.includes(permission)
    ? current.permissions.filter((item) => item !== permission)
    : [...current.permissions, permission]
}));
```
- **What:** Implements set-like toggle behavior using arrays.
- **Why here:** Membership check and update derive from the same latest-state callback.
- **Assumes:** existing permissions contain no duplicates. Established for baseline and this function's appended path; API-loaded `vendor.permissions` uniqueness is expected from persistent representation, runtime check here: nothing found.
- **Establishes:** after this operation, the selected permission is absent or appears once if the prior list was unique.
- **Depended on by:** checked state and submitted permission list (L461, L681-L686).

---

**Cross-Function Dependencies:**
- No project callees.
- Caller: permission checkbox change callback (L686).
- Shared state: `form.permissions` with `formFromVendor`, `openCreate`, and `submitVendor`.
- Invariant coupling: backend update replaces permission rows from the submitted list (`api__seller-service__update-vendor.md`).

---

**Open Questions:**
- No open questions.
