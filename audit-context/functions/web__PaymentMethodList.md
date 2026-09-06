## `PaymentMethodList` in apps/web/src/components/payment/PaymentMethodList.tsx (L6-L18)

**Purpose:** Renders the fixed supported payment-method catalog with localized names and descriptions (L6-L18).

---

**Inputs & Assumptions:**
- `locale` (`Locale`): expected supported locale.
- Precondition: translation keys exist for every method constant. Established at compile time by typed `t` calls (L4, L12-L13); runtime dictionary behavior is recorded in `web__t.md`.

---

**Outputs & Effects:**
- Returns three `PaymentMethodCard` elements from the fixed `METHODS` tuple (L4, L7-L17).
- No state, network, or persistence effects.

---

**Block-by-Block:**

```tsx
// L7-L16
<div className="panel-grid">
  {METHODS.map((method) => <PaymentMethodCard key={method} name={t(locale, ...)} description={t(locale, ...)} />)}
</div>
```
- **What:** Maps static method ids to localized presentation cards.
- **Why here:** Translation occurs before passing plain strings to the card.
- **Assumes:** the component is mounted only with a supported locale; callers in current source: nothing found.
- **Establishes:** one card per unique fixed method.
- **Depended on by:** no current caller found in `apps/web/src`.

---

**Cross-Function Dependencies:**
- Callee `t` (internal) and `PaymentMethodCard` (internal presentational component).
- Callers: nothing found in current web source.
- Shared state: translation dictionaries only.
- Invariant coupling: method list and translation namespaces are manually synchronized.

---

**Open Questions:**
- unclear; need intended route/component owner because no current render caller was found.
