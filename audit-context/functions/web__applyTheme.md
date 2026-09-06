## `applyTheme` in apps/web/src/components/theme/ThemeToggle.tsx (L18-L24)

**Purpose:** Applies a selected theme to root browser presentation state (L18-L24).

---

**Inputs & Assumptions:**
- `theme` (`"light" | "dark"`): trusted local union supplied by `toggleTheme` (L33-L35).
- Implicit: browser root element and optional `meta[name="theme-color"]` (L19-L23).
- Precondition: executes in a browser document. Established by the click-handler call path in the client component (`L1`, L55).

---

**Outputs & Effects:**
- Writes `documentElement.dataset.theme` and inline `colorScheme` (L19-L20).
- Updates the first matching theme-color meta element when present (L21-L23).
- Returns `undefined`; does not persist the preference.

---

**Block-by-Block:**

```tsx
// L18-L23
document.documentElement.dataset.theme = theme;
document.documentElement.style.colorScheme = theme;
document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#080d16" : "#f4f7fb");
```
- **What:** Mutates three browser presentation surfaces.
- **Why here:** DOM changes occur before React state and storage updates in `toggleTheme` (L35-L39).
- **Assumes:** a missing theme-color meta is acceptable; optional chaining establishes that path (L21-L23).
- **Establishes:** root dataset and color scheme agree with `theme`; meta agrees when present.
- **Depended on by:** theme CSS and browser chrome coloring.

---

**Cross-Function Dependencies:**
- Browser DOM methods are external black boxes.
- Caller: `toggleTheme` (L35).
- Shared state: root dataset/style/meta with the inline layout `themeScript` (`layout.tsx:L43-L48`).
- Invariant coupling: both writers use identical theme values and color constants (`layout.tsx:L40-L47`).

---

**Open Questions:**
- No open questions.
