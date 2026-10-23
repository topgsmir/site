---
name: seo-development
description: Builds and reviews search-optimized public pages in the Top GSM Next.js App Router application, including crawlability, localized metadata, canonical and hreflang URLs, semantic content, internal links, structured data, sitemaps, and performance. Use when creating or changing public routes, landing pages, product or service pages, translated content, navigation, rendering strategy, robots rules, or sitemap behavior, or when the user asks for SEO work or an SEO review.
---

# SEO Development

Build SEO into the page contract. Optimize for useful search results and reliable crawling, not keyword density or metadata volume.

## Project context

- The public site is Next.js 14 App Router in `apps/web`.
- Public URLs are locale-prefixed: `fa`, `en`, and `ar`; `fa` is the default locale.
- Locale utilities live in `apps/web/src/lib/i18n`.
- `fa` and `ar` render RTL; `en` renders LTR.
- Global crawl files are `apps/web/src/app/robots.ts` and `apps/web/src/app/sitemap.ts`.
- `admin` and `seller-dashboard` routes are private application surfaces and must remain out of search results.
- The NestJS API supplies entities used by indexable pages. Public SEO content must have a stable server-rendered representation when the API is slow or unavailable.

Read [PAGE-CONTRACTS.md](PAGE-CONTRACTS.md) when adding a route or choosing metadata/schema. Read [REVIEW-CHECKLIST.md](REVIEW-CHECKLIST.md) for audits and before completing an SEO change.

## Workflow

### 1. Classify the route

Choose one class before implementation:

1. **Indexable**: unique, useful public content with a canonical URL.
2. **Conditionally indexable**: filters, pagination, search, or user-generated content that needs an explicit indexation rule.
3. **Non-indexable**: authentication, account, admin, seller dashboard, checkout, thin search results, or duplicate utility routes.

Do not expose private data to crawlers. `robots.txt` is crawl guidance, not access control; enforce authorization in the application and use `noindex` where a private route can return HTML.

### 2. Define search intent and page contract

For each indexable route, state internally:

- primary user question or task;
- unique value the page provides;
- canonical route pattern;
- required visible fields and heading;
- internal-link sources and destinations;
- supported locales and whether each translation is genuinely equivalent;
- structured-data type, if one truthfully matches visible content.

If the page has no durable, differentiated answer, do not manufacture an indexable page for it.

### 3. Make the page crawlable and render meaningful HTML

- Prefer Server Components for indexable content.
- Fetch critical page data on the server. Do not require a click, client effect, socket connection, or animation to reveal the primary heading and body.
- Return `notFound()` for invalid locales and nonexistent public entities.
- Use redirects only for a real canonical move. Avoid redirect chains.
- Give every indexable page a self-referencing canonical.
- Use real `<a href>` links for crawlable navigation. Keep descriptive anchor text; avoid repeated “click here” links.
- Preserve useful content when JavaScript fails. Motion and progressive enhancement must not determine whether the content exists.
- Keep URL slugs stable, readable, and derived from durable identifiers. When a slug changes, preserve the old URL with a permanent redirect.

### 4. Build content around the task

- Write one clear, visible `h1` describing the page's subject.
- Maintain a logical heading hierarchy without skipping levels for visual styling.
- Put the direct answer or product identity near the top, then supporting detail, proof, specifications, process, limitations, and next actions as appropriate.
- Use the vocabulary real technicians and customers use, naturally and locale-appropriately. Do not stuff keywords or create near-duplicate location/category pages.
- Keep critical product/service facts as text, not only inside images, icons, placeholders, or canvas elements.
- Add descriptive alt text when an image conveys content; use empty alt text for decorative images.
- Link to related products, services, categories, guides, or support when the relationship helps the user.
- Do not publish fabricated reviews, ratings, availability, prices, authorship, dates, or expertise claims.

For Persian and Arabic, write native copy rather than translating English word-for-word. Keep model names, standards, and technical identifiers accurate.

### 5. Implement localized metadata

Use Next.js `Metadata` or `generateMetadata` in the route segment.

