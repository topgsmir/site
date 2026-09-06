## `ProductController.list` in apps/api/src/modules/product/product.controller.ts (L37-L40)

**Purpose:** Implements `GET /api/products` and returns all process-local products ordered newest-first by their timestamp strings (L35-L40; `main.ts:L21`).

---

**Inputs & Assumptions:**
- No explicit parameters. Implicit input: module-level `products` array seeded at L20-L29 and extended by `create` at L52.
- Precondition: every `createdAt` string is lexicographically sortable in chronological order; seeded values and `toISOString()` satisfy this (L21-L28, L50).

---

**Outputs & Effects:** Returns a newly allocated sorted array whose elements are the original mutable product objects (L39). It does not reorder the module-level array because it sorts `[...products]`.

---

**Block-by-Block:**

```typescript
// L37-L40
@Get()
list() {
  return [...products].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
```
- **What:** Copies and sorts products descending by `createdAt`. **Why here:** the copy prevents `sort` from changing storage order. **Assumes:** all stored rows contain valid strings; seed construction and `create` establish this on visible insertion paths (L20-L29, L45-L52). **Establishes:** returned array order is descending under `localeCompare`; item identity is unchanged. **Depended on by:** homepage collection fetch at `apps/web/src/app/[locale]/page.tsx:L98-L101`.

---

**Cross-Function Dependencies:**
- Callees array spread, `Array.sort`, and `String.localeCompare` (language/runtime built-ins) at L39.
- Callers: HTTP clients; `ProductModule` registers the controller (`product.module.ts:L4-L6`). No route guard is declared on this controller or globally in `AppModule` (`product.controller.ts:L35-L40`, `app.module.ts:L12-L27`).
- Shared state: reads the `products` array also written by `ProductController.create` (L20-L29, L52).

---

**Open Questions:**
- unclear; need process topology to know whether callers can observe different arrays across API instances or after restarts.

