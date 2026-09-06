## `PaymentMethodCard` in apps/web/src/components/payment/PaymentMethodCard.tsx (L6-L13)

**Purpose:** Renders a payment method name and description as a presentational card (L6-L13).

---

**Inputs & Assumptions:**
- `name`, `description` (`string`): localized application strings from `PaymentMethodList` (`PaymentMethodList.tsx:L9-L14`).
- No implicit state.

---

**Outputs & Effects:** Returns semantic article/heading/paragraph markup; React escapes string children by framework contract (L7-L12). No effects.

---

**Block-by-Block:**

```tsx
// L7-L12
return <article className="card"><h4>{name}</h4><p>{description}</p></article>;
```
- **What:** Places plain string props in text positions.
- **Why here:** This component owns only presentation.
- **Assumes:** heading level fits its eventual page hierarchy; current page caller: nothing found.
- **Establishes:** no raw HTML interpretation is requested.
- **Depended on by:** `PaymentMethodList`.

---

**Cross-Function Dependencies:**
- No project callees.
- Caller: `PaymentMethodList` (L10-L14), itself currently unreferenced.
- Shared state: none.
- Invariant coupling: none.

---

**Open Questions:**
- unclear; need intended page placement to assess heading hierarchy.
