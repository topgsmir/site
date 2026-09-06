## `api` client in apps/web/src/lib/api/client.ts (L3-L8)

**Purpose:** Provides the shared browser-side Axios client used for credentialed API operations (L3-L8).

---

**Inputs & Assumptions:**
- Implicit: public environment variable `NEXT_PUBLIC_API_URL`; fallback is `http://localhost:4000/api` (L3).
- Implicit: browser cookie policy and Axios request behavior (L5-L8).
- Precondition: `API_BASE` points to the intended API origin. Established by deployment configuration: nothing found in this module.

---

**Outputs & Effects:**
- Creates and exports a singleton Axios instance with `baseURL` and `withCredentials: true` (L5-L8).
- Every call through it can include browser credentials according to CORS/cookie policy (L7).

---

**Block-by-Block:**

```ts
// L3-L8
export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";
export const api = axios.create({ baseURL: API_BASE, withCredentials: true });
```
- **What:** Resolves an API base and constructs the client.
- **Why here:** Module initialization centralizes request origin and credential behavior.
- **Assumes:** callers pass relative paths intended for this base. Established by each caller; current web calls use `/seller/vendors` (`VendorManagement.tsx:L292`, L428-L429).
- **Establishes:** shared calls use the configured base and credential mode.
- **Depended on by:** `VendorManagement` load/create/update operations.

---

**Cross-Function Dependencies:**
- Callee `axios.create` (external-source-available library): returns the configured client (L5-L8).
- Callers: `VendorManagement` (L13, L292, L428-L429).
- Shared state: browser cookies are attached by the user agent when policy permits; API guard reads `topgsm_session` (`apps/api/src/modules/auth/platform-admin.guard.ts:L22-L35`, L38-L50).
- Invariant couplings: client credentials alone do not authorize vendor operations; all three API routes use `PlatformAdminGuard` (`apps/api/src/modules/seller/seller.controller.ts:L35-L64`).

---

**Open Questions:**
- unclear; need deployment/CORS configuration to establish allowed web/API origins.

