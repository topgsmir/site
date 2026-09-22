# TopGSM (Node + Next.js + PostgreSQL + Socket.IO)

TopGSM is scaffolded as a multi-seller marketplace monorepo with:
- Next.js storefront and dashboards
- NestJS API with Socket.IO
- PostgreSQL persistence model
- Product support for `digital`, `physical`, and `service`
- In-app payout ledger and admin seller payout flow
- Payment abstraction prepared for local provider adapters (no Stripe)

## Structure

- `apps/web` — Next.js frontend (Persian-first, RTL-ready)
- `apps/api` — NestJS backend + Socket.IO gateway
- `packages/shared-types` — shared TS types/enums
- `packages/shared-config` — shared lint/type tooling configs
- `packages/db-client` — Prisma client wrapper
- `infrastructure` — docker artifacts

## Setup

1. Activate Node 24.20.0 (the latest LTS release).
2. Enable the pinned package manager:
   - `corepack enable`
   - `corepack install --global pnpm@12.3.4`
3. Copy `.env.example` to `.env` and set values.
4. Bootstrap dependencies and generated code:
   - `pnpm bootstrap`
5. Verify the worktree:
   - `pnpm run doctor`
6. Start DB first and then APIs/UI:
   - `docker compose up -d postgres`
   - `pnpm -C apps/api dev`
   - `pnpm -C apps/web dev`

`pnpm bootstrap` performs a frozen, non-interactive install from pnpm's shared
content store, generates the Prisma client, verifies the lockfile did not
change, and runs the worktree doctor. Do not copy `node_modules` from another
worktree; each worktree must create its own lightweight links.

## Worktrees

Create a feature worktree from the latest `origin/main` and bootstrap it in one
command:

```bash
pnpm worktree:create -- codex/my-feature
```

Pass a second argument to choose the destination path. The default is a sibling
directory derived from the branch name. For a long-running feature branch,
commit or stash local changes and periodically run:

```bash
pnpm worktree:sync
```

That command fetches `origin/main`, merges it into the clean feature branch,
and reruns the deterministic bootstrap. Secrets belong in ignored local env
files or the environment's secret manager, never in committed configuration.

The API development command applies pending migrations and runs an idempotent
owner seed. No default credential is created. To bootstrap the protected platform
owner, configure all four `BOOTSTRAP_ADMIN_*` variables; passwords shorter than
12 characters are rejected. Once the owner exists, remove those bootstrap values
from the runtime environment.

## Payment model

No Stripe integration is included in v1.
All payment logic is behind:
- `apps/api/src/integrations/payments/payment.interface.ts`
- `apps/api/src/integrations/payments/base-payment.adapter.ts`
- `apps/api/src/integrations/payments/providers/local-gateway/`

## Goghdi support chat

The customer order history loads Goghdi Browser SDK 2.0 lazily and can open one
private conversation for each eligible physical, service, or bridge order.
Platform admins configure the public SDK connection and encrypted tenant secret
under **Admin → Settings → Goghdi chat**, then assign each seller the 24-character
Goghdi agent ID in the seller editor. The `NEXT_PUBLIC_GOGHDI_*` and
`GOGHDI_TENANT_SECRET` values in `.env.example` remain deployment fallbacks.

The API never returns the tenant secret or signs caller-controlled ticket
objects. `POST /api/goghdi/order-ticket` requires an authenticated buyer, scopes
the order lookup to that buyer, derives the selected seller and products from the
database, and signs the SDK 2.0 `{ timestamp, nonce, signature }` proof with only
that seller's agent ID. The stable `order:<uuid>` ticket key opens the existing
conversation on later clicks instead of creating duplicates.

## Backup and restore

Platform owners manage encrypted database and upload backups under **Admin →
Settings → Backup & Restore**. Backups are created online from an exported
PostgreSQL snapshot and can be retained locally or delivered to verified SFTP,
explicit-FTPS, and explicitly acknowledged plain-FTP destinations. Private and
local destination addresses are blocked unless their exact address or CIDR is
listed in `BACKUP_DESTINATION_ALLOWED_CIDRS`.

Mount `BACKUP_ROOT` on persistent storage and configure independent 32-byte
base64 key rings in `BACKUP_ARCHIVE_CREDENTIAL_KEYS` and
`BACKUP_DESTINATION_CREDENTIAL_KEYS`. Archive keys are deployment secrets, not
database settings: back them up separately and retain every old key-ring entry
while an archive may still be needed. Losing an archive key permanently makes
the corresponding encrypted backups unrecoverable.

The API image includes PostgreSQL 16 client tools. Production startup applies
pending migrations before normal service, but detects a pending restore first
so the pre-Nest maintenance runner can replace and migrate the database without
opening application pools. The container must use a restart policy (the Compose
configuration uses `unless-stopped`) for confirmed restores to continue after
the API exits. Multi-host deployments must share `BACKUP_ROOT`, including its
`state` directory, between every API instance.

## Tests

The repository requires Node 24.20.0 and pnpm 12.3.4. Run the fast unit suite
and its separate full-project type-check with:

```sh
pnpm run type-check
pnpm run test
```

Integration tests require a migrated, dedicated PostgreSQL database whose name
contains a standalone `test` segment, such as `topgsm_test`. They fail closed
instead of connecting to a development or production database:

```sh
NODE_ENV=test DATABASE_URL=postgresql://topgsm:topgsm@localhost:5432/topgsm_test pnpm --filter topgsm-api prisma:migrate
NODE_ENV=test DATABASE_URL=postgresql://topgsm:topgsm@localhost:5432/topgsm_test pnpm run test:integration
```
