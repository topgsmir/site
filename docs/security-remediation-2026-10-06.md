# Security remediation — 2026-10-06

These are local, uncommitted fixes following the source audit of commit
`9f0d63cbf4f01066d99019cb1cb897a9455a2932`. Nothing was deployed and no live
provider, production database, backup, or restore was exercised.

## Fixed in source

| Problem | Change | Regression coverage |
| --- | --- | --- |
| AI reporting SQL could bypass the relation allowlist using comma joins or forged CTE text. | Validate actual AST table references with lexical, declaration-ordered CTE scopes. Explicitly traverse window and DISTINCT ON expressions omitted by the parser's default visitor. | Private tables in joins, subqueries, CTEs, unions, window expressions and DISTINCT ON; legitimate reporting queries remain accepted. |
| A historical uploader moved between sellers could attach and publish the previous seller's private blog media. | Check the current seller during attachment and revalidate persisted revision media during publication, including platform moderation. Repeat authorization predicates in the final transactional writes. | Cross-seller cover/inline rejection, tainted stored revisions, platform moderation, and legitimate same-seller image reuse across posts; PostgreSQL regression added. |
| Backups omitted homepage and story images; media deletion could race snapshot acquisition. | Inventory persisted homepage image references and story paths in the dump snapshot. Acquire the media lock before opening the snapshot. Coordinate story replacement/deletion and post-commit file cleanup. Reject referenced symbolic links. | Real encrypted archive round-trip with every media family, missing/unsafe paths, failure cleanup, and a PostgreSQL negative control demonstrating the old stale snapshot ordering. |
| An accepted bridge order could be submitted again after local persistence failed. | Retain provider references before ancillary work. Treat submission uncertainty as requiring reconciliation; never automatically requeue it. Conditional worker/state predicates prevent stale recovery or polling from overwriting committed outcomes. | Provider acceptance followed by persistence/audit failure, no-reference retry rejection, retained-reference reconciliation, lost commit acknowledgements, concurrent refund and changed worker claims. |

The SQL defect required owner approval and a database role capable of accessing
the private relation. A correctly restricted reporting role remains an important
independent control. The media defect required retained asset IDs and a real
seller reassignment; it was not an unauthenticated arbitrary-media read.

## Dependencies and build hygiene

Pinned transitive fixes in `pnpm-workspace.yaml` and regenerated the lockfile:

- `proxy-addr` 2.0.8
- `source-map-js` 1.2.2
- `fast-uri` 3.1.8
- `mysql2` 3.23.1
- `deepmerge-ts` 8.0.0
- `brace-expansion` 1.1.21 and 5.0.12 within their existing major-version lines

The production dependency audit reports **zero advisories**. CI now rejects high
as well as critical production advisories. Docker build context excludes `var`
directories, preventing default runtime uploads and backups from being copied
into new images. Existing images are unaffected until rebuilt.

One development dependency advisory remains: `braces` 3.0.3 through Next's ESLint
plugin / fast-glob / micromatch. No patched release is published for
[GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm).
It concerns deeply nested glob patterns. No untrusted HTTP-input path to this
development-tool usage was established. This advisory was not suppressed.

The critical [proxy-addr advisory](https://github.com/advisories/GHSA-jqcg-44mw-7w3h)
requires affected IPv6 trust-subnet configuration. This application's source
configures numeric proxy hops, so the package severity is not evidence that the
deployed application suffered that exploit.

## Verification status

- Pre-change `pnpm run doctor`: passed with Node 24.20.0, pnpm 12.3.4 and a current Prisma client.
- Final Windows API type-check, lint and build: passed.
- Web type-check after dependency updates: passed.
- Full API unit suite, including new regressions and controller-to-catalog coverage: passed with `node --test --test-concurrency=2 --test-reporter=dot 'dist/**/!(*.integration).spec.js'` from `apps/api`.
- Prisma configuration/schema validation with the patched dependencies: passed.
- PostgreSQL integration regressions: pending because Docker stopped responding. The initial sandbox unit attempt also exhausted its process/thread limit; it was superseded by the passing Windows run after the user's explicit sandbox override.
- `pnpm audit --prod --json`: zero advisories.
- `pnpm audit --json`: one high development advisory described above.
- `git diff --check`: passed.

The passing unit run used dummy records, an allowlisted environment,
`NODE_ENV=test`, `DISABLE_BACKGROUND_WORKERS=true`, and an intentionally
unreachable dummy database URL on `127.0.0.1:1`. No live provider or database was
contacted. The remaining verification is to apply migrations to a dedicated test
database and run `pnpm --filter topgsm-api test:integration` with `NODE_ENV=test`
and its dedicated `DATABASE_URL`.

Cleanup requests for task-created containers `topgsm-security-checks-initial`
and `topgsm-security-test-db` were submitted but could not be confirmed while
the Docker engine was unresponsive. No shared Docker service was restarted.

## Operational follow-through and limits

Create a fresh backup after deploying the backup fix. Old archives cannot gain
files that were never included. Historical tainted blog drafts now fail
publication and may require replacing their foreign media. Already published
assets and historical duplicate bridge submissions require separate review;
these fixes do not retroactively revoke or reverse them.

Deployed reporting-role privileges, proxy/network topology and real provider
configuration were not inspected. Production Docker stages still inherit
development dependencies and source from their base stage; minimizing those
images remains a separate build improvement. This remediation and the follow-up
review do not certify that every security problem in the codebase has been found.
