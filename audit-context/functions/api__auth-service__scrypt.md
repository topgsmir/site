## `AuthService.scrypt` in apps/api/src/modules/auth/auth.service.ts (L279-L297)

**Purpose:** Wraps callback-based Node scrypt in a typed promise with fixed work parameters and memory ceiling (L279-L297).

---

**Inputs & Assumptions:**
- `password`: untrusted string; `salt`: caller-created/decoded Buffer; `keyLength`: trusted internal number (L279, callers L244 and L271-L275).
- Precondition: arguments satisfy Node scrypt bounds; enforced by known callers for key length, while decoded salt bounds are established by: nothing found.

---

**Outputs & Effects:** Resolves derived-key Buffer or rejects the Node error; consumes CPU/memory (L280-L296).

---

**Block-by-Block:**

```typescript
// L280-L295
return new Promise((resolve, reject) => {
  nodeScrypt(password, salt, keyLength, { N: ..., r: ..., p: ..., maxmem: ... }, (error, derivedKey) => {
    if (error) reject(error); else resolve(derivedKey);
  });
});
```
- **What:** Adapts callback completion to promise settlement. **Why here:** callers can await one derivation primitive. **Assumes:** Node crypto enforces the option contract; external-source-available. **Establishes:** exactly one resolve/reject follows callback invocation. **Depended on by:** hash and verify (L244, L271).

---

**Cross-Function Dependencies:**
- Callee Node `crypto.scrypt` (external-source-available) (L281-L295). Callers `hashPassword`, `verifyPassword`.
- Shared state: none.

---

**Open Questions:**
- No open questions.
