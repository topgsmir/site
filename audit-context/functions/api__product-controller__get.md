## `ProductController.get` in apps/api/src/modules/product/product.controller.ts (L56-L59)

**Purpose:** Implements `GET /api/products/:id` and returns the first process-local product whose id or slug equals the path value (L35, L56-L59; `main.ts:L21`).

---

**Inputs & Assumptions:**
- `id` (`string`): untrusted route parameter (L56-L58).
- Implicit input: module-level `products` array (L20-L29).
- Precondition: ids and slugs identify at most one product if deterministic identity is required; nothing found enforces this across seed data and `create` (L21-L28, L44-L52).

---

**Outputs & Effects:** Returns the first matching product object or `null`; no state mutation (L58). The method does not throw or select an HTTP not-found status locally.

---

**Block-by-Block:**

```typescript
// L56-L59
@Get(":id")
get(@Param("id") id: string) {
  return products.find((item) => item.id === id || item.slug === id) ?? null;
}
```
- **What:** Searches by either identifier field. **Why here:** this is the only operation in the lookup handler. **Assumes:** first-match semantics are acceptable when fields collide; nothing found establishes uniqueness. **Establishes:** a non-null return matched one of the two equality tests. **Depended on by:** product detail HTTP consumers; no repository client call was found.

---

**Cross-Function Dependencies:**
- Callee `Array.find` (language built-in) at L58.
- Callers: HTTP clients via controller/module registration (`product.module.ts:L4-L6`). No route guard is declared (L35-L59).
- Shared state: reads `products`, written by `create` at L52.

---

**Open Questions:**
- unclear; need API response policy to know whether `null` is the intended missing-record representation.

