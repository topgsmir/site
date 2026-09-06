## `getDirection` in apps/web/src/lib/i18n/locales.ts (L10-L12)

**Purpose:** Maps a supported locale to document text direction.

---

**Inputs & Assumptions:**
- `locale` (`Locale`): supported locale; trust: trusted by type and route validation.
- Precondition: Persian and Arabic are RTL while English is LTR. Established explicitly by L11.

---

**Outputs & Effects:**
- Returns `rtl` for `fa`/`ar`, otherwise `ltr` (L11).
- No effects.

---

**Block-by-Block:**

```ts
// L10-L12
return locale === "fa" || locale === "ar" ? "rtl" : "ltr";
```
- **What:** Selects direction.
- **Why here:** Centralizes layout direction for root HTML and landing shell.
- **Assumes:** `Locale` remains synchronized with this conditional; TypeScript ensures current callers pass the union, but future union expansion would take the LTR fallback.
- **Establishes:** direction string for current locales.
- **Depended on by:** locale layout (`layout.tsx:L61`) and `LandingPage` (`LandingPage.tsx:L301`).

---

**Cross-Function Dependencies:**
- No callees.
- Callers cited above.
- Shared state: none.
- Invariant couplings: route locale validation precedes root layout usage (layout L55-L61).

---

**Open Questions:**
- No open questions.

