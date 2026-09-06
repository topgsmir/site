## `ThemeToggle` in apps/web/src/components/theme/ThemeToggle.tsx (L26-L66)

**Purpose:** Exposes the localized global light/dark-theme control and keeps its rendered label/pressed state aligned with local theme state (L26-L66).

---

**Inputs & Assumptions:**
- `locale` (`Locale`): trusted after `LocaleLayout` validation (`layout.tsx:L55-L58`, L67).
- Implicit: root DOM theme initialized by `themeScript`, React state, and storage (L27-L43; `layout.tsx:L36-L53`).
- Precondition: `labels` has both actions for every `Locale`. Established by the typed record at L8-L12.

---

**Outputs & Effects:**
- On mount, reads the root theme into React state (L29-L31).
- Renders a button whose accessible label, title, and pressed state reflect the local theme (L45-L55).
- On click, invokes `toggleTheme`, which mutates DOM/state/storage (L33-L43, L55).

---

**Block-by-Block:**

```tsx
// L27-L31
const [theme, setTheme] = useState<Theme>("light");
useEffect(() => { setTheme(readTheme()); }, []);
```
- **What:** Starts with a server-compatible value, then hydrates from DOM after mount.
- **Why here:** Browser DOM is not read during server rendering.
- **Assumes:** a transient light render is covered by the root dataset and hydration suppression in the layout (`layout.tsx:L61`).
- **Establishes:** after the effect, local state reflects the then-current root dataset.
- **Depended on by:** label and pressed calculations (L45-L54).

```tsx
// L45-L55
const isDark = theme === "dark";
const label = isDark ? labels[locale].light : labels[locale].dark;
return <button ... aria-pressed={isDark} onClick={toggleTheme}>...</button>;
```
- **What:** Renders the control as the action opposite the current theme.
- **Why here:** Presentation derives only from state established above.
- **Assumes:** local `theme` remains synchronized with DOM. Established on mount and this component's clicks; other writers after mount: nothing found.
- **Establishes:** accessible state is internally consistent with local state.
- **Depended on by:** users of every localized route through `LocaleLayout`.

---

**Cross-Function Dependencies:**
- Callees `readTheme`, `toggleTheme`, and through it `applyTheme` (L29-L43).
- Caller: `LocaleLayout` for every supported locale (layout `L67`).
- Shared state: root DOM theme and storage with `themeScript`.
- Invariant coupling: label vocabulary is locale-indexed while visual state is global browser state.

---

**Open Questions:**
- unclear; need runtime/CSS inspection to determine whether root dataset alone or `colorScheme` is the canonical visual source.
