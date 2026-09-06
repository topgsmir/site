## `AuthService.encodeJson` in apps/api/src/modules/auth/auth.service.ts (L220-L222)

**Purpose:** JSON-serializes an object and base64url-encodes it for token segments (L220-L222).

---

**Inputs & Assumptions:**
- `value`: trusted internal plain object from token header/payload callers (L154-L155).
- Precondition: JSON serialization succeeds and is deterministic for the immediate input; established by plain data construction at L139-L145 and literal header at L154.

---

**Outputs & Effects:** Returns a base64url string; no persistent effects (L221).

---

**Block-by-Block:**

```typescript
// L220-L222
return Buffer.from(JSON.stringify(value)).toString("base64url");
```
- **What:** Serializes then encodes. **Why here:** shared by both signed segments. **Assumes:** UTF-8 Buffer default is appropriate; established by Node Buffer contract. **Establishes:** delimiter-safe token segment. **Depended on by:** `signToken` (L154-L155).

---

**Cross-Function Dependencies:**
- Callees JSON.stringify and Buffer (runtime) (L221). Caller `signToken`.
- Shared state: none.

---

**Open Questions:**
- No open questions.

