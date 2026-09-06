## `t` in apps/web/src/lib/i18n/index.ts (L53-L55)

**Purpose:** Resolves a localized string with Persian and key-name fallbacks.

---

**Inputs & Assumptions:**
- `locale` (`Locale`): supported locale.
- `key` (`TranslationKey`): compile-time leaf key derived from the Persian dictionary (L26, L53).
- Precondition: `FLAT[locale]` exists. Established by the `Record<Locale, Dict>` construction (L47-L51).

---

**Outputs & Effects:**
- Returns locale string, else Persian string, else the dotted key (L54).
- No state writes.

---

**Block-by-Block:**

```ts
// L53-L55
return FLAT[locale][key] ?? FLAT.fa[key] ?? key;
```
- **What:** Applies two fallback layers.
- **Why here:** Keeps rendering total when a runtime entry is absent.
- **Assumes:** missing translations may be represented by the key without stopping rendering. Established explicitly by final fallback.
- **Establishes:** always returns a string.
- **Depended on by:** `PaymentMethodList` and seller dashboard (`PaymentMethodList.tsx:L12-L13`; seller page L32-L37).

---

**Cross-Function Dependencies:**
- Reads `FLAT`, created via `flatten` (L47-L54).
- Callers cited above.
- Shared state: immutable-by-convention `FLAT`; no writers found after initialization.
- Invariant couplings: accepted keys reflect the Persian dictionary shape only (L26).

---

**Open Questions:**
- No open questions beyond locale parity tracked in `flatten`.

