# Catalog architecture migration

## Changes

- Products reference `product_categories.id`. Category names have a database-enforced normalized identity (case and whitespace), shared translations, and an administrator audit trail. Existing equivalent labels are merged without replacing product IDs. Empty labels become no category.
- `GET /products/categories` returns a bounded, cursor-paginated directory. `PATCH /products/admin/categories/:categoryId` renames a category or updates its English/Arabic labels; only platform administrators can use it. Renaming a category does not update every product row.
- Product create/update requests accept `categoryId`; `null` clears membership. Existing clients can continue sending `category` labels, which are resolved to entities transactionally. Sending both fields is rejected. Responses retain `category` for display and add `categoryId`. Product list filters support exact `categoryId`; legacy management label filters retain substring matching.
- Existing translated category labels are preserved. Unanimous published labels become shared translations; conflicting historical labels remain display fallbacks. A shared translation takes precedence. Product history restores category IDs, with support for older snapshots containing only labels.
- Product, option, option-value, variant, listing and offer primary keys, plus every reference to them, use PostgreSQL `uuid`. User, seller, order, media and event primary keys retain their existing types. API IDs are still strings. Invalid legacy UUID data aborts the conversion; identifiers are never regenerated.
- New B-tree indexes match product updated/created/title ordering, category plus updated ordering, and seller listing updated/created ordering. Tie-breaker IDs use the same direction as the selected sort. Related product-title sorting in seller listings and arbitrary combinations of filters can still require a sort; these indexes do not cover every possible query.

## Verification

Use the pinned Node/pnpm versions, then run from the repository root:

```powershell
pnpm run doctor
pnpm --filter topgsm-api run prisma:generate
pnpm --filter topgsm-api run build
pnpm --filter topgsm-api exec node scripts/test-catalog-architecture.mjs
```

The test runner requires a local PostgreSQL `DATABASE_URL` with permission to create a test database. It creates a uniquely named disposable database, replays earlier migrations, inserts legacy catalog records, checks rejection of malformed UUIDs, applies the new migrations, and verifies identifiers, category deduplication, reporting view grants, triggers, and foreign keys. It then runs the catalog, SEO and checkout integration suites, including `EXPLAIN (ANALYZE, BUFFERS)` with 30,000 products and listings. It drops only the database it created. It does not migrate the configured application database.

## Deployment

This is a coordinated maintenance deployment. The UUID conversion rewrites tables and indexes and takes exclusive locks, including on order-item and inventory-reference tables. Category backfill and removal of the legacy column also require a compatible application rollout. Do not run old and new API versions concurrently against the migrated schema.

1. Back up the database and verify restoration. Rehearse on a restored production copy to measure duration and check IDs, custom views, grants, disk space and dependency differences.
2. Stop API instances, workers and other catalog/order writers, and drain transactions. Allow enough space for rewritten tables, indexes and WAL.
3. Apply the three new migrations with `pnpm --filter topgsm-api run prisma:migrate` using the intended deployment credentials. This command applies all pending repository migrations; review that list first.
4. Deploy the matching generated Prisma client and application build. Check category counts/membership, reporting views, public products, seller management, checkout, inventory and media before reopening traffic.
5. Run `ANALYZE` on rewritten catalog and referencing tables and inspect representative production query plans.

The UUID and category migrations are each atomic, with a five-second lock timeout and a five-minute per-statement timeout. They are separate transactions: failure of the category migration does not undo a successful UUID migration. Unknown view dependencies deliberately fail without `CASCADE`. Reporting views are recreated with their saved definitions, options, owners and grants during UUID conversion; the category migration then updates `ai_reporting.seller_products` to join category entities.

## Failure recovery

- For a failed UUID/category migration, inspect the error and verify its transaction rolled back. Repair invalid legacy identifiers/dependencies or drain the blocking session, then use Prisma's `migrate resolve --rolled-back <failed-migration-name>` before retrying. Keep the compatible application stopped until all migrations succeed.
- Indexes are built concurrently outside a transaction. A failed build can leave an invalid index; earlier indexes in that migration may already be valid. Inspect `pg_index.indisvalid` for the six names in `20260924172000_catalog_management_indexes`. To rerun that migration from the beginning, drop only its six newly introduced indexes with separate `DROP INDEX CONCURRENTLY IF EXISTS public.<name>` statements, outside a transaction; mark that migration rolled back and retry. Do not drop other application indexes. Alternatively complete and verify every remaining index before marking the migration applied.
- After a successful contract migration, deploying the previous application alone is not a rollback: its category column and text-key queries no longer match the database. Restore the verified pre-migration backup together with the previous application, or prepare a separately reviewed reverse migration. Keep traffic closed during recovery to avoid losing new writes.

## Related migration correction

The pending `20260924160000_homepage_content` migration originally declared its user foreign key as UUID even though `users.id` is text. Its `updated_by_id` column and Prisma mapping now use text, allowing the existing migration chain to replay. This correction applies to that previously unapplied migration.
