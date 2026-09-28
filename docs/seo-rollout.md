# Catalog and multilingual SEO

## Admin SEO workspace

Open **Admin → Website → SEO** (`/{locale}/admin/settings/seo`). The workspace is available in Persian, English and Arabic to platform administrators. Staff and sellers cannot change global SEO configuration.

- Configure localized site names, title templates (one `%s` placeholder), fallback descriptions and social images. Existing page descriptions/images take precedence over defaults. Page overrides take precedence over both.
- Add up to 100 exact public page overrides for home, contact, catalog/products, blog/articles and blog collections. Empty fields inherit existing metadata. Paths are normalized and cannot contain query strings, fragments, dots or protected route segments. Catalog overrides also apply to its query/filter/pagination variants. Canonicals and translation eligibility remain automatic; overrides never publish a draft or make a search result indexable.
- Mark a page `noindex` or exclude it from the sitemap independently. `noindex` pages and redirect sources are automatically removed from sitemap entries and language alternatives. Disabling global indexing sends `noindex, follow` and produces empty child sitemaps. Robots remains crawlable so search engines can read the directive. Existing private route exclusions remain in `robots.txt`.
- Manage up to 100 same-site 301/302 redirects. Queries are discarded. Protected routes, external targets, duplicate sources, chains and cycles are rejected. Public configuration resolves product/article destination aliases to current slugs, flattens chains introduced by later renames, and suppresses resulting cycles. Redirect destinations are not externally crawled or guaranteed to exist; inspect the target before enabling a rule.
- Configure Google/Bing verification **tokens** (never raw HTML), organization name/logo, and up to 10 official profile URLs. Organization and WebSite structured data is emitted on the homepage. Product, article and breadcrumb structured data remains automatic. Verification still requires completing the provider's verification step; DNS-based verification needs no token here.
- Review search/social previews and configuration warnings, export the current draft as JSON, and load any of the latest 20 saved revisions as a draft. Saving a restored draft creates a new revision. Audit records remain durable; the UI history response is bounded to 20 revisions.
- Links to Search Console, Bing Webmaster Tools, Rich Results Test, robots and sitemaps are provided. Ranking, traffic, backlink reports and live crawls are not fabricated: they remain in the provider tools until a separate authenticated integration is configured.

Saves use an optimistic version check (409 on stale versions), an atomic settings/audit transaction, strict nested DTO validation, the platform-admin guard, global browser Origin protection, and a shared PostgreSQL rate-limit policy (`seo_configuration`, default 10 saves per actor / 30 per IP per 15 minutes). All four new API routes are represented in the owner-approved AI tool catalog; configuration changes carry critical risk.

Apply the additive `20260927120000_seo_settings` migration **before** deploying this API and frontend. No existing SEO content is rewritten. With no saved row, the API serves defaults matching the current site. The migration has a 10-second lock timeout and updates both rate-limit action constraints. Roll back application code first and retain the two new tables for recovery; do not drop audit records during rollback.

Metadata and redirect caches refresh at approximately 60-second intervals; Next's metadata cache may serve a previous successful value during background revalidation. Sitemap HTTP caching remains one hour and filtering happens after bounded partition assembly, so an excluded partition may be sparse or empty. On a cold configuration outage, public routes return 503 instead of silently re-enabling indexing or losing redirects. The canonical origin remains the deployment-controlled `NEXT_PUBLIC_SITE_URL`.

Additional checks:

```sh
pnpm exec node --test scripts/seo-core.test.mjs scripts/seo-settings.test.mjs
pnpm --filter topgsm-api exec node scripts/test-seo.mjs
pnpm --filter topgsm-api build
pnpm --filter topgsm-api exec node --test dist/modules/seo/seo-settings.spec.js "dist/modules/data-assistant/*.spec.js" dist/modules/auth/security-rate-limit.spec.js
pnpm exec node scripts/seo-render.test.mjs
```

