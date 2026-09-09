---
name: topgsm-backend
description: Builds, changes, and reviews the TopGSM NestJS API with secure authorization, runtime-validated contracts, Prisma/PostgreSQL data integrity, seller isolation, payment safety, authenticated Socket.IO behavior, and performance-safe queries. Use when working in apps/api or changing authentication, sellers, products, orders, payouts, payments, realtime events, Prisma access, API DTOs, guards, controllers, or services.
---

# TopGSM Backend Engineering

Treat security, correctness, data integrity, and operational safety as part of the feature. Do not copy a weak existing pattern merely because it already exists.

## Project context

- The API is NestJS 12 under `apps/api/src`. Type-checking uses the TypeScript 7 native CLI, while the `typescript` package remains aliased to TypeScript 6 for tools that require the programmatic compiler API; do not remove that compatibility alias until those consumers support TypeScript 7. Treat the package manifests as the source of truth for exact patch versions.
- Persistence is PostgreSQL through Prisma 7 and its PostgreSQL driver adapter. The schema and migrations are under `apps/api/src/prisma/schema`, while datasource and seed configuration live in `apps/api/prisma.config.ts`.
- Prisma generates TypeScript into `apps/api/src/generated/prisma`. Import its runtime and types through `apps/api/src/prisma/client.ts`, not directly from `@prisma/client` or generated internals.
- The API serves a multi-seller marketplace with platform admins, seller admins/staff, and buyers.
- High-risk domains are authentication, seller isolation, orders, payments, payouts, digital delivery, and realtime events.
- Shared compile-time contracts live in `packages/shared-types`, but HTTP and socket inputs still require runtime validation.
- Read [PROJECT-CONVENTIONS.md](PROJECT-CONVENTIONS.md) before implementing a backend change. Use [REVIEW-CHECKLIST.md](REVIEW-CHECKLIST.md) before completing security-, money-, tenant-, or data-sensitive work.

For PostgreSQL schema, index, constraint, or migration work, also use the project `postgres` skill and its relevant reference.

## Workflow

### 1. Establish the boundary

Before editing:

1. Inspect the affected controller, service, module, DTOs, Prisma models, callers, and shared response types.
2. Identify the authenticated actor, allowed roles/permissions, seller or buyer boundary, owned resource, and fields the client is allowed to control.
3. Define invariants and legal state transitions, including concurrent and repeated requests.
4. Estimate query cardinality and identify required pagination, indexes, transaction boundaries, and external-service failure behavior.
5. Search for existing helpers and conventions before introducing another abstraction.

Never assume authentication implies authorization. Never use a client-provided `sellerId`, `buyerId`, role, price, commission, payout amount, or ownership field as proof of authority.

### 2. Design the slice

Keep the dependency direction:

```text
controller or gateway -> application service -> Prisma/provider adapter
```

- Controllers translate HTTP concerns and delegate. They do not own mutable state or business rules.
- Gateways authenticate connections/messages and delegate. They do not broadcast private data globally.
- Services enforce business invariants and resource-level authorization close to the query or mutation.
- Prisma access stays in services or focused repositories when query complexity justifies one.
- Define reusable Prisma selections with object literals that `satisfy` the generated `Prisma.<model>Select` type. Prisma 7 no longer provides `Prisma.validator`.
- Provider-specific payment behavior stays behind the payment adapter boundary.
- Feature modules own their controllers, services, guards, DTOs, and tests.

Use concrete DTO classes with `class-validator` for every untrusted body, query, path, socket message, webhook, and job payload. Type aliases and interfaces disappear at runtime and are not validation.

### 3. Implement secure defaults

#### Authentication and authorization

- Deny access by default. Make public endpoints explicit.
- Use guards for route-level authentication and coarse roles; enforce tenant/resource ownership in the service query itself.
- Scope seller reads and writes with `seller_id` derived from the verified actor. Scope buyer operations with `buyer_id` derived from the verified actor.
- Keep platform-admin bypasses explicit, narrow, and auditable.
- Return `401` for missing/invalid authentication, `403` for authenticated but forbidden access, and `404` when hiding another tenant's resource is appropriate.
- Do not extend hand-rolled token or cookie parsing. Prefer one centralized, well-tested authentication mechanism and vetted cryptographic libraries.
- Cookie-authenticated mutations require CSRF protection or strict Origin/Fetch-Metadata validation in addition to CORS. Cookies must be `HttpOnly`, `Secure` in production, deliberately scoped, and use the strictest compatible `SameSite` policy.
- Rate-limit login, registration, password operations, payment initiation/verification, payout transitions, webhooks, and other abuse-sensitive endpoints.
- Never log passwords, tokens, cookie values, provider secrets, full webhook bodies, or unnecessary personal data.

