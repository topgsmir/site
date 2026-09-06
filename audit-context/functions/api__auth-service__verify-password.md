## `AuthService.verifyPassword` in apps/api/src/modules/auth/auth.service.ts (L255-L277)

**Purpose:** Parses the stored hash format, enforces expected parameters, derives a candidate key, and compares it in constant-time when lengths match (L255-L277).

---

**Inputs & Assumptions:**
- `password`: untrusted login string; `storedHash`: database value or trusted dummy constant (L93-L96).
- Precondition: base64 salt decodes to an acceptable salt buffer; explicit nonempty text check exists, but decoded length/encoding enforcement is nothing found (L258-L267, L273).

---

**Outputs & Effects:** Returns false for format/parameter mismatch; otherwise a promise of boolean after CPU work (L260-L276).

---

**Block-by-Block:**

```typescript
// L256-L269
const [algorithm, cost, blockSize, parallelism, salt, hash] = storedHash.split("$");
const expected = Buffer.from(hash ?? "", "base64");
if (...expected.length !== HASH_LENGTH || parameter mismatch...) return false;
```
- **What:** Parses and validates format parameters. **Why here:** derivation runs only for the expected scheme. **Assumes:** extra fields are irrelevant; exclusion is nothing found. **Establishes:** expected key is 64 bytes and constants match.

```typescript
// L271-L276
const actual = await this.scrypt(password, Buffer.from(salt, "base64"), expected.length);
return timingSafeEqual(actual, expected);
```
- **What:** Derives and compares. **Why here:** matching lengths satisfy timingSafeEqual's contract. **Assumes:** decoded salt is the stored salt. **Establishes:** true only for equal derived bytes. **Depended on by:** login gate (L93-L102).

---

**Cross-Function Dependencies:**
- Callees Buffer, `scrypt`, `timingSafeEqual` (L258, L271-L276). Caller `login`.
- Shared state: reads `users.password_hash` through login query.

---

**Open Questions:**
- unclear; need compatibility policy for future hash parameter upgrades.

