Digital offers accept `digital.fileReferences`: 1–50 unique HTTPS URLs, each at
most 2,048 characters. Seller and admin forms accept one URL per line. The legacy
`fileReference` input remains accepted when the list is absent; responses retain
that field as the first URL.

Checkout snapshots all file URLs. Verified payment creates one entitlement per
file, with the offer's download limit applied separately to each file. Later offer
edits do not change purchased files. A limit of zero means unlimited downloads.
Buyer responses expose `digitalDeliveries` containing authenticated download
routes and per-file counters, while retaining `digitalDelivery` for the first file.
`GET /orders/:orderId/items/:itemId/download?fileIndex=1` downloads the second file;
omitting the index selects the first. Existing buyer ownership, payable order
status, allowed download hosts, and IP-bound link signing still apply.

Rollout: stop old API/payment workers, back up the database, apply migration
`20260922150000_multiple_digital_files`, generate Prisma, and deploy the API and
web together. The migration backfills existing HTTPS URLs and gives existing
entitlements index zero without changing counters. Non-URL references in old
draft offers remain in the legacy column for correction by sellers. Migration
DDL uses a five-second lock timeout; schedule around long transactions and large
table backfills.

Rollback should preserve the new data and use a forward fix. An old API assumes
one entitlement per item and cannot safely operate on multi-file purchases.
Restoring the pre-deployment backup would discard subsequent purchases; do not
drop the new columns or collapse entitlements as a routine rollback.

Existing limitation: product URL validation accepts HTTPS destinations that the
download signer may reject (unconfigured hosts, queries, fragments, or credentials).
Use unsigned UploadCenter URLs on `UPLOAD_DOWNLOAD_HOSTS`. Aligning offer-time
validation with signer configuration would prevent an unusable URL being sold.
