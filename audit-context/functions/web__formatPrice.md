## `formatPrice` in apps/web/src/components/landing/LandingPage.tsx (L270-L273)

**Purpose:** Formats a product price for localized card display or returns localized details copy when price is absent (L270-L273).

---

**Inputs & Assumptions:**
- `product` (`HomepageProduct`): API/fallback data; semi-trusted at runtime.
- `locale` (`Locale`): page-validated.
- Precondition: present price is a number suitable for `Intl.NumberFormat`; runtime finite/range validation here: nothing found.

---

**Outputs & Effects:**
- Returns localized details text when `price === undefined` (L271).
- Otherwise returns a zero-fraction formatted number plus Persian toman text or `product.currency ?? "IRR"` (L272).
- No state writes.

---

**Block-by-Block:**

```tsx
// L271-L272
if (product.price === undefined) return ...;
return new Intl.NumberFormat(..., { maximumFractionDigits: 0 }).format(product.price) + ...;
```
- **What:** Chooses missing-price copy or locale-sensitive number/currency display.
- **Why here:** Centralizes card price presentation.
- **Assumes:** Persian prices are denominated for the hard-coded toman suffix regardless of `product.currency`; establishment: nothing found in this function.
- **Establishes:** any valid numeric input is displayed without fractional digits.
- **Depended on by:** product cards at L399.

---

**Cross-Function Dependencies:**
- Callee `Intl.NumberFormat` (external runtime).
- Caller: `LandingPage` product mapping.
- Shared state: none.
- Invariant coupling: API price/currency semantics determine whether the rendered suffix matches source denomination.

---

**Open Questions:**
- unclear; need product API monetary-unit contract, especially the Persian locale convention.
