# SEO Page Contracts

Use the narrowest contract that fits the route. Never add schema or indexation merely because a page type appears in this file.

## Homepage

- Indexable for every fully supported locale.
- Canonical: `/{locale}`.
- Describe the site's main value and primary task.
- Link to durable category, product, service, and guide destinations.
- Eligible schema: `Organization`, `WebSite`, and a truthful featured `ItemList`.
- Add `SearchAction` only when the target search route exists and works.

## Category or listing page

- Index only when the page has a stable purpose, useful introductory content, and a meaningful inventory.
- Canonicalize or noindex low-value sort/filter combinations.
- Keep pagination crawlable and give each page a self-canonical when pages expose distinct items.
- Do not canonicalize every paginated page to page one if that hides unique items.
- Eligible schema: `BreadcrumbList` and `ItemList`.

## Product or digital file page

- Index only active products with enough unique information to make a purchase decision.
- Canonical: `/{locale}/products/{stable-slug}`.
- Render product name, purpose, compatibility/model, included material, requirements, limitations, delivery method, current price/currency, and availability when known.
- Add related-category and related-product links without auto-generating doorway pages.
- Eligible schema: `Product`, `Offer`, and `BreadcrumbList` when visible data supports each property.
- Never infer aggregate ratings or reviews from placeholders.

## Service page

- Explain the supported device/tool, eligibility, prerequisites, expected process, exclusions, delivery/support method, and price or quote behavior.
- Distinguish similar services with real operational differences, not swapped keywords.
- Eligible schema: `Service`, `Offer`, and `BreadcrumbList`.

## Guide or training page

- Show author/editor identity only when real and supportable.
- Display meaningful published and updated dates and update them only for substantive changes.
- Include prerequisites, steps, warnings, expected outcome, and links to relevant products/services.
- Eligible schema: `Article` or `TechArticle`, plus `BreadcrumbList`.

## Internal search

- Default to non-indexable unless curated search landing pages are deliberately supported.
- Prevent unbounded parameter combinations from entering the sitemap or internal-link graph.
- A `WebSite` `SearchAction` is valid only if the destination route is functional.

## Authentication, admin, seller, account, checkout

- Non-indexable.
- Exclude from sitemap.
- Apply authentication and authorization independently of crawler directives.
- Avoid exposing user-specific or sensitive values in initial HTML, metadata, JSON-LD, or cached responses.

## Localized equivalents

- A hreflang set must be reciprocal: every equivalent page points to every other equivalent page and itself.
- Do not point missing translations to a localized homepage as a substitute.
- If only one translation exists, keep its self-canonical and omit unavailable language alternates.
- Keep the same entity identity across translations while localizing human-facing slugs and copy only when routing supports stable redirects.
