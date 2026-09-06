## `sitemap` in apps/web/src/app/sitemap.ts (L4-L16)

**Purpose:** Generates one public homepage sitemap record per supported locale.

---

**Inputs & Assumptions:**
- Implicit: `NEXT_PUBLIC_SITE_URL` and `locales` (L2, L5).
- Implicit: current wall-clock time for `lastModified` (L9).
- Precondition: `siteUrl` is the canonical public origin. Established by deployment configuration: nothing found.

---

**Outputs & Effects:**
- Returns three localized URL entries, each with current generation time, daily frequency, priority, and all locale alternates (L7-L15).
- No storage writes.

---

**Block-by-Block:**

```ts
// L7-L15
return locales.map((locale) => ({
  url: `${siteUrl}/${locale}`,
  lastModified: new Date(),
  ...,
  alternates: { languages: Object.fromEntries(locales.map((code) => [code, `${siteUrl}/${code}`])) }
}));
```
- **What:** Maps locales and nests a second locale map for alternates.
- **Why here:** Keeps sitemap locale coverage coupled to the shared locale list.
- **Assumes:** generation time is an appropriate page modification time. Established by: nothing found from content state.
- **Establishes:** every supported locale has an entry and links to every supported alternate.
- **Depended on by:** robots metadata points to this sitemap (`robots.ts:L8`).

---

**Cross-Function Dependencies:**
- Callees `Array.map`, `Object.fromEntries`, `Date` (runtime).
- Caller: Next.js metadata route runtime.
- Shared state: environment configuration and immutable locale list.
- Invariant couplings: locale coverage matches `locales.ts:L1` by construction.

---

**Open Questions:**
- unclear; need product/search route requirements to know whether homepage-only coverage is intentional.

