## `LandingPage` in apps/web/src/components/landing/LandingPage.tsx (L295-L428)

**Purpose:** Renders the localized public storefront from server-supplied products and agents, including internal paths, telephone actions, structured sections, and client motion hooks (L295-L428).

---

**Inputs & Assumptions:**
- `locale` (`Locale`): validated by `HomePage` (page `L95-L101`).
- `products` (`HomepageProduct[]`) and `agents` (`HomepageAgent[]`): server-supplied from `fetchCollection` or static fallbacks (page `L31-L60`, L98-L101). Trust: semi-trusted; fetched arrays are checked only with `Array.isArray` and cast element-wise without runtime shape validation (page `L56-L57`).
- Precondition: copied navigation/service hrefs and API product/agent values are renderable in their assigned HTML contexts. Application copy owns the former; element validation for API values: nothing found.

---

**Outputs & Effects:**
- Selects at most six supplied agents or component fallback agents and at most eight products (L296-L298).
- Renders localized navigation/search/service/product links and telephone links (L305-L425).
- Builds product paths from `slug ?? id` and telephone URIs from agent phone values (L382, L397).
- Runs `LandingMotion` as a client child; this component itself has no client state or network call (L301-L303).

---

**Block-by-Block:**

```tsx
// L296-L298
const copy = copyByLocale[locale];
const visibleAgents = agents.length ? agents.slice(0, 6) : fallbackAgents;
const visibleProducts = products.slice(0, 8);
```
- **What:** Selects copy and caps visible data.
- **Why here:** Every later section consumes these derived values.
- **Assumes:** a non-empty agent array should suppress all fallback agents, regardless of count or element validity. Encoded by the ternary at L297.
- **Establishes:** bounded render counts, but not element shapes.
- **Depended on by:** agent/product sections and metadata-linked page content.

```tsx
// L371-L384
{visibleAgents.map((agent, index) => (... initials(agent.name) ... agent.rating.toFixed(1) ... agent.phone ? <a href={`tel:${agent.phone}`}> ... ))}
```
- **What:** Renders API/fallback agent identity, availability, rating, and optional direct-call URI.
- **Why here:** All agent-derived browser outputs live within the agent card.
- **Assumes:** names are strings, ratings are numbers, and phone values are valid telephone URI payloads. Runtime establishment by `fetchCollection`: nothing found.
- **Establishes:** phone absence suppresses the call action; present values are interpolated directly into `tel:`.
- **Depended on by:** public specialist-contact flow.

```tsx
// L393-L404
{visibleProducts.length ? visibleProducts.map((product, index) => (
  <Link href={`/${locale}/products/${product.slug ?? product.id}` as Route}>...{product.title}...{formatPrice(product, locale)}</Link>
)) : <p ...>{copy.emptyProducts}</p>}
```
- **What:** Builds public product cards or empty copy.
- **Why here:** Product data determines both navigation and display.
- **Assumes:** product id/slug is an appropriate route segment and type/price fields match local types. Runtime element validation: nothing found.
- **Establishes:** at most eight linked product cards.
- **Depended on by:** public product navigation and search-engine-visible content.

```tsx
// L421-L425
<footer>...<Link href={localizedHref(locale, "/seller-dashboard")}>...</Link>...</footer>
```
- **What:** Exposes public quick links including the protected seller destination.
- **Why here:** Footer navigation is globally visible on the landing page.
- **Assumes:** destination routes enforce their own access requirements. Established for seller dashboard by middleware and `requireUser` (`seller-dashboard/page.tsx:L23-L30`).
- **Establishes:** localized internal route construction.
- **Depended on by:** navigation into authentication boundary.

---

**Cross-Function Dependencies:**
- Callees `getDirection`, `localizePath`/`localizedHref`, `LanguageSwitcher`, `initials`, `productTypeLabel`, `formatPrice`, Next `Image`/`Link`, and `LandingMotion` (L301-L425).
- Caller: `HomePage`, after parallel product/agent fetch with fallbacks (`app/[locale]/page.tsx:L98-L101`, L139-L143).
- Shared state: no persistent client state; rendered data couples to public API collections and static fallbacks.
- Invariant coupling: `HomePage` structured data uses the same product ids/slugs and eight-item cap separately (`page.tsx:L127-L135`), so synchronization is manual.

---

**Open Questions:**
- unclear; need public products/agents controller and DTO inspection to establish exact runtime response guarantees for every rendered property.
- unclear; routes for `/search`, `/products`, and product detail are linked here but no corresponding page files appear in the current `apps/web/src/app` inventory.
