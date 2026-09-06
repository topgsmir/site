## `AuthController.serializeCookie` in apps/api/src/modules/auth/auth.controller.ts (L72-L86)

**Purpose:** Serializes the authentication cookie with path, HTTP-only, same-site, lifetime, optional domain, and production-only secure attributes (L72-L86).

---

**Inputs & Assumptions:**
- `value`: session token or empty deletion value; semi-trusted caller input (L72-L74).
- `maxAge`: lifetime in seconds; trusted internal input (L72, L78).
- Implicit config `AUTH_COOKIE_DOMAIN`, `NODE_ENV` (L80-L83). Precondition: configured domain is syntactically and operationally appropriate; established by: nothing found.

---

**Outputs & Effects:** Returns a semicolon-delimited cookie string; reads environment-backed config (L73-L85).

---

**Block-by-Block:**

```typescript
// L73-L85
const attributes = [...];
const domain = this.config.get<string>("AUTH_COOKIE_DOMAIN")?.trim();
if (domain) attributes.push(`Domain=${domain}`);
if (this.config.get("NODE_ENV") === "production") attributes.push("Secure");
return attributes.join("; ");
```
- **What:** Builds fixed and environment-dependent attributes. **Why here:** optional attributes are appended after the common policy. **Assumes:** `value`, `domain`, and `maxAge` contain no cookie delimiters; value is established by JWT base64url generation, while domain/maxAge enforcement outside internal callers is nothing found. **Establishes:** HttpOnly, SameSite=Lax, Path=/ and conditional Secure. **Depended on by:** session creation and logout (L69, L63).

---

**Cross-Function Dependencies:**
- Callee `ConfigService.get` (external-source-available framework): supplies environment values (L80-L83).
- Callers: `setSessionCookie`, `logout` (L62, L68).
- Shared state: process configuration only (L80-L83).

---

**Open Questions:**
- unclear; need deployment configuration to determine exact cookie domain and whether `NODE_ENV` equals `production`.
