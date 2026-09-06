## `ThemeToggle.toggleTheme` in apps/web/src/components/theme/ThemeToggle.tsx (L33-L43)

**Purpose:** Switches the active theme, synchronizes component and DOM state, and attempts to persist the choice (L33-L42).

---

**Inputs & Assumptions:**
- Implicit: captured React `theme` state (L27, L34), DOM theme state, and browser `localStorage` (L35-L39).
- Precondition: captured state represents the currently applied DOM theme. Initially established by the mount effect calling `readTheme` (L29-L31); for prior clicks established by this function's `applyTheme` and `setTheme` calls (L35-L36).

---

**Outputs & Effects:**
- Applies the opposite theme to DOM, queues React state, and attempts to write `topgsm-theme` (L34-L40).
- Storage failures are swallowed; DOM and React updates remain in place (L38-L42).

---

**Block-by-Block:**

```tsx
// L34-L36
const nextTheme: Theme = theme === "dark" ? "light" : "dark";
applyTheme(nextTheme);
setTheme(nextTheme);
```
- **What:** Computes and applies the next binary theme.
- **Why here:** Visual and component state update before persistence, so storage availability does not gate the current-session choice.
- **Assumes:** no other writer changes root theme without updating this component state after mount. Established by: nothing found.
- **Establishes:** this handler's DOM write and queued React state agree.
- **Depended on by:** button pressed state and label rendering (L45-L55).

```tsx
// L38-L42
try { localStorage.setItem("topgsm-theme", nextTheme); } catch { }
```
- **What:** Persists the choice when browser storage permits it.
- **Why here:** Persistence follows immediate visual state.
- **Assumes:** failure requires no user-visible state change; encoded by empty catch.
- **Establishes:** stored preference agrees with the active choice only on the success path; on the catch path, nothing found.
- **Depended on by:** next page load's inline `themeScript` (`layout.tsx:L39-L42`).

---

**Cross-Function Dependencies:**
- Callee `applyTheme` (internal): synchronously writes root dataset/style/meta (L18-L24).
- Caller: theme toggle button `onClick` (L49-L55).
- Shared state: React theme, document theme, and `localStorage['topgsm-theme']`.
- Invariant coupling: pre-hydration `themeScript` chooses persisted theme or system preference (`layout.tsx:L39-L48`).

---

**Open Questions:**
- unclear; need to inspect whether any runtime code changes theme or system preference after mount without invoking this handler.
