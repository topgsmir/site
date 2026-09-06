## `AuthService.signToken` in apps/api/src/modules/auth/auth.service.ts (L153-L162)

**Purpose:** Produces a compact HMAC-SHA256 token from a fixed header and session payload (L153-L162).

---

**Inputs & Assumptions:**
- `payload`: trusted internal `SessionPayload` from `createSession` (L139-L148).
- Precondition: signing secret exists and meets production checks; enforced by `getTokenSecret` (L157, L206-L217).

---

**Outputs & Effects:** Returns `header.body.signature`; reads configuration through the secret helper (L154-L161).

---

**Block-by-Block:**

```typescript
// L154-L161
const header = this.encodeJson({ alg: "HS256", typ: "JWT" });
const body = this.encodeJson(payload);
const content = `${header}.${body}`;
const signature = createHmac("sha256", this.getTokenSecret()).update(content).digest("base64url");
return `${content}.${signature}`;
```
- **What:** Encodes, signs, concatenates. **Why here:** signature covers the exact transmitted header/body. **Assumes:** `createHmac` behaves per Node crypto contract; external-source-available runtime. **Establishes:** signature authenticates header and body under configured secret. **Depended on by:** `createSession` (L148).

---

**Cross-Function Dependencies:**
- Callees `encodeJson`, `getTokenSecret`, Node `createHmac` (L154-L159). Caller `createSession`.
- Shared state: environment secret (L206-L217).

---

**Open Questions:**
- unclear; need secret distribution/rotation process outside repository.

