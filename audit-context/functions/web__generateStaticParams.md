## `generateStaticParams` in apps/web/src/app/[locale]/layout.tsx (L14-L16)

**Purpose:** Enumerates supported locale route params for static generation.

---

**Inputs & Assumptions:**
- Implicit: shared `locales` array imported at L4.
- Precondition: every supported locale should receive a route tree. Established by `locales.ts:L1` and the map at L15.

---

**Outputs & Effects:**
- Returns `[{locale:'fa'},{locale:'en'},{locale:'ar'}]` from the current locale list (L15).
- No effects.

---

**Block-by-Block:**

```tsx
// L14-L16
return locales.map((locale) => ({ locale }));
```
- **What:** Converts locale strings to route-param objects.
- **Why here:** Next.js consumes it during route generation.
- **Assumes:** locale array values are valid directory params. Established by literal declaration (`locales.ts:L1`).
- **Establishes:** static params and runtime locale allowlist share one source.
- **Depended on by:** Next.js App Router build/runtime.

---

**Cross-Function Dependencies:**
- No project callees.
- Caller: Next.js framework.
- Shared state: immutable locale list.
- Invariant couplings: `LocaleLayout` still rejects runtime values outside the list (L55-L58).

---

**Open Questions:**
- No open questions.

