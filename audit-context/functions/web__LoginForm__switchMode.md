## `LoginForm.switchMode` in apps/web/src/app/[locale]/login/LoginForm.tsx (L118-L121)

**Purpose:** Toggles between login and registration UI modes and clears the current request error (L118-L121).

---

**Inputs & Assumptions:**
- Implicit: current `isRegistering` and `error` React state (L68-L70).
- Precondition: invoked from the non-submit mode button. Established by `type="button"` and `onClick={switchMode}` (L187-L190).

---

**Outputs & Effects:**
- Functionally flips registration mode and queues an empty error (L119-L120).
- Does not clear browser input DOM values explicitly.

---

**Block-by-Block:**

```tsx
// L118-L121
function switchMode() {
  setIsRegistering((value) => !value);
  setError("");
}
```
- **What:** Toggles mode and dismisses error feedback.
- **Why here:** Both state changes occur in one click callback.
- **Assumes:** React reconciles the conditional and renamed identity field for the new mode. Established by render branches at L140-L172.
- **Establishes:** next render has opposite mode and no displayed request error.
- **Depended on by:** copy, payload shape, endpoint, input attributes, and submit label (L79-L88, L132-L184).

---

**Cross-Function Dependencies:**
- No project callees.
- Caller: mode-switch button (L189).
- Shared state: `isRegistering` is also read by `submit` (L79-L88).
- Invariant coupling: mode controls both rendered field names and request endpoint/payload.

---

**Open Questions:**
- unclear; need runtime interaction verification to determine which uncontrolled field values persist across mode changes.
