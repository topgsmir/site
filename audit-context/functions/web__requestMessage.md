## `requestMessage` in apps/web/src/components/admin/VendorManagement.tsx (L257-L270)

**Purpose:** Extracts a display string from the expected Axios error response shape or returns localized fallback copy (L257-L270).

---

**Inputs & Assumptions:**
- `error` (`unknown`): rejected request value. Trust: untrusted external/error data.
- `fallback` (`string`): trusted localized application copy supplied by `submitVendor` (L477).

---

**Outputs & Effects:**
- Returns joined array messages, a string message, or fallback (L258-L269).
- No state writes or external interactions.

---

**Block-by-Block:**

```tsx
// L258-L268
if (typeof error === "object" && error !== null && "response" in error) {
  const response = (error as { response?: { data?: { message?: string | string[] } } }).response;
  const message = response?.data?.message;
  if (Array.isArray(message)) return message.join(" ");
  if (typeof message === "string") return message;
}
```
- **What:** Checks only the top-level object/response property before accessing a cast nested shape with optional chaining.
- **Why here:** Recognized API messages take precedence over fallback.
- **Assumes:** array elements are suitable for implicit string joining; runtime element validation: nothing found.
- **Establishes:** recognized branches return a string.
- **Depended on by:** submit error state at L477.

```tsx
// L269
return fallback;
```
- **What:** Handles all unrecognized values.
- **Why here:** Provides deterministic user-facing copy after structural checks fail.
- **Assumes:** fallback is localized for the active component; established by caller `c.requestError` (L477).
- **Establishes:** the function always returns a value typed/inferred as string.
- **Depended on by:** error alert rendering (L694).

---

**Cross-Function Dependencies:**
- No project callees.
- Caller: `submitVendor` catch path (L476-L477).
- Shared state: none.
- Invariant coupling: API error-envelope convention determines whether server messages or fallback reach the UI.

---

**Open Questions:**
- unclear; need product/API contract to establish which server messages are intended for direct display.
