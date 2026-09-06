## `LocaleLayout` in apps/web/src/app/[locale]/layout.tsx (L36-L71)

**Purpose:** Validates the locale route boundary, configures root language/direction/theme, renders child routes, and mounts the theme control (L55-L70).

---

**Inputs & Assumptions:**
- `children` (`ReactNode`): nested route output; trust: trusted framework composition (L7-L12, L66).
- `params.locale` (`string`): URL-derived, untrusted until L56.
- Implicit client storage/media/document state used by inline `themeScript` (L36-L53).
- Precondition: `themeScript` is static application-owned text. Established by the constant literal (L36-L53).

---

**Outputs & Effects:**
- Calls `notFound` for unsupported locale strings (L56-L58).
- Returns the root `html`, `head`, and `body`, with locale language/direction, pre-hydration theme script, children, and `ThemeToggle` (L60-L69).
- In the browser, inline script reads `localStorage['topgsm-theme']` and media preference, mutates `documentElement` theme/color scheme, and updates theme-color metadata; falls back to light dataset on exceptions (L36-L52).

---

**Block-by-Block:**

```tsx
// L55-L58
if (!isLocale(params.locale)) { notFound(); }
```
- **What:** Rejects unsupported locale route params.
- **Why here:** Establishes narrowing before dictionary, direction, and component use.
- **Assumes:** `notFound` does not return normally. Established by Next.js framework contract; TypeScript narrowing is relied upon at L61/L67.
- **Establishes:** normal rendering uses a supported locale.
- **Depended on by:** `getDirection` and `ThemeToggle` props.

```tsx
// L61-L68
<html lang={params.locale} dir={getDirection(params.locale)} suppressHydrationWarning>
  <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
  <body>{children}<ThemeToggle locale={params.locale} /></body>
</html>
```
- **What:** Builds document shell and executes fixed pre-hydration theme logic.
- **Why here:** Root attributes and theme are applied before nested UI hydration.
- **Assumes:** CSP/deployment permits this inline script. Established by: nothing found in `apps/web` configuration.
- **Establishes:** root language/direction and initial theme dataset for descendants.
- **Depended on by:** all localized pages and theme CSS.

---

**Cross-Function Dependencies:**
- Callee `isLocale` (internal): exact allowlist (`locales.ts:L6-L8`).
- Callee `getDirection` (internal): RTL for Persian/Arabic (`locales.ts:L10-L12`).
- Callee `ThemeToggle` (internal): reads and mutates the same document theme (`ThemeToggle.tsx:L14-L43`).
- Callee `notFound` (framework): terminates invalid routes.
- Callers: Next.js for every `[locale]` subtree route.
- Shared state: browser `localStorage`, root DOM dataset/style, theme-color meta (L39-L50).
- Invariant couplings: initial script and `ThemeToggle.applyTheme` use the same storage key and colors (`ThemeToggle.tsx:L18-L23`, L38-L40).

---

**Open Questions:**
- unclear; need response-header configuration to establish the effective content-security policy for the inline script.

