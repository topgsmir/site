# TopGSM Backend Conventions

Use this reference when implementing changes in `apps/api`.

## Placement

```text
apps/api/src/
  integrations/payments/       payment interfaces and provider adapters
  modules/<feature>/            controller, service, module, DTOs, guards
  prisma/                       Prisma service, schema, and migrations
packages/shared-types/          stable cross-package response/event types
```

Prefer a vertical feature module. Extract a shared service only after multiple modules need the same policy or capability.

## HTTP input

Define runtime DTO classes under the feature's `dto` directory. Apply validators for type, format, ranges, length, and collection bounds. Normalize deliberately in the application layer; validation alone does not establish ownership or trust.

```ts
export class ListProductsQueryDto {
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}
```

- Avoid inline `type CreateXDto = ...` declarations for request data.
- Validate path identifiers with an appropriate pipe or DTO.
- Whitelist sortable/filterable fields rather than passing client field names to Prisma.
- Do not use coercion where ambiguous values could change authorization or money behavior.

The global `ValidationPipe` currently whitelists, forbids unknown properties, and transforms input. Keep those protections enabled.

## Authentication context

Centralize token extraction and actor creation. Controllers and gateways should receive a verified actor object rather than parse cookies or authorization headers independently.

The actor should contain only trusted identity and coarse authorization context. Query current database state for sensitive decisions whose permissions, seller status, or account status may have changed since session issuance.

For seller-owned data, prefer a single scoped lookup:

```ts
const order = await prisma.orders.findFirst({
  where: { id: orderId, seller_id: actor.sellerId },
  select: { id: true, status: true, total_amount: true, currency: true }
});
```

Use a deliberate platform-admin branch rather than omitting the seller predicate dynamically.

## Prisma and PostgreSQL

- Keep `PrismaService` injection consistent.
- Use `select` by default. Use `include` only when the entire related record is genuinely needed and safe.
- Map database snake_case fields to API camelCase response objects.
- Use deterministic ordering with a unique tie-breaker for pagination.
- Put the matching index beside every sustained list/query access pattern.
- Use database-generated UUIDs or another collision-resistant ID, not timestamps.
- Express uniqueness, nonnegative values, valid ranges, and referential rules in the database where Prisma cannot fully express them, using reviewed migration SQL.
- Never edit an already-applied migration. Create a new migration.
- Use expand/backfill/validate/contract for risky production schema changes.

For write conflicts or state transitions, make the predicate part of the mutation and verify the affected row count. Wrap associated records in one transaction.

## Money

PostgreSQL `Decimal` is the current storage model for prices, commissions, holdbacks, and payouts.

- Keep values as `Prisma.Decimal` during calculations.
- Establish and enforce the currency scale and rounding mode at one boundary.
- Validate commission and holdback rules together, including their sum and the resulting nonnegative payable amount.
- Serialize money using a stable contract such as decimal strings; convert to display numbers only in presentation code when safe.
- Never trust a requested amount when it can be derived from the order and ledger.

## State machines and concurrency

Define allowed transitions explicitly for orders, payouts, payments, sellers, fulfillment, and digital delivery. Authorization may differ by transition.

Within a transaction:

1. identify the row using tenant and expected-state predicates;
2. perform the conditional update;
3. create immutable ledger/audit/outbox records;
4. fail when the expected state was not matched;
5. emit external notifications only after commit.

Use a unique idempotency key for operations clients/providers may repeat. The database, not an in-memory map, decides which request wins.

## Payment adapters

- Keep normalized internal requests/results in `payment.interface.ts`.
- Validate supported provider codes and throw a controlled exception when none exists.
- Keep provider secrets and signature logic inside the adapter.
- Persist initiation attempts and provider references before relying on callbacks.
- Treat redirects and client callbacks as untrusted hints; only a verified server-to-server result may settle payment.
- Redact provider requests/responses in logs.

## Realtime

- Reuse the HTTP authentication source of truth during the Socket.IO handshake.
- Use rooms such as `user:<id>`, `seller:<id>`, and explicit admin rooms after authorization.
- Do not place every connection in a global room.
- Validate inbound events and rate-limit expensive actions.
- Emit minimal response models without secrets or cross-tenant data.
- Keep database reads as the source of truth after reconnect.

## Errors and observability

- Translate expected domain failures into stable Nest exceptions.
- Log structured event names, request/correlation IDs, actor IDs when appropriate, resource IDs, duration, and safe error categories.
- Never log credentials or full personal/payment payloads.
- Add metrics for latency, error rate, database saturation, payment verification, idempotency conflicts, and socket connection/event volume where infrastructure supports them.

## Verification commands

From the repository root:

```bash
pnpm --filter topgsm-api type-check
pnpm --filter topgsm-api lint
pnpm --filter topgsm-api build
pnpm --filter topgsm-api prisma:generate
```

Do not run production migrations as a casual validation step. Test migration SQL against a disposable database first.
