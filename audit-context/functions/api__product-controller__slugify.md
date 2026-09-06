## `slugify` in apps/api/src/modules/product/product.controller.ts (L31-L33)

**Purpose:** Derives a URL-like slug from a supplied product title when creation does not include a truthy slug (L31-L33, L48).

---

**Inputs & Assumptions:**
- `value` (`string`): originates from an HTTP request body through `ProductController.create` (L43-L48). Trust: untrusted.
- Precondition: `value` is a string supporting `trim` and `toLowerCase`; the compile-time alias says `string` (L3-L11), but no runtime DTO class/decorators establish it; nothing found.

---

**Outputs & Effects:** Returns a lowercased, trimmed string whose whitespace runs become `-` and whose remaining characters are limited to ASCII letters/digits, Persian/Arabic code points U+0600–U+06FF, and hyphen (L31-L32). It does not mutate shared state.

---

**Block-by-Block:**

```typescript
// L31-L32
function slugify(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9\u0600-\u06ff-]/g, "");
}
```
- **What:** Normalizes and filters the string. **Why here:** it is called while assembling a new product before insertion (L45-L52). **Assumes:** JavaScript lowercase and the explicit character range match the desired slug alphabet; no separate policy found. **Establishes:** any returned characters satisfy the final regular expression's allowlist. **Depended on by:** `ProductController.create` fallback selection at L48.

---

**Cross-Function Dependencies:**
- Callees `String.trim`, `toLowerCase`, and `replace` (language built-ins) at L32.
- Caller: `ProductController.create` only (L48; repository search found no other call).
- Shared state: none.

---

**Open Questions:**
- unclear; need product URL/uniqueness policy to know whether normalization must be unique or stable across locale rules.

