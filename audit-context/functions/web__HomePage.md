## `HomePage` in apps/web/src/app/[locale]/page.tsx (L95-L145)

**Purpose:** Validates the homepage locale, obtains product/agent collections, emits JSON-LD, and renders `LandingPage`.

---

**Inputs & Assumptions:**
- `params.locale` (`string`): URL input, untrusted until L96.
- Implicit: API/cache and fallback collections through `fetchCollection` (L98-L101); `siteUrl` and metadata dictionaries (L103-L137).
- Precondition: returned product fields are safe to use in URLs/text and JSON-LD. Element-shape validation: nothing found in `fetchCollection` (L52-L60).

---

**Outputs & Effects:**
- Calls `notFound` for unsupported locales (L96).
- Starts product and agent fetches concurrently (L98-L101).
- Generates Organization, WebSite/SearchAction, and product ItemList structured data (L103-L137).
- Returns a fixed-type JSON-LD script and `LandingPage` props (L139-L143).

---

**Block-by-Block:**

```tsx
// L95-L101
if (!isLocale(params.locale)) notFound();
const [products, agents] = await Promise.all([
  fetchCollection<HomepageProduct>("/products", fallbackProducts),
  fetchCollection<HomepageAgent>("/seller/agents", fallbackAgents)
]);
```
- **What:** Establishes locale and resolves both data dependencies in parallel.
- **Why here:** Neither rendering branch should proceed without normalized collections.
- **Assumes:** `notFound` terminates, permitting locale narrowing.
- **Establishes:** current locale is supported; both collection promises resolved, possibly to fallbacks.
- **Depended on by:** structured data and `LandingPage`.

```tsx
// L103-L137
const structuredData = { "@context": "https://schema.org", "@graph": [... products.slice(0, 8).map(...)] };
```
- **What:** Builds JSON-LD using configured site origin, locale, and up to eight products.
- **Why here:** Server data and route locale are available together.
- **Assumes:** product `slug ?? id`, `title`, and locale are valid structured-data values. Established by: nothing found for remote array elements.
- **Establishes:** graph positions are one-based and bounded to eight items (L129-L134).
- **Depended on by:** serialized script at L141.

```tsx
// L139-L143
<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
<LandingPage locale={params.locale} products={products} agents={agents} />
```
- **What:** Serializes structured data with `<` escaping and renders the visual page.
- **Why here:** Escaping occurs after JSON serialization and before HTML insertion.
- **Assumes:** escaping `<` is sufficient for this fixed script type and React insertion context. The data is first JSON-encoded at L141.
- **Establishes:** raw `<` characters from data cannot appear in inserted JSON text.
- **Depended on by:** browser/crawlers and `LandingPage`.

---

**Cross-Function Dependencies:**
- Callee `isLocale`, `notFound`, `fetchCollection`, `LandingPage` (internal/framework).
- API `/seller/agents` is source-available and returns an in-memory array without auth (`apps/api/src/modules/seller/seller.controller.ts:L23-L29`, L67-L70).
- Product API path implementation: nothing found during this web-focused pass; tracked as open.
- Caller: Next.js `[locale]` page route.
- Shared state: Next.js fetch cache; API agent process memory; external database/cache behind products remains open.
- Invariant couplings: `LandingPage` slices and renders fields without additional runtime validation (`LandingPage.tsx:L295-L299`, L374-L400).

---

**Open Questions:**
- unclear; need to locate/analyze the `/products` API implementation and response schema.
- unclear; fallback versus live data is not exposed in the returned UI, so the source in a rendered page cannot be inferred from this component.

