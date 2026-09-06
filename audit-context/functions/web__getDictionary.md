## `getDictionary` in apps/web/src/lib/i18n/index.ts (L57-L59)

**Purpose:** Returns the nested translation dictionary for a supported locale.

---

**Inputs & Assumptions:**
- `locale` (`Locale`): supported locale.
- Precondition: dictionary map covers all locales. Established by `satisfies Record<Locale, NestedDict>` (L28-L32).

---

**Outputs & Effects:**
- Returns the shared nested dictionary object at `DICTIONARIES[locale]` (L58).
- No mutation performed; callers receive the original object reference.

---

**Block-by-Block:**

```ts
// L57-L59
return DICTIONARIES[locale];
```
- **What:** Indexes the dictionary table.
- **Why here:** Login page passes the `auth` subtree to its client component (`login/page.tsx:L19-L24`).
- **Assumes:** callers do not mutate the returned shared object. Established by: nothing found at runtime; current caller only reads it.
- **Establishes:** returned object corresponds to the requested supported locale.
- **Depended on by:** `LoginPage`.

---

**Cross-Function Dependencies:**
- No callees.
- Callers: login page (`login/page.tsx:L22`).
- Shared state: `DICTIONARIES` module object (L28-L32).
- Invariant couplings: login copy shape is expected by `LoginFormProps`; TypeScript checks the current access path.

---

**Open Questions:**
- No open questions.