The database runner covers migration constraints, admin/staff/seller permissions, CSRF, nested validation, concurrent save conflicts, audit consistency, rate-limit thresholds/concurrency/expiry, and public response isolation. Rendering checks cover real HTML overrides, verification tokens, noindex response headers, custom redirect status/query handling and sitemap exclusions. For a disposable browser preview only, run the rendering script with `SEO_PREVIEW=1`; it prints a local fixture login URL and stop-file path after checks finish. That fixture never connects to the application database.

Behavior follows Google's guidance on [crawlable noindex directives](https://developers.google.com/search/docs/fundamentals/get-started-developers), [canonical URLs](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls), [redirects](https://developers.google.com/search/docs/crawling-indexing/301-redirects), and [organization structured data](https://developers.google.com/search/docs/appearance/structured-data/organization).

## Deployment order

1. Apply the additive `20260922200000_product_seo` migration before deploying the API and frontend. It backfills current product slugs and installs the reservation trigger. It has a ten-second lock timeout; retry during a quieter period if concurrent writes prevent the backfill lock.
2. Deploy the API with the regenerated Prisma client, then the frontend. The existing array-returning products endpoint remains available; the catalog uses `/products/page`.
3. Check `/robots.txt`, `/sitemap.xml`, and `/sitemap/0.xml`; verify a historical product URL redirects once with HTTP 308 to its current slug in the requested locale.
4. Publish a complete English or Arabic translation in the admin product editor. Check its visible text, canonical, reciprocal language alternates, and sitemap eligibility after caches refresh.
5. Submit `/sitemap.xml` in Search Console and inspect representative catalog, product, and translated URLs.

No production migration or deployment is performed by the implementation tests. Historical slug preservation starts with this migration; previously lost slugs cannot be recovered automatically.

## Behavior

- Product pages contain 50 items; blog index, category, tag, and seller pages contain 30. Next/first links work without JavaScript. Search and type changes reset pagination.
- Catalog and four type landing pages are indexable. Nonempty search results are `noindex, follow`. Cursor pages have self-canonicals and no cross-language alternates.
- Persian product fields remain the source. English and Arabic drafts stay private until explicit publication. Unpublished locale pages retain Persian content, a Persian canonical, and `noindex`.
- Database-enforced slug reservations cover creation, renames, history restores, and bulk undo. Historical and UUID URLs resolve only after public visibility checks.
- Sitemaps include only current eligible URLs, use bounded database reads, and contain at most 45,000 entries per child. Failures return 503, `Retry-After: 300`, and `Cache-Control: no-store`. Robots does not call the API.
- Page data caches retain their five-minute window; sitemap caches use one hour. Previously successful cached data can remain available during an outage. Cold listing failures return HTTP 500 with a localized retry screen. Next.js adds its standard `noindex` to its HTTP 500 error document; application metadata does not turn an outage into a successful empty/noindex page.

## Verification

Use pinned Node 24.20.0 and pnpm 12.3.4:

```sh
pnpm run doctor
pnpm run prisma:generate
pnpm exec node --test scripts/seo-core.test.mjs
pnpm --filter topgsm-api exec node scripts/test-seo.mjs
pnpm exec node scripts/seo-render.test.mjs
pnpm run type-check
pnpm run lint
pnpm --filter topgsm-api run build
```

The database script requires a local PostgreSQL account allowed to create disposable databases. It migrates a uniquely named test database and drops that database afterward. It never migrates the configured application database. The rendering script builds an isolated production frontend and runs raw HTTP checks against a local fixture API; logs go to ignored `seo-render-test.log`.

Regression coverage includes 50/30 item boundaries, all blog collections, canonical normalization, search exclusion, locale eligibility, draft isolation, admin authorization, rename races/restores, migration backfill, a 46,000-product sitemap fixture, XML escaping, malformed payloads, API failures, and timeouts.

## Separate finding

The existing blog related-product query filters offer, listing and seller visibility but does not reapply the product visibility predicate (`blog.service.ts`, `publicInclude`, `related_products`). An archived product can therefore retain its title, image and active-offer price in an article even though its detail route returns 404. This pre-existing disclosure/dead-link issue needs a product visibility filter on the relation. It is outside the global SEO settings change.
