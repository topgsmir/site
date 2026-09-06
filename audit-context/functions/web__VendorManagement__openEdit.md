## `VendorManagement.openEdit` in apps/web/src/components/admin/VendorManagement.tsx (L416-L423)

**Purpose:** Records the invoking button, loads a selected vendor into form state, and opens the panel in edit mode (L416-L423).

---

**Inputs & Assumptions:**
- `vendor` (`Vendor`): item from rendered `filteredVendors`, originally API/local response state (L568-L590). Trust: semi-trusted.
- `trigger` (`HTMLButtonElement`): trusted current target from that vendor's manage button (L590).
- Precondition: vendor id is the intended PATCH target. Established by user selection from the current rendered item (L590).

---

**Outputs & Effects:**
- Stores the opener, converts vendor projection to form state, stores its id, selects edit mode, and clears notices (L417-L422).

---

**Block-by-Block:**

```tsx
// L417-L422
panelTrigger.current = trigger;
setForm(formFromVendor(vendor));
setEditingId(vendor.id);
setPanelMode("edit");
setError("");
setMessage("");
```
- **What:** Establishes edit-panel state and a focus-restoration target from one list item.
- **Why here:** Form values and path id are captured together for later submit.
- **Assumes:** state batching keeps the form/id/mode from mixing across renders. Established by React event update semantics.
- **Establishes:** next edit render associates form values and `editingId` with the selected vendor.
- **Depended on by:** `submitVendor` PATCH selection and `closePanel` focus restoration (L425-L429, L465-L467).

---

**Cross-Function Dependencies:**
- Callee `formFromVendor` (internal): clones/adapts server projection (L243-L255).
- Caller: each vendor manage button (L590).
- Shared state: current list item, `panelTrigger`, edit form, panel mode, editing id.
- Invariant coupling: PATCH path uses `editingId`, while local replacement uses the response object's id (L467-L472).

---

**Open Questions:**
- No open questions.
