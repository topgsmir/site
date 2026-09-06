## `hasActiveSession` in apps/web/src/middleware.ts (L32-L44)

**Purpose:** Supplies middleware with a cheap boolean indicating whether a token payload contains a future expiry (L32-L43).

---

**Inputs & Assumptions:**
- `token` (`string | undefined`): cookie value controlled by the request. Trust: untrusted (L32-L36).
- Implicit: wall-clock time from `Date.now()` and Edge/browser-compatible `atob` (L38-L40).
- Precondition: token payload is base64url-encoded JSON. Established by: nothing found; malformed values return false (L35-L43).
- Precondition: payload integrity and session subject are valid if true is interpreted as authentication. Established by: nothing found in this helper; the API verifier performs those checks later (`apps/api/src/modules/auth/auth.service.ts:L164-L203`).

---

**Outputs & Effects:**
- Returns false for a missing token, parsing failure, missing/non-numeric expiry, or non-future expiry (L33-L43).
- Returns true solely for a parseable payload with numeric `exp > Date.now()/1000` (L36-L40).
- No state writes or external network calls.

---

**Block-by-Block:**

```ts
// L33-L40
if (!token) return false;
const [, payload] = token.split(".");
const decoded = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))) as { exp?: number };
return typeof decoded.exp === "number" && decoded.exp > Date.now() / 1000;
```
- **What:** Decodes the second dot-delimited segment and compares its expiry to current time.
- **Why here:** It avoids a server/API call in middleware.
- **Assumes:** `atob` accepts the unpadded transformed base64url segment. Established by: nothing found; failures enter the catch.
- **Establishes:** only payload syntax and a future numeric expiry.
- **Depended on by:** `middleware` protected-route redirect decision (L15).

```ts
// L41-L43
} catch { return false; }
```
- **What:** Collapses all decoding/parsing errors to inactive.
- **Why here:** Keeps malformed cookies on the login redirect path.
- **Assumes:** callers do not need error distinctions.
- **Establishes:** the function does not throw for malformed token input.
- **Depended on by:** middleware response continuity.

---

**Cross-Function Dependencies:**
- Callee `JSON.parse`, `atob`, `Date.now` (external-source-available runtime): parse and clock behavior (L37-L40).
- Callers: `middleware` only (L15).
- Shared state: reads no storage directly; its input originates from `topgsm_session` (L15).
- Invariant couplings: API `verifyToken` validates three segments, HMAC, algorithm, subject and expiry (`apps/api/src/modules/auth/auth.service.ts:L164-L203`); this helper does not replicate those guarantees.

---

**Open Questions:**
- No open questions after following the server-side verification path.

