## `AuthService.createPasswordHash` in apps/api/src/modules/auth/auth.service.ts (L133-L135)

**Purpose:** Public service boundary for password hashing used by registration and vendor administration (L133-L135).

---

**Inputs & Assumptions:**
- `password`: untrusted but DTO-constrained string at both callers (`register.dto.ts:L13-L16`, `vendor.dto.ts:L49-L52`, L98-L102).

---

**Outputs & Effects:** Returns the promise produced by `hashPassword`; consumes randomness and CPU through that callee (L134, L242-L252).

---

**Block-by-Block:**

```typescript
// L133-L135
createPasswordHash(password: string) { return this.hashPassword(password); }
```
- **What:** Delegates hashing. **Why here:** exposes hashing without exposing private implementation. **Assumes:** caller supplied a policy-valid password; established by global DTO validation for known HTTP callers. **Establishes:** no independent invariant beyond the callee. **Depended on by:** `register`, `SellerService.createVendor/updateVendor` (L58; `seller.service.ts:L34`, L93-L95).

---

**Cross-Function Dependencies:**
- Callee `hashPassword` (internal) (L242-L253). Callers listed above.
- Shared state: none; external randomness from `randomBytes` inside callee (L243).

---

**Open Questions:**
- No open questions.

