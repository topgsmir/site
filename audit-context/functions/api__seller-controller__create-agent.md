## `SellerController.createAgent` in apps/api/src/modules/seller/seller.controller.ts (L72-L77)

**Purpose:** Serves `POST /api/seller/agents`, creates a timestamp id, and appends the supplied object to process-local state (L72-L77).

---

**Inputs & Assumptions:**
- `body`: untrusted HTTP JSON typed only at compile time as `Omit<Agent,"id">` (L73); runtime field validation is established by: nothing found.
- Caller authorization is established by: nothing found; no guard decorates the route (L72-L77).
- Implicit clock uniqueness from `Date.now()`; collision exclusion is established by: nothing found (L74).

---

**Outputs & Effects:** Mutates `agents` and returns the new object (L74-L76); state survives within one process only (L23-L29).

---

**Block-by-Block:**

```typescript
// L73-L76
const agent = { ...body, id: `${Date.now()}` };
agents.push(agent);
return agent;
```
- **What:** Copies input, overwrites id, appends, returns. **Why here:** id is set before storage. **Assumes:** body has valid Agent fields; established by: nothing found. **Establishes:** returned/stored references describe the same created row. **Depended on by:** `listAgents`.

---

**Cross-Function Dependencies:**
- Callees Date.now/Array.push. Caller: HTTP route. Shared state: `agents` (L23-L29, L75).

---

**Open Questions:**
- unclear; need multi-process and restart behavior requirements.

