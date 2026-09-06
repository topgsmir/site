## `OrderController.list` in apps/api/src/modules/order/order.controller.ts (L33-L36)

**Purpose:** Implements `GET /api/orders` and exposes the process-local order collection (L26, L33-L36; `main.ts:L21`).

---

**Inputs & Assumptions:**
- No explicit inputs. Implicit input: module-level `orders`, initially empty and appended by `create` (L24, L46).
- Precondition: returning all stored orders is appropriate for every caller reaching the route; no guard or caller-derived filter is declared, so establishment is nothing found (L26-L36; `app.module.ts:L12-L27`).

---

**Outputs & Effects:** Returns the actual `orders` array reference to Nest serialization, not a copy (L35). It does not directly mutate state.

---

**Block-by-Block:**

```typescript
// L33-L36
@Get()
list() {
  return orders;
}
```
- **What:** Returns all in-memory orders. **Why here:** it is the whole handler. **Assumes:** process-local state and unfiltered collection semantics match the API contract; nothing found documents that contract. **Establishes:** returned items are precisely the entries currently in this process's array. **Depended on by:** HTTP consumers; none found in repository source.

---

**Cross-Function Dependencies:**
- No callees.
- Callers: HTTP clients through `OrderModule` (`order.module.ts:L6-L9`).
- Shared state: reads `orders`, written and later mutated by `create` and `updateStatus` (L24, L46, L60-L65).

---

**Open Questions:**
- unclear; need order visibility/tenancy policy and deployment topology.

