## `SellerController.list` in apps/api/src/modules/seller/seller.controller.ts (L79-L82)

**Purpose:** Serves `GET /api/seller/invites` by returning process-local invite records (L79-L82).

---

**Inputs & Assumptions:**
- No explicit inputs. Authorization/tenant restriction is established by: nothing found (L79-L82).

---

**Outputs & Effects:** Returns the shared `invitedSellers` array directly; no persistence (L12, L81).

---

**Block-by-Block:**

```typescript
// L79-L81
@Get("invites")
list() { return invitedSellers; }
```
- **What:** Exposes invite rows. **Why here:** sole route action. **Assumes:** in-memory records are the intended source of truth; established by: nothing found. **Establishes:** none. **Depended on by:** HTTP clients.

---

**Cross-Function Dependencies:**
- Callees: none. Caller: unguarded HTTP route. Shared state: appended by `create` (L84-L88).

---

**Open Questions:**
- unclear; need intended access and persistence semantics for invites.

