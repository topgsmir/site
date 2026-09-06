## `LanguageSwitcher` in apps/web/src/components/landing/LandingPage.tsx (L283-L293)

**Purpose:** Renders links to the root page in each supported locale and identifies the active locale (L283-L293).

---

**Inputs & Assumptions:**
- `locale` (`Locale`): validated by `HomePage` before `LandingPage` render (`app/[locale]/page.tsx:L95-L101`, L142).
- Locale options are the application-owned literal array at L286.

---

**Outputs & Effects:** Returns three Next links whose destinations come from `localizePath(code)` and whose active item receives class/`aria-current` (L284-L292).

---

**Block-by-Block:**

```tsx
// L285-L290
{(["fa", "en", "ar"] as Locale[]).map((code) => (
  <Link ... href={localizePath(code) as Route} ... hrefLang={code}>{code.toUpperCase()}</Link>
))}
```
- **What:** Enumerates fixed locale-root destinations.
- **Why here:** Language navigation is colocated with active-state semantics.
- **Assumes:** literal options stay synchronized with the central locale list. Established manually; central `locales` constant is elsewhere (`locales.ts:L1`).
- **Establishes:** generated destinations are internal localized roots.
- **Depended on by:** `LandingPage` header (L314).

---

**Cross-Function Dependencies:**
- Callee `localizePath` (internal) and Next `Link`.
- Caller: `LandingPage` (L314).
- Shared state: locale vocabulary duplicated with `locales.ts`.
- Invariant coupling: `LocaleLayout` validates these route segments.

---

**Open Questions:**
- unclear; need localization requirements to know whether switching should retain the current subpath rather than return to locale root.
