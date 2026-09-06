## `AuthService.normalizeEmail` in apps/api/src/modules/auth/auth.service.ts (L224-L226)

**Purpose:** Canonicalizes email keys by trimming surrounding whitespace and lowercasing (L224-L226).

---

**Inputs & Assumptions:**
- `email`: untrusted but validated email string at register caller (`register.dto.ts:L9-L11`).

---

**Outputs & Effects:** Returns normalized string; no state changes (L225).

---

**Block-by-Block:**

```typescript
// L224-L226
return email.trim().toLowerCase();
```
- **What:** Trims and lowercases. **Why here:** normalization precedes unique insertion (L53-L64). **Assumes:** this is the desired identity equivalence; broader provider-specific equivalence is established by: nothing found. **Establishes:** stored registration email has no edge whitespace and is lowercase. **Depended on by:** `register` (L53).

---

**Cross-Function Dependencies:**
- Callees: string runtime methods. Caller: `register` only (`rg` call search; L53).
- Shared state coupling: login applies the same trim/lowercase directly (L83).

---

**Open Questions:**
- unclear; need identity policy for internationalized/provider-specific email normalization.

