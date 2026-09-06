## `VendorManagement.closePanel` in apps/web/src/components/admin/VendorManagement.tsx (L425-L429)

**Purpose:** Closes the create/edit panel, drops its selected edit identifier, and schedules focus restoration to the button that opened it (L425-L429).

---

**Inputs & Assumptions:**
- No explicit inputs; operates on component state.
- It can be reached by scrim/close/cancel clicks, Escape when not submitting, and successful submit (L313-L316, L475, L631-L696).

---

**Outputs & Effects:**
- Queues `panelMode=null` and `editingId=null`, then requests focus restoration through `requestAnimationFrame` (L426-L428).
- Leaves form values, request notices, submitting state, and the stored trigger reference unchanged.

---

**Block-by-Block:**

```tsx
// L425-L429
function closePanel() {
  setPanelMode(null);
  setEditingId(null);
  window.requestAnimationFrame(() => panelTrigger.current?.focus());
}
```
- **What:** Removes the render condition/edit target and returns keyboard focus asynchronously.
- **Why here:** State changes begin panel teardown before the next-frame focus operation.
- **Assumes:** `panelTrigger.current` still refers to a mounted, focusable opener. Established when opening (L407-L423); mountedness at callback time is conditionally handled only by optional chaining.
- **Establishes:** next render has no panel/edit target; focus is requested when a trigger remains.
- **Depended on by:** modal cleanup effect keyed to `panelMode` (L311-L351).

---

**Cross-Function Dependencies:**
- No project callees.
- Callers: Escape effect, successful `submitVendor`, scrim, close, and cancel controls.
- Shared state: `panelMode`, `editingId`, and `panelTrigger`; `submitVendor` captures mode/id across its await.
- Invariant coupling: the in-flight submit operation uses render-captured mode/id even if UI close state is queued afterward.

---

**Open Questions:**
- unclear; need interaction requirements for closing via scrim/buttons while `submitting` is true.
