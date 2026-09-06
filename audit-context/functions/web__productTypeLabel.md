## `productTypeLabel` in apps/web/src/components/landing/LandingPage.tsx (L261-L268)

**Purpose:** Maps a product type to its localized fallback category label (L261-L268).

---

**Inputs & Assumptions:**
- `type` (`HomepageProduct["type"]`) and `locale` (`Locale`): server-page supplied product data and validated locale.
- Precondition: runtime values are keys in both nested records. TypeScript establishes this statically; fetched collection runtime validation is nothing found (`app/[locale]/page.tsx:L52-L60`).

---

**Outputs & Effects:** Returns `labels[locale][type]`; no effects (L267).

---

**Block-by-Block:**

```tsx
// L262-L267
const labels = { fa: {...}, en: {...}, ar: {...} } as const;
return labels[locale][type];
```
- **What:** Performs a two-key localized lookup.
- **Why here:** Used only when a product has no category (L399).
- **Assumes:** locale/type are supported at runtime; locale is page-validated, product type response validation: nothing found.
- **Establishes:** valid inputs yield application-owned text.
- **Depended on by:** product cards (L395-L400).

---

**Cross-Function Dependencies:**
- No callees.
- Caller: `LandingPage` product mapping (L399).
- Shared state: none.
- Invariant coupling: `HomepageProduct.type` must match API/fallback product type vocabulary.

---

**Open Questions:**
- unclear; need products API response contract to establish runtime type validation.
