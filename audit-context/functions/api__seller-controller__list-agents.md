## `SellerController.listAgents` in apps/api/src/modules/seller/seller.controller.ts (L67-L70)

**Purpose:** Serves `GET /api/seller/agents` from the process-local agent array (L67-L70, L23-L29).

---

**Inputs & Assumptions:**
- No explicit inputs. Caller identity/tenant is not used; authorization requirement is established by: nothing found (L67-L70).

---

**Outputs & Effects:** Returns the shared mutable array object directly (L69); no copy or persistence.

---

**Block-by-Block:**

```typescript
// L67-L69
@Get("agents")
listAgents() { return agents; }
```
- **What:** Returns in-memory rows. **Why here:** sole route action. **Assumes:** process-local data is authoritative and safe to expose; established by: nothing found. **Establishes:** no new state. **Depended on by:** HTTP client.

---

**Cross-Function Dependencies:**
- Callees: none. Caller: anonymous HTTP clients; no guard at L67-L70.
- Shared state: `agents`, also appended by `createAgent` (L72-L76).

---

**Open Questions:**
- unclear; need intended audience and persistence/source-of-truth requirements for agents.

