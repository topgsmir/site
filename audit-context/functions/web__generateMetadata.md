## `generateMetadata` in apps/web/src/app/[locale]/page.tsx (L63-L93)

**Purpose:** Builds locale-specific canonical, alternate, search, OpenGraph, Twitter, and robots metadata for the homepage.

---

**Inputs & Assumptions:**
- `params.locale` (`string`): route-derived and untrusted (L63-L65).
- Implicit: `siteUrl` environment/fallback and `metadataByLocale` (L10, L13-L29).
- Precondition: `siteUrl` parses as an absolute URL. Established by deployment configuration: nothing found; `new URL` throws otherwise (L66, L69).

---

**Outputs & Effects:**
- Defaults unsupported locale strings to Persian for metadata only (L64-L65).
- Returns canonical and alternate absolute URLs plus localized textual metadata (L66-L92).
- No storage or network effects.

---

**Block-by-Block:**

```tsx
// L64-L66
const locale = isLocale(params.locale) ? params.locale : "fa";
const localized = metadataByLocale[locale];
const canonical = new URL(localizePath(locale), siteUrl);
```
- **What:** Validates/defaults locale and constructs canonical URL.
- **Why here:** All metadata fields depend on these normalized values.
- **Assumes:** defaulting metadata for an invalid page param is acceptable even though page rendering calls `notFound` (L95-L96).
- **Establishes:** safe metadata dictionary indexing.
- **Depended on by:** returned metadata fields (L68-L92).

```tsx
// L68-L92
return { metadataBase: new URL(siteUrl), title: localized.title, ..., robots: { index: true, follow: true } };
```
- **What:** Assembles the metadata graph.
- **Why here:** Next.js consumes one complete object.
- **Assumes:** configured localized copy and URLs represent canonical content. Established by constants/configuration.
- **Establishes:** three language alternates plus Persian x-default (L73-L80).
- **Depended on by:** search/social crawlers via Next.js output.

---

**Cross-Function Dependencies:**
- Callee `isLocale` and `localizePath` (internal): runtime allowlist and localized path construction (`locales.ts:L6-L16`).
- Caller: Next.js metadata runtime.
- Shared state: environment and static metadata dictionaries.
- Invariant couplings: page rendering rejects invalid locales rather than using the metadata fallback (L95-L96).

---

**Open Questions:**
- unclear; need deployment values to confirm `siteUrl` origin and trailing-path behavior.

