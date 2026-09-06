## `isLocale` in apps/web/src/lib/i18n/locales.ts (L6-L8)

**Purpose:** Runtime-narrows an untrusted string to the supported locale union.

---

**Inputs & Assumptions:**
- `value` (`string`): typically a URL segment; trust: untrusted (`middleware.ts:L5-L8`, locale layout L55-L58).
- Precondition: `locales` is the complete supported-locale set. Established by the declaration `['fa','en','ar']` (L1).

---

**Outputs & Effects:**
- Returns whether `value` exactly matches a supported locale (L7).
- No state writes or external calls.

---

**Block-by-Block:**

```ts
// L6-L8
export function isLocale(value: string): value is Locale {
  return locales.includes(value as Locale);
}
```
- **What:** Performs exact array membership testing.
- **Why here:** Connects runtime validation to TypeScript narrowing.
- **Assumes:** case-sensitive locale codes are intentional. Established by literals at L1.
- **Establishes:** true means one of `fa`, `en`, `ar`.
- **Depended on by:** middleware, locale layout, home/login/admin/seller pages.

---

**Cross-Function Dependencies:**
- No non-runtime callees.
- Callers: `middleware.ts:L8`; locale layout L56; home metadata/page L64/L96; login page L17; admin page L24; seller page L23.
- Shared state: immutable `locales` array (L1).
- Invariant couplings: dictionary indexing and direction selection rely on this narrowing before route params are cast to `Locale`.

---

**Open Questions:**
- No open questions.

