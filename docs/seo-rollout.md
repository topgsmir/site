# Catalog and multilingual SEO

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

The existing blog related-product query selects active offers without reapplying the full product/listing/seller visibility predicate. It can retain a product title or price in an article after that product or seller becomes unavailable, although the product detail route returns 404. This pre-existing disclosure/dead-link issue needs a separate visibility fix. Currency and price-schema changes remain outside this implementation.
