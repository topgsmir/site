## `readTheme` in apps/web/src/components/theme/ThemeToggle.tsx (L14-L16)

**Purpose:** Reads the theme currently applied to the root document and normalizes every non-`dark` value to `light` (L14-L16).

---

**Inputs & Assumptions:**
- Implicit: browser `document.documentElement.dataset.theme`. Trust: DOM state shared with the inline layout script and `applyTheme` (`layout.tsx:L36-L52`; `ThemeToggle.tsx:L18-L24`).
- Precondition: executes in a browser. Established by its only caller, a client component effect (`ThemeToggle.tsx:L1`, L29-L31).

---

**Outputs & Effects:**
- Returns `"dark"` only for the exact dataset value `dark`; otherwise returns `"light"` (L15).
- No writes or external interactions.

---

**Block-by-Block:**

```tsx
// L14-L16
function readTheme(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}
```
- **What:** Converts root DOM theme state to the local `Theme` union.
- **Why here:** Hydrates React state from the pre-hydration DOM after mount.
- **Assumes:** the root dataset is the canonical active theme; established jointly by `themeScript` and `applyTheme`.
- **Establishes:** caller receives one of the two supported values.
- **Depended on by:** `ThemeToggle`'s mount effect (L29-L31).

---

**Cross-Function Dependencies:**
- No callees beyond browser DOM access.
- Caller: `ThemeToggle` mount effect (L29-L31).
- Shared state: `data-theme` with `themeScript` (`layout.tsx:L43`, L50) and `applyTheme` (L19).
- Invariant coupling: React `theme` state is synchronized from the DOM once on mount; subsequent synchronization is handled by `toggleTheme` (L33-L42).

---

**Open Questions:**
- No open questions.
