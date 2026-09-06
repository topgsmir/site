## `robots` in apps/web/src/app/robots.ts (L3-L11)

**Purpose:** Generates Next.js robots metadata for public crawling and selected dashboard exclusions.

---

**Inputs & Assumptions:**
- Implicit: `NEXT_PUBLIC_SITE_URL`, defaulting to `https://top-gsm.ir` (L4).
- Precondition: `siteUrl` is a valid externally visible origin. Established by deployment configuration: nothing found.

---

**Outputs & Effects:**
- Returns rules allowing `/` and disallowing listed admin/seller patterns, plus sitemap and host URLs (L6-L10).
- No persistent state or network call.

---

**Block-by-Block:**

```ts
// L6-L10
return { rules: { userAgent: "*", allow: "/", disallow: [...] }, sitemap: `${siteUrl}/sitemap.xml`, host: siteUrl };
```
- **What:** Builds framework route metadata.
- **Why here:** Next.js serves it at the robots route.
- **Assumes:** crawler pattern interpretation matches the intended localized routes. Established by external crawler behavior: nothing found.
- **Establishes:** generated response expresses no-index crawling guidance for the listed patterns.
- **Depended on by:** crawlers; application authorization does not depend on it.

---

**Cross-Function Dependencies:**
- No internal callees.
- Caller: Next.js metadata route runtime.
- Shared state: environment configuration only.
- Invariant couplings: dashboard pages separately set `robots` metadata and call server auth (`admin/page.tsx:L7-L13`, L23-L31; seller page L6-L12, L22-L28).

---

**Open Questions:**
- unclear; need rendered `robots.txt` or framework routing tests to establish how `/*/admin` patterns are serialized/interpreted.

