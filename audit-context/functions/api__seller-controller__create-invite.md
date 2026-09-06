## `SellerController.create` in apps/api/src/modules/seller/seller.controller.ts (L84-L89)

**Purpose:** Serves `POST /api/seller/invites`, adds an `invited` status, and stores the result in process memory (L84-L89).

---

**Inputs & Assumptions:**
- `body`: untrusted HTTP JSON with compile-time-only inline type (L6-L10, L85); runtime validation is established by: nothing found.
- Caller authorization is established by: nothing found (L84-L89).

---

**Outputs & Effects:** Appends to `invitedSellers` and returns the row (L86-L88).

---

**Block-by-Block:**

```typescript
// L85-L88
const row = { ...body, status: "invited" as const };
invitedSellers.push(row);
return row;
```
- **What:** Copies body, fixes status, appends. **Why here:** status is assigned before storage. **Assumes:** input fields are valid and safe to return; established by: nothing found. **Establishes:** stored row status is invited. **Depended on by:** invite list.

---

**Cross-Function Dependencies:**
- Callee Array.push. Caller: unguarded HTTP route. Shared state: `invitedSellers` (L12, L87).

---

**Open Questions:**
- unclear; need relationship between these in-memory invites and persistent vendor records.