- Generate a unique, human-readable title and description from the page's actual content.
- Rely on the layout title template unless the returned title is intentionally absolute.
- Keep `metadataBase` aligned with `NEXT_PUBLIC_SITE_URL` and the production origin.
- Generate an absolute canonical URL from the normalized locale route.
- Add `alternates.languages` only for live, equivalent localized pages. Include `x-default` when the default destination is meaningful.
- Match Open Graph and Twitter data to the canonical page. Use a representative image when available.
- Mark non-indexable surfaces with `robots: { index: false, follow: false }` unless following their links is intentionally useful.
- Do not spend implementation effort on the `keywords` field; it is not a substitute for useful content, titles, headings, or internal links.
- Avoid metadata that promises content the rendered page does not contain.

When metadata depends on API data, use the same entity and canonicalization rules as the page. Handle missing entities consistently with `notFound()`.

For API-backed indexable routes, keep the data contract SEO-capable:

- expose a stable ID/slug, publication state, localized public fields, and a real `updatedAt` value;
- return only published entities from public listing/detail endpoints;
- distinguish missing, unpublished, and permanently removed content deliberately;
- keep list pagination deterministic so sitemap and internal-link generation cannot skip or duplicate entities;
- cache public reads only as long as their price, availability, and publication data may safely remain stale.

### 6. Add structured data only when eligible

- Choose a Schema.org type that matches the visible page, such as `Organization`, `WebSite`, `BreadcrumbList`, `Product`, `Offer`, `Service`, `Article`, or `FAQPage`.
- Every structured-data claim must be visible or directly supported by the page data.
- Use stable absolute `url`, image, and `@id` values based on the canonical origin.
- Connect related nodes with `@id` instead of duplicating conflicting entities.
- Include price, currency, availability, rating, dates, or author only when current and authoritative.
- Do not add FAQ markup for questions that are not visibly rendered, or review markup for first-party/fabricated reviews.
- Serialize JSON-LD safely with `JSON.stringify(value).replace(/</g, "\\u003c")`.

### 7. Maintain discovery and duplication controls

- Add only canonical, indexable URLs to `sitemap.ts`.
- Include localized alternates only when those URLs exist and are equivalent.
- Use a meaningful `lastModified` sourced from content data. Do not emit the current time on every sitemap request for unchanged content.
- Keep `robots.ts` synchronized with private route patterns and the sitemap origin.
- Decide explicitly how query parameters, sort orders, filters, pagination, and internal search pages behave. Avoid unlimited crawl combinations.
- Ensure exactly one URL form wins for protocol, host, locale, trailing slash, slug, and casing.

### 8. Protect performance and accessibility

- Avoid turning a Server Component into a Client Component solely for presentation.
- Use `next/image` with intrinsic dimensions for meaningful images; prioritize only genuine above-the-fold hero media.
- Reserve layout space to prevent shifts. Avoid autoplay media and heavy animation on the critical rendering path.
- Keep fonts, scripts, and third-party code minimal. Lazy-load non-critical widgets.
- Preserve keyboard access, focus visibility, landmarks, labels, color contrast, and reduced-motion behavior.
- Treat mobile layout and Core Web Vitals regressions as SEO regressions.

## Verification

Inspect the rendered route, not just the source file.

1. Run the focused type check and production build when practical:

   ```bash
   pnpm --filter topgsm-web type-check
   pnpm --filter topgsm-web build
   ```

2. Verify status codes and redirect behavior for canonical, invalid-locale, missing-entity, and old-slug URLs.
3. Inspect rendered HTML for `lang`, `dir`, title, description, canonical, hreflang, robots, one meaningful `h1`, crawlable links, and JSON-LD.
4. Check `/robots.txt` and `/sitemap.xml` against the production origin and route classification.
5. Test at least one `fa` route and one LTR route when shared layout or localization changes.
6. Validate structured data and confirm it agrees with visible page content.
7. Review the change with [REVIEW-CHECKLIST.md](REVIEW-CHECKLIST.md).

Do not claim SEO success from a passing build alone. Report what was verified locally and identify checks that require deployed URLs or search-engine tooling.

When framework or search-engine behavior is material and uncertain, verify it against current official Next.js or Google Search documentation before implementing the rule.

## Response format

For implementation work, finish with:

- routes changed and their indexation class;
- SEO elements added or changed;
- verification performed;
- deployment-only follow-ups, if any.

For an audit, report findings in priority order. Each finding must include the affected route/file, why it matters, concrete evidence, and the smallest credible fix. Separate confirmed defects from optional opportunities.
