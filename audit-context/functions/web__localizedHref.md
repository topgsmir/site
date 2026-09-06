## `localizedHref` in apps/web/src/components/landing/LandingPage.tsx (L279-L281)

**Purpose:** Wraps the shared locale path builder for typed Next routes (L279-L281).

---

**Inputs & Assumptions:**
- `locale` (`Locale`): page-validated.
- `href` (`string`): application-controlled at current call site (`"/seller-dashboard"`, L425).

---

**Outputs & Effects:** Returns `localizePath(locale, href)` cast to `Route`; no effects (L280).

---

**Block-by-Block:**

```tsx
// L280
return localizePath(locale, href) as Route;
```
- **What:** Prefixes path with locale and asserts framework route type.
- **Why here:** Isolates the type assertion from JSX.
- **Assumes:** arbitrary `href` is a valid internal route. Compile-time/runtime establishment beyond current constant call: nothing found.
- **Establishes:** output follows `localizePath` normalization rules (`locales.ts:L14-L16`).
- **Depended on by:** seller-dashboard footer link (L425).

---

**Cross-Function Dependencies:**
- Callee `localizePath` (internal): ensures a leading slash and prefixes locale (`locales.ts:L14-L16`; record `web__localizePath.md`).
- Caller: `LandingPage` footer (L425).
- Shared state: none.
- Invariant coupling: destination page independently authorizes seller roles.

---

**Open Questions:**
- No open questions.
