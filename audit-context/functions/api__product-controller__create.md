## `ProductController.create` in apps/api/src/modules/product/product.controller.ts (L42-L54)

**Purpose:** Implements `POST /api/products`, constructs a product from request data plus generated defaults, appends it to process-local storage, and returns it (L35, L42-L54; `main.ts:L21`).

---

**Inputs & Assumptions:**
- `body` (`CreateProductDto` type alias): untrusted HTTP JSON (L3-L11, L43).
- Preconditions: `sellerId`, `title`, `type`, and `price` have the declared runtime shapes; the type alias is erased and no DTO decorators or local checks establish them; nothing found (L3-L11, L43-L51).
- Precondition: a supplied truthy `slug` is acceptable and unique, and `sellerId` identifies the intended seller; nothing found (L46-L49).

---

**Outputs & Effects:** Creates an id from the current millisecond time, fills slug/currency/timestamp defaults, pushes the object into the module-level array, and returns the same object reference (L44-L53). State survives requests in this process but is not database-backed (L20-L29, L52).

---

**Block-by-Block:**

```typescript
// L44-L51
const id = `${Date.now()}`;
const item: Product = {
  ...body,
  id,
  slug: body.slug || slugify(body.title) || id,
  currency: body.currency ?? "IRR",
  createdAt: new Date().toISOString()
};
```
- **What:** Combines request fields with server-generated fields. **Why here:** the completed object is needed before insertion. **Assumes:** millisecond time is sufficient as an identifier and supplied body data is valid; nothing found for either. **Establishes:** generated `id`, non-empty fallback slug, non-nullish currency, and ISO timestamp on the constructed object. **Depended on by:** insertion and response at L52-L53.

```typescript
// L52-L53
products.push(item);
return item;
```
- **What:** Publishes the product to future reads and returns it. **Why here:** construction completes first. **Assumes:** process-local append is the intended persistence boundary. **Establishes:** subsequent `list`/`get` calls in the same process can find this object. **Depended on by:** `list` (L37-L40) and `get` (L56-L59).

---

**Cross-Function Dependencies:**
- Callee `slugify` (internal, L31-L33): trims, lowercases, hyphenates whitespace, and filters characters; it requires a string.
- Callees `Date.now`, `new Date().toISOString`, and `Array.push` (runtime built-ins) at L44, L50, L52.
- Callers: HTTP clients via `ProductModule` (`product.module.ts:L4-L6`). No guard is declared on the controller or method (L35-L54), and no global guard is registered in `AppModule` (`app.module.ts:L12-L27`).
- Shared state: writes `products`, read by `list` and `get` (L20-L29, L37-L40, L56-L59).
- Invariant coupling: lookup accepts either `id` or `slug` (L58), so uniqueness of both fields governs which item `get` returns; uniqueness is established by nothing found.

---

**Open Questions:**
- unclear; need product ownership and creation policy to know which callers may choose `sellerId` and supplied slugs.
- unclear; need persistence/process requirements for restart and multi-instance behavior.

