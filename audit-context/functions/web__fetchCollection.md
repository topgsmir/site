## `fetchCollection` in apps/web/src/app/[locale]/page.tsx (L52-L61)

**Purpose:** Fetches a homepage collection from the API with a 60-second Next.js cache policy and substitutes static fallback data on transport/status/shape/empty-result paths.

---

**Inputs & Assumptions:**
- `path` (`string`): trusted internal relative API path; callers pass `/products` and `/seller/agents` (L98-L101).
- `fallback` (`T[]`): trusted static collection used by reference on failures (L52-L60).
- Implicit: `apiUrl` environment/fallback configuration (L11, L54), remote API response, Next.js cache.
- Precondition: a non-empty JSON array contains `T`. Established by: nothing found at runtime; L57 casts after only `Array.isArray` and length checks.

---

**Outputs & Effects:**
- Performs a server-side GET with `revalidate: 60` (L54).
- Returns fallback on non-OK status, empty/non-array JSON, or any thrown error (L55-L60).
- Returns the unvalidated remote array otherwise (L56-L57).

---

**Block-by-Block:**

```tsx
// L53-L57
const response = await fetch(`${apiUrl}${path}`, { next: { revalidate: 60 } });
if (!response.ok) return fallback;
const value: unknown = await response.json();
return Array.isArray(value) && value.length ? (value as T[]) : fallback;
```
- **What:** Fetches, gates status, parses JSON, and gates top-level collection shape.
- **Why here:** Homepage should render through API unavailability or empty collections.
- **Assumes:** array elements satisfy `T`. Established by: nothing found.
- **Establishes:** returned value is non-empty when remote data is chosen; fallback may itself be empty in a generic call.
- **Depended on by:** `HomePage` product/agent rendering and structured data.

```tsx
// L58-L60
} catch { return fallback; }
```
- **What:** Converts all request and parsing failures to fallback data.
- **Why here:** Prevents homepage failure propagation.
- **Assumes:** callers do not require knowledge of degraded data source.
- **Establishes:** function resolves for caught failures.
- **Depended on by:** `Promise.all` in `HomePage` (L98-L101).

---

**Cross-Function Dependencies:**
- Callee global `fetch`/`Response.json` (external-source-available runtime).
- Callers: `HomePage` in parallel for products and agents (L98-L101).
- Shared state: Next.js fetch cache for 60 seconds; no direct database access.
- Invariant couplings: `LandingPage` assumes product and agent fields during rendering (`LandingPage.tsx:L374-L400`); element validation is not performed here.

---

**Open Questions:**
- unclear; need API product route/schema analysis to establish the exact remote product shape.

