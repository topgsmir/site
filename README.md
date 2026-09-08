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

1. Copy `.env.example` to `.env` and set values.
2. Install dependencies:
   - `pnpm install`
3. Start DB first and then APIs/UI:
   - `docker compose up -d postgres`
   - `pnpm -C apps/api dev`
   - `pnpm -C apps/web dev`

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
