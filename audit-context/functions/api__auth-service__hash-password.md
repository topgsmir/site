## `AuthService.hashPassword` in apps/api/src/modules/auth/auth.service.ts (L242-L253)

**Purpose:** Creates a random salt, derives a fixed-length scrypt key, and serializes algorithm parameters with both values (L242-L253).

---

**Inputs & Assumptions:**
- `password`: untrusted validated input passed through the public hashing method (L133-L135).
- Implicit secure randomness from Node `randomBytes` (L243); its runtime guarantee is external-source-available.

---

**Outputs & Effects:** Returns a promise of `$`-delimited hash string; consumes randomness/CPU (L243-L252).

---

**Block-by-Block:**

```typescript
// L243-L252
const salt = randomBytes(16);
const derivedKey = await this.scrypt(password, salt, HASH_LENGTH);
return ["scrypt", SCRYPT_COST, SCRYPT_BLOCK_SIZE, SCRYPT_PARALLELISM, salt.toString("base64"), derivedKey.toString("base64")].join("$");
```
- **What:** Salts, derives, serializes. **Why here:** parameters travel with the stored digest for verification. **Assumes:** delimiter cannot occur in base64 fields; established by base64 alphabet. **Establishes:** verifier-readable six-field format with 64-byte derived key. **Depended on by:** registration/vendor password writes.

---

**Cross-Function Dependencies:**
- Callees Node `randomBytes`, internal `scrypt` (L243-L244). Caller `createPasswordHash` (L134).
- Shared state: output persists in `users.password_hash` (`schema.prisma:L53`).

---

**Open Questions:**
- No open questions.

