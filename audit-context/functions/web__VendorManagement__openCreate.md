## `VendorManagement.openCreate` in apps/web/src/components/admin/VendorManagement.tsx (L407-L414)

**Purpose:** Records the invoking button, resets edit state, and opens the vendor panel in create mode (L407-L414).

---

**Inputs & Assumptions:**
- `trigger` (`HTMLButtonElement`): trusted current target from the create button click (L518).
- Precondition: `emptyForm` is the intended creation baseline. Established by application constant L217-L227.

---

**Outputs & Effects:**
- Stores the trigger for later focus restoration, clones the baseline object/permissions, clears editing id/notices, and selects create mode (L408-L413).

---

**Block-by-Block:**

```tsx
// L408-L413
panelTrigger.current = trigger;
setForm({ ...emptyForm, permissions: [...emptyForm.permissions] });
setEditingId(null);
setPanelMode("create");
setError("");
setMessage("");
```
- **What:** Captures the opener and queues creation-oriented UI state updates.
- **Why here:** Stale edit values and notices are removed before the panel's next render.
- **Assumes:** shallow cloning is sufficient because only `permissions` is nested; established by `VendorFormState` fields (L205-L215).
- **Establishes:** create mode has no editing id, a fresh permissions array, and a focus-restoration target.
- **Depended on by:** `submitVendor` endpoint choice, password requirement, and `closePanel` focus restoration (L425-L429, L457, L465-L467, L648-L657).

---

**Cross-Function Dependencies:**
- No project callees.
- Caller: create button click passes `event.currentTarget` (L518).
- Shared state: `panelTrigger`, `form`, `editingId`, `panelMode`, `error`, `message`.
- Invariant coupling: create mode selects POST and ignores editing id in `submitVendor`.

---

**Open Questions:**
- No open questions.
