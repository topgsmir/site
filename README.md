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
local seed. It creates `admin` / `admin` only when the admin account is missing,
so database resets do not remove local dashboard access. This development
credential must never be used in a deployed environment. Production seeding is
disabled unless all `BOOTSTRAP_ADMIN_*` variables are explicitly configured,
and it rejects passwords shorter than 12 characters.

## Payment model

No Stripe integration is included in v1.
All payment logic is behind:
- `apps/api/src/integrations/payments/payment.interface.ts`
- `apps/api/src/integrations/payments/base-payment.adapter.ts`
- `apps/api/src/integrations/payments/providers/local-gateway/`

## Goghdi support chat

The storefront can load Goghdi Browser SDK 1.1.1 as a lazy ES module and open
an authenticated product-specific support ticket from product pages. Set the
SDK, tenant, API, and widget `NEXT_PUBLIC_GOGHDI_*` values shown in
`.env.example` (the socket URL is optional), then configure
`GOGHDI_TENANT_SECRET` only on the API service. The optional
`GOGHDI_SUPPORT_DEPARTMENT` must match a department configured in Goghdi.

The API never returns the tenant secret or signs caller-controlled ticket
objects. `POST /api/goghdi/product-ticket` requires a valid TopGSM session,
accepts only a product UUID, verifies that the product is active, constructs
the allowed Goghdi payload, and returns that payload with its HMAC signature.

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