#### Tenant and response isolation

- Fetch a resource with ownership constraints in the same query; avoid fetch-then-authorize races.
- Use explicit Prisma `select` projections. Do not load or serialize password hashes, secrets, internal flags, or unrelated tenant data.
- Do not reveal account existence through inconsistent auth responses or detailed errors.
- Authenticate Socket.IO handshakes, authorize every client-originated event, join only actor/tenant-scoped rooms, validate payloads, and configure the same explicit origin allowlist as HTTP.

#### Orders, payments, and payouts

- Read products, seller terms, price, currency, buyer identity, and payable amounts from authoritative server-side records.
- Never calculate money with JavaScript floating point. Use Prisma `Decimal` consistently or an explicitly documented integer minor-unit representation.
- Make create/verify/refund/webhook/payout operations idempotent with a database-enforced key or provider reference.
- Verify provider signatures, timestamps, amount, currency, merchant/account, and order association before changing state.
- Model allowed state transitions and reject illegal or repeated transitions atomically.
- Put ledger writes, order transitions, inventory changes, and outbox/event records in the same database transaction when they form one business operation.
- Treat realtime emission as notification, never as the source of truth. Emit after commit; use an outbox for delivery that must survive process failure.

### 4. Preserve data integrity and performance

- Never use module-level arrays or process memory as durable marketplace state.
- Back invariants with PostgreSQL constraints and unique indexes, not only application checks.
- Use transactions for multi-record invariants, and choose an isolation/locking strategy when concurrent writes can violate them.
- Add indexes based on real filter, join, uniqueness, and ordering patterns; verify generated SQL for hot or complex paths.
- Avoid unbounded `findMany`, list-all endpoints, deep `include`, N+1 queries, and offset pagination on large/changing tables. Prefer capped cursor pagination and narrow projections.
- Bound string lengths, array sizes, page sizes, upload sizes, socket payloads, and batch operations.
- Use timeouts and bounded retries with jitter for external calls. Retry only safe or idempotent operations.
- Cache only reads with a clear staleness policy and tenant-safe keys. Do not cache authorization decisions or money state casually.
- Keep synchronous CPU-heavy work, large exports, and fan-out notification work off the request path.

### 5. Return predictable API behavior

- Throw appropriate Nest exceptions instead of returning `{ message: ... }` with a successful status.
- Keep response shapes explicit and stable. Map Prisma records to response models rather than returning raw models.
- Use opaque stable identifiers, UTC ISO timestamps at the boundary, normalized currencies, and documented Decimal serialization.
- Do not expose stack traces, database details, or provider responses to clients.
- Preserve backward compatibility unless the user explicitly authorizes a breaking change.

### 6. Test and verify

Add tests proportional to the risk:

- unit tests for validation, calculations, and state-transition rules;
- integration tests with PostgreSQL for constraints, tenant scoping, transactions, idempotency, and concurrency;
- e2e tests for authentication, authorization, status codes, sanitization, and socket room isolation;
- provider contract tests for payment adapters and signed webhook fixtures.

Cover success, invalid input, unauthenticated, wrong role, cross-tenant access, duplicate/replayed request, illegal transition, and concurrent execution where relevant.

Run the narrowest relevant checks, then the API checks when practical:

```bash
pnpm --filter topgsm-api run prisma:generate
pnpm --filter topgsm-api run type-check
pnpm --filter topgsm-api run lint
pnpm --filter topgsm-api run test
pnpm --filter topgsm-api run build
```

The unit-test script compiles the API before running Node's test runner so Prisma 7's generated `.js` import specifiers resolve against compiled output. Do not switch these tests back to direct ts-node source loading. Run focused tests when test tooling exists; if it does not, report that gap and do not claim runtime behavior was tested. For Prisma changes, generate the client, inspect the migration SQL, test against a disposable database, and document rollout/rollback considerations.

## Handling existing problems

When a touched path contains a credible security bug, correctness defect, or meaningful best-practice/performance issue:

1. Do not reproduce or worsen it.
2. Fix it when necessary for the requested change and within scope.
3. Otherwise report severity, file/location, impact, evidence, and the smallest remediation separately.
4. Distinguish confirmed defects from risks requiring validation.

Do not expand a focused feature into unrelated cleanup without authorization.

## Completion response

Report:

- the API behavior and files changed;
- authorization, tenant, transaction, and validation decisions;
- database/query and performance impact;
- checks and tests run, including anything not verified;
- credible pre-existing risks encountered in the touched scope.
