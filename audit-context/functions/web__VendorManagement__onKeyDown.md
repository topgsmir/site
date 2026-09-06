## `VendorManagement.onKeyDown` in apps/web/src/components/admin/VendorManagement.tsx (L313-L336)

**Purpose:** Closes an open vendor panel on eligible Escape presses and keeps Tab navigation cycling among its current focusable descendants (L313-L336).

---

**Inputs & Assumptions:**
- `event` (`KeyboardEvent`): browser-global keydown event; untrusted user interaction.
- Implicit: captured `submitting` state, `panel` ref, active document element, and `closePanel` callback from the effect render (L311-L351).
- Precondition: listener is installed only while `panelMode` is truthy. Established by early return at L312 and registration at L345.

---

**Outputs & Effects:**
- Calls `closePanel` for exact `Escape` when `submitting` is false and returns (L314-L317).
- For Tab with a mounted panel, queries enabled buttons/inputs/selects, links, and non-negative tabindex descendants, filters `aria-hidden="true"`, and wraps focus at the first/last boundaries (L318-L335).

---

**Block-by-Block:**

```tsx
// L313-L317
const onKeyDown = (event: KeyboardEvent) => {
  if (event.key === "Escape" && !submitting) {
    closePanel();
    return;
  }
```
- **What:** Handles the close branch before Tab behavior.
- **Why here:** Returning prevents a closing Escape event from entering focus-cycle logic.
- **Assumes:** Escape should not close while submitting; encoded by the predicate.
- **Establishes:** keyboard closure is gated by pending state.
- **Depended on by:** panel interaction lifecycle.

```tsx
// L318-L335
if (event.key !== "Tab" || !panel.current) return;
const focusable = Array.from(panel.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex="-1"])')).filter((element) => element.getAttribute("aria-hidden") !== "true");
const first = focusable[0];
const last = focusable.at(-1);
if (!first || !last) return;
if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
```
- **What:** Finds current focus targets and wraps focus when Tab would leave at an endpoint.
- **Why here:** Runs only after the event/panel guard.
- **Assumes:** selector order represents intended keyboard order and excludes all non-focusable descendants; further runtime visibility/disabled-by-ancestor checks: nothing found.
- **Establishes:** when focus is exactly on a discovered endpoint, the corresponding outward Tab direction wraps to the other endpoint.
- **Depended on by:** modal keyboard containment.

---

**Cross-Function Dependencies:**
- Callee `closePanel` clears mode/id and schedules opener focus restoration (L425-L429).
- Browser DOM selector/focus methods are external runtime calls.
- Caller: browser window after effect listener registration (L345).
- Shared state: panel/submitting React state and global window listener.
- Invariant coupling: click-based close controls do not use this `!submitting` condition (L631, L638, L696).

---

**Open Questions:**
- unclear; need interaction requirements to establish whether keyboard and pointer closure are intentionally different during submission.
- unclear; need rendered-style inspection to know whether the selector can include elements hidden by layout/CSS rather than `aria-hidden`.
