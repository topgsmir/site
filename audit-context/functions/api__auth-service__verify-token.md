## `AuthService.verifyToken` in apps/api/src/modules/auth/auth.service.ts (L164-L204)

**Purpose:** Rejects missing/malformed/incorrectly signed/expired tokens and returns parsed session claims (L164-L203).

---

**Inputs & Assumptions:**
- `token`: untrusted HTTP credential or undefined (L164-L169).
- Implicit secret and wall clock (L174-L195). Precondition: clock and signing secret match issuance environment; secret enforced by `getTokenSecret`, clock quality established by: nothing found.

---

**Outputs & Effects:** Returns `SessionPayload` or throws UnauthorizedException; reads config/time, performs decoding and MAC comparison (L165-L203).

---

**Block-by-Block:**

```typescript
// L169-L180
const [header, body, signature, extra] = token.split(".");
...
const expected = createHmac(...).update(`${header}.${body}`).digest();
const received = Buffer.from(signature, "base64url");
if (received.length !== expected.length || !timingSafeEqual(...)) throw ...;
```
- **What:** Enforces three-part structure and exact MAC bytes. **Why here:** parsing claims happens only after signature match. **Assumes:** Node base64url decoder behavior for malformed data; external-source-available runtime. **Establishes:** header/body bytes were signed with current secret. **Depended on by:** claim parsing.

```typescript
// L183-L203
const decodedHeader = JSON.parse(...);
const payload = JSON.parse(...) as SessionPayload;
if (decodedHeader.alg !== "HS256" || !payload.sub || !payload.exp || payload.exp <= now) throw ...;
return payload;
```
- **What:** Parses and checks algorithm, subject, expiry. **Why here:** claims are interpreted after MAC verification. **Assumes:** other typed fields have expected runtime types; enforcement for `email`, `role`, `iat` is nothing found. **Establishes:** nonempty subject and future truthy expiry under HS256. **Depended on by:** database lookup (`getUserFromToken`, L108-L110).

---

**Cross-Function Dependencies:**
- Callees `getTokenSecret`, Node crypto/Buffer/JSON (L174-L189). Caller `getUserFromToken` (L108).
- Shared state: config secret; clock.

---

**Open Questions:**
- unclear; need token compatibility requirements for claim type/range validation beyond fields consumed by current code.

