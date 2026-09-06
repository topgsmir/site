# TopGSM Security Remediation Plan

## Scope and validation method

This plan validates the 2026-09-06 audit dossier against the working tree as inspected before remediation. The dossier is treated as context, not as a finding list. Evidence below refers to that inspected code, including existing uncommitted work.

The review covered the externally reachable NestJS controllers and Socket.IO gateway, their guards and services, authentication/token and cookie handling, payment adapter boundary, Prisma schema and every checked-in migration, module wiring, shared contracts, relevant web callers, and the corresponding records under `audit-context/functions/`.

Severity meanings:

- **Critical:** direct unauthenticated or cross-tenant control of order/payout integrity.
- **High:** exploitable protection failure, durable-data/integrity failure, or unsafe production/deployment boundary.
- **Medium:** meaningful defense, privacy, correctness, or availability weakness whose exploitability is narrower or whose affected path is not yet production-reachable.

## Implementation status — 2026-09-07

The recommended authentication-foundation phase is implemented and verified:

- sessions are opaque, database-backed, stored only as SHA-256 token hashes, expire after seven days, and can be revoked individually or per user;
- logout revokes the presented session; vendor password changes and suspension/invited transitions revoke all sessions for that user;
- one global exact-Origin guard protects cookie-authenticated unsafe methods, while login/registration are explicitly marked as browser-session mutations;
- login and registration use atomic PostgreSQL rate-limit buckets keyed by hashed account/email and client IP values, with stale-bucket cleanup;
- actor resolution is centralized for platform-admin and seller-product guards;
- startup validates exact web origins, HTTPS origins in production, cookie-domain syntax, and explicit proxy-hop configuration;
- the web middleware now treats the opaque cookie only as a redirect hint and leaves authoritative verification to the API;
- a missing initial migration and additive auth session/rate-limit migration were added. The disposable local `topgsm` database was reset and the complete migration chain applied successfully, then checked for zero Prisma drift.

The approved critical order/payout/realtime phase is also implemented:

- every order and payout route requires a verified actor and uses buyer/seller ownership predicates derived from that actor;
- buyers create one-seller orders from an active offer ID and quantity only; seller identity, price, currency, commission, holdback, and payout amounts are resolved and snapshotted server-side;
- IRR calculations use `Prisma.Decimal`, half-up integer rounding, and PostgreSQL constraints for nonnegative integral amounts, rate ranges/sums, and exact ledger equality;
- order creation, inventory decrement, one-order payout draft, immutable event, and outbox write share one serializable transaction;
- actor-specific order and payout transitions use expected-state conditional updates, database-backed UUID idempotency keys/fingerprints, immutable events, and outbox writes;
- order/payout reads are capped, cursor-paginated, indexed, and tenant-scoped; cross-tenant resource mutations return 404;
- order and payout mutations have shared PostgreSQL account/IP rate-limit buckets;
- Socket.IO now enforces the exact HTTP origin allowlist and session authentication at the engine handshake, joins only user, permission-specific seller-order/seller-payout, and platform rooms, and consumes committed outbox records with row locking and bounded attempts;
- PostgreSQL integration tests cover authoritative money, idempotency, cross-buyer isolation, concurrent stock reservation, legal transitions, payout lifecycle, audit rows, and outbox rows.

F-01, F-02, the order/payout portion of F-03/F-04/F-05/F-06/F-08/F-13, and the single-instance confidentiality/durability portion of F-11 are remediated for disposable/fresh environments. Payment-provider settlement, seller agent/invite persistence, multi-instance Socket.IO fan-out, and non-disposable database adoption remain open.

## 1. Confirmed findings

### F-01 — Critical — Order routes have no authentication, authorization, ownership, or authoritative pricing

**Evidence:** `apps/api/src/modules/order/order.controller.ts:26-73` exposes `GET /api/orders`, `POST /api/orders`, and `PATCH /api/orders/:id/status` without a guard. `CreateOrderDto` is a TypeScript-only alias at lines 6-12. The create handler accepts `buyerId`, `sellerId`, `productType`, `amount`, and `currency` directly from the body at lines 38-47. The list returns every order at lines 33-36. The update handler finds by caller-supplied ID alone and assigns the caller-supplied status at lines 55-70.

**Affected routes/files:** all routes in `order.controller.ts`; the order/payout/realtime effects it invokes.

**Attack scenario:** an anonymous caller creates an order attributed to any buyer and seller at an arbitrary or malformed amount/currency, enumerates all in-process orders, then changes any known order to `delivered`, `cancelled`, or an arbitrary runtime value.

**Impact:** cross-tenant confidentiality loss; forged orders; incorrect seller liabilities and payouts; unauthorized fulfillment/cancellation; untrusted realtime notifications. Because order creation feeds the payout ledger, this is a direct money-integrity boundary failure.

**Smallest remediation:** after the policy decisions below are answered, require a verified actor on every route, derive the buyer from that actor, resolve seller/offer/price/currency from active PostgreSQL records, scope reads and conditional updates by actor/tenant, and validate concrete DTO classes. Do not accept a total, seller identity, or buyer identity as authority from the client.

### F-02 — Critical — Payout ledger and transitions are publicly readable and writable

**Evidence:** `apps/api/src/modules/payout/payout.controller.ts:15-37` has no guards. `GET /api/payouts` returns the full ledger, `GET /api/payouts/:id` looks up by ID alone, `POST /api/payouts/requests` trusts a body-supplied `sellerId`, and `PATCH /api/payouts/requests/:id` forwards a body-supplied status. `payout.service.ts:59-89` performs no actor or tenant checks and permits direct status overwrite. `requestedAmount` is checked only with `>` and is not persisted (`payout.service.ts:67-80`).

**Affected routes/files:** all routes in `payout.controller.ts`; `payout.service.ts`.

**Attack scenario:** an anonymous caller enumerates seller payout data, marks another seller's row requested, approved, settled, or disputed, or submits a negative/coerced amount that passes the lone upper-bound comparison.

**Impact:** payout fraud, false settlement records, cross-seller financial disclosure, and loss of ledger integrity.

**Smallest remediation:** split seller request operations from platform finance approval/settlement operations; derive seller scope from the verified actor; remove client control of payable amount; apply conditional expected-state updates in PostgreSQL; and return 404 for out-of-scope resources where tenant existence should be hidden.

### F-03 — High — Orders, payouts, seller invitations, and agent mutations use process-local arrays

**Evidence:** module-level arrays exist at `order.controller.ts:24`, `payout.service.ts:16`, and `seller.controller.ts:12,23-29`. Their handlers mutate these arrays directly. The Prisma `orders` and `payout_ledger` models at `apps/api/src/prisma/schema/schema.prisma:266-300` are not used by the active handlers. No Prisma models exist for the current invite or agent stores.

**Affected routes/files:** order, payout, seller invite, and seller agent controllers/services.

**Attack/failure scenario:** a restart loses marketplace and accounting state; two API replicas expose divergent orders/ledgers; two requests in the same millisecond collide; a payout operation reaches a different replica and cannot find its order.

**Impact:** permanent data loss, inconsistent financial state, duplicate identifiers, and behavior that cannot be made tenant-safe or horizontally scalable.

**Smallest remediation:** replace each store by a focused Prisma-backed slice. Migrate orders and payouts first; do not combine agent/invite persistence into the money migration.

### F-04 — High — Order, payout, and realtime effects have no atomic or durable event boundary

**Evidence:** `order.controller.ts:40-52` appends an order, separately appends a payout draft, then emits Socket.IO. Lines 60-72 separately mutate order state, mutate payout state, and emit. `payout.service.ts:42-56,67-89` uses last-writer-wins assignments. There is no transaction, expected-state predicate, audit/ledger event, or outbox model in `schema.prisma`.

**Affected routes/files:** `order.controller.ts`, `payout.service.ts`, `realtime.gateway.ts`, Prisma schema.

**Attack/failure scenario:** concurrent or repeated requests produce illegal transitions; a process failure leaves order and payout state disagreeing; an event is emitted for state that is not durably committed, or a committed change has no event.

**Impact:** double processing, payout/order disagreement, misleading clients, and no reliable recovery or audit trail.

**Smallest remediation:** transact the conditional order transition, immutable financial/audit record, payout effect, and outbox row together. Emit only after commit through an outbox worker for delivery that must survive failure.

### F-05 — High — Money calculations and seller terms are not safely authoritative

**Evidence:** `payout.service.ts:20-39` uses JavaScript floating point, hard-coded 10%/5% terms, caller-supplied gross amount/currency, and independent `toFixed(2)` rounding. The seller's stored `commission` and `holdback_rate` are ignored by that path. `seller.service.ts:52-53,123-128` accepts the two rates independently; DTOs constrain each to 0..1 but do not constrain their sum (`vendor.dto.ts:57-67,108-120`). `schema.prisma:87-88,271-272,286-290` lacks explicit precision/scale and CHECK constraints for seller rates, nonnegative order/payout amounts, currency shape, component equality, or nonnegative payable amount.

**Affected routes/files:** payout service, seller DTO/service, order creation, `sellers`, `orders`, and `payout_ledger` models.

**Attack/failure scenario:** an attacker exploits F-01 to choose totals; ordinary decimal edge cases or invalid seller terms cause rounding drift or a negative payable amount; future direct/database writers bypass DTO-only checks.

**Impact:** under/overpayment, irreconcilable ledger totals, and inconsistent currency/rounding behavior.

**Smallest remediation:** establish a currency scale/rounding policy; use `Prisma.Decimal` from validated decimal strings through persistence/serialization; snapshot authoritative offer price, currency, seller, commission, and holdback when creating the order; add PostgreSQL checks after validating existing data.

### F-06 — High — No legal order or payout transition graph is enforced

**Evidence:** Prisma enums list possible labels (`schema.prisma:40-55`) but not legal edges or actors. `order.controller.ts:65` and `payout.service.ts:48-54,79,88` assign statuses without checking the prior status or caller authority. The type-only HTTP bodies provide no runtime enum validation.

**Affected routes/files:** order and payout mutation routes and services.

**Attack scenario:** a caller moves `pending` directly to `delivered`, a seller marks its own payout settled, a cancelled order later becomes delivered, or replayed requests repeat fulfillment/accounting effects.

**Impact:** unauthorized fulfillment and settlement, replay/double-effect risk, and legally inconsistent records.

**Smallest remediation:** encode an approved actor/action/state matrix and implement each transition as an atomic `updateMany` (or locked transaction) whose predicate contains tenant and expected state; require exactly one affected row.

### F-07 — High — Cookie-authenticated admin mutations lack CSRF/origin enforcement

**Evidence:** session credentials are accepted from the `topgsm_session` cookie (`auth/session-token.ts:3-15`). Platform-admin vendor mutations use `PlatformAdminGuard`, but that guard only authenticates and role-checks (`platform-admin.guard.ts:30-43`). `POST /auth/login`, `POST /auth/register`, and `POST /auth/logout` also have no origin/CSRF control (`auth.controller.ts:28-63`). Product mutations have a route-specific Origin/Fetch-Metadata check (`seller-products.guard.ts:35,59-89`), proving the protection is not centralized or applied to other cookie-authenticated mutations. `SameSite=Lax` at `auth.controller.ts:73-83` is useful defense-in-depth but is not a complete same-site/subdomain CSRF policy.

**Affected routes/files:** auth mutations, seller vendor mutations, and every future cookie-authenticated mutation; product guard contains a partial local implementation.

**Attack scenario:** a malicious same-site sibling origin, compromised allowed origin, or request context not blocked by SameSite causes an authenticated admin browser to create/update a vendor or changes the browser's authenticated session.

**Impact:** vendor/account takeover through password changes, malicious commission/status/permission changes, login CSRF/session confusion, and inconsistent protection across modules.

**Smallest remediation:** centralize strict allowed-Origin plus Fetch-Metadata enforcement for all unsafe cookie-authenticated methods, or use a robust CSRF token design. Bearer-authenticated non-browser requests may follow a separately documented policy. Test every mutation category.

### F-08 — High — Authentication and money-sensitive endpoints have no abuse rate limits

**Evidence:** no throttling dependency, global guard, route decorator, or limiter is present in `apps/api/package.json`, `app.module.ts`, or `apps/api/src`. Login and registration perform scrypt/database work (`auth.service.ts:52-104,242-296`). Order and payout endpoints are also unlimited.

**Affected routes/files:** auth controller; current/future payment, payout, order, webhook, password, and upload endpoints.

**Attack scenario:** distributed or single-source attempts brute-force credentials, consume CPU through repeated scrypt calls, fill the users table, or replay money-sensitive operations.

**Impact:** account compromise risk, CPU/database denial of service, storage abuse, and amplification of payment/payout races.

**Smallest remediation:** add endpoint-class-specific limits keyed by normalized account identifier plus trusted client IP where appropriate, with proxy trust explicitly configured. Use a shared backend for multi-instance deployments and avoid logging credentials.

### F-09 — High — Session revocation is impossible before the fixed seven-day expiry

**Evidence:** `auth.service.ts:24,137-203` creates stateless seven-day HMAC tokens. `getUserFromToken` reloads the user, role, and permissions but checks no session row, token version, password-change timestamp, logout marker, or compromise/revocation state (`auth.service.ts:107-126`). Logout only expires the current browser cookie (`auth.controller.ts:59-63`). Vendor password changes do not invalidate existing tokens (`seller.service.ts:93-110`).

**Affected routes/files:** auth service/controller; seller password update.

**Attack scenario:** a stolen token remains usable after logout or password reset until expiry, unless the entire user is deleted or the global secret is rotated.

**Impact:** prolonged account/admin compromise and no selective incident response.

**Smallest remediation:** choose a server-side session table or per-user token/session version; rotate on password/security changes and allow per-session/all-session revocation. Store only a token hash or opaque session ID, not bearer secrets.

### F-10 — High (deployment-dependent) — Example/Compose configuration can run with an accepted shared placeholder secret and insecure cookies

**Evidence:** `.env.example:2,15` sets `NODE_ENV=development` and `JWT_SECRET=replace-with-a-random-secret-of-at-least-32-characters`. `docker-compose.yml:23,38` loads that file for running services and exposes API/web/database ports. `auth.service.ts:206-218` only rejects weak placeholders in exact `production`, and checks the different literal `replace-with-secret`; the supplied example placeholder is long enough to pass. `auth.controller.ts:83` adds `Secure` only for exact production.

**Affected files:** `.env.example`, `docker-compose.yml`, auth config/cookie code.

**Attack scenario:** if Compose or a similar environment is internet-facing, anyone who knows the repository placeholder can forge valid sessions; cookies are transmitted without `Secure` where HTTP is possible.

**Impact:** complete account impersonation, including platform-admin if an ID is known, and session theft risk.

**Smallest remediation:** fail fast in every non-test runtime on known placeholders/insufficient entropy, require explicit deployment mode and HTTPS cookie policy, generate secrets outside the repository, and clearly label/isolate development Compose. Secret rotation will invalidate all existing stateless tokens.

### F-11 — High — Socket.IO accepts unauthenticated cross-origin clients and broadcasts order events globally

**Evidence:** `realtime.gateway.ts:10-17` configures `origin: "*"`, performs no handshake authentication, and joins every connection to `global`. Order events are sent to that room at lines 19-24. No code joins authorized admins to `admin-notifications`, while lines 25-29 emit there. The web client supplies no explicit authentication (`apps/web/src/lib/sockets/socket.ts:6-10`).

**Affected files:** realtime gateway/module and web socket client.

**Attack scenario:** any origin connects directly and observes order IDs/status changes across all sellers; horizontal deployment also produces incomplete events without a shared Socket.IO adapter.

**Impact:** cross-tenant operational-data disclosure, unauthorized subscriptions, unusable admin notification semantics, and inconsistent realtime delivery.

**Smallest remediation:** authenticate the handshake using the centralized session verifier; apply the HTTP origin allowlist; join only `user:<id>`, `seller:<id>`, and explicit authorized admin rooms; emit minimal tenant-scoped models after commit. Add shared-adapter/outbox behavior only if realtime must span replicas/survive failures.

### F-12 — High — Checked-in migration history cannot build a fresh database

**Evidence:** the first migration, `20260905000000_add_user_password/migration.sql:1-3`, begins with `ALTER TABLE "users"`; later migrations alter `sellers` and `products`. No checked-in migration creates the base `users`, `sellers`, legacy products, `orders`, or `payout_ledger` tables. The current large product migration assumes all legacy tables/columns exist and later drops them (`20260906100000_add_shared_catalog_and_seller_offers/migration.sql:7-32,34-56,471-490`).

**Affected files:** `apps/api/src/prisma/schema/migrations/**`; deployment/recovery process.

**Attack/failure scenario:** a fresh environment, disaster recovery database, CI database, or new tenant runs `prisma migrate deploy` and fails on the first statement.

**Impact:** unrepeatable deployments and restores, inability to run trustworthy PostgreSQL integration tests, and pressure to use unsafe schema pushes/manual repair.

**Smallest remediation:** decide whether production already has an externally created baseline. Create a reviewed baseline strategy using Prisma migration resolution for existing databases and a fresh-install path; never rewrite migrations already applied to a shared environment without an explicit re-baselining procedure.

### F-13 — High — Order/payment/payout idempotency records and database-enforced keys are absent

**Evidence:** order IDs are `Date.now()` strings and every POST appends (`order.controller.ts:40-47`). Payout request transitions have no idempotency key (`payout.service.ts:67-80`). The schema has no payment intent/attempt/provider-reference/idempotency table and no outbox. The local adapter creates references with `Date.now()` (`local-gateway.adapter.ts:12-17`).

**Affected files:** order, payout, payment adapter/service, Prisma schema.

**Attack/failure scenario:** client retries, provider callbacks, network timeouts, or concurrent requests create duplicate orders or repeat fulfillment/settlement side effects.

**Impact:** duplicate charges/orders/payouts and ambiguous recovery.

**Smallest remediation:** define operation-scoped idempotency keys and unique provider references in PostgreSQL, store request fingerprints/results, and make duplicates return the original outcome or a conflict when fingerprints differ.

### F-14 — Medium — Public seller invite and agent mutation routes lack validation and persistence; invite listing exposes personal data

**Evidence:** `seller.controller.ts:67-89` exposes agent list/create and invite list/create without guards. Create bodies are TypeScript-only types. Invite records contain owner name, email, and phone. `GET /seller/agents` is intentionally called by the public homepage (`apps/web/src/app/[locale]/page.tsx:100`), but the same controller returns phone values and permits anonymous creation.

**Affected routes/files:** `GET/POST /api/seller/agents`, `GET/POST /api/seller/invites`, seller controller.

**Attack scenario:** anonymous users enumerate applicant PII, spam invitations, or inject malformed/fake agents displayed by the public API process.

**Impact:** privacy breach, integrity loss, spam, and restart loss. Public agent discovery itself is not automatically a defect; the public projection and phone policy require a product decision.

**Smallest remediation:** keep only the explicitly approved public agent projection public; protect agent administration and invite listing; rate-limit and validate any public application/invite request; persist accepted records with status/audit fields.

### F-15 — Medium — Vendor financial/status invariants are application-only and vendor listing is unbounded

**Evidence:** `seller.service.ts:19-29` performs an unbounded admin `findMany`. The service maps status from three columns (`seller.service.ts:174-203`), but PostgreSQL has no constraint preventing contradictory combinations. Commission and holdback constraints, including their sum, are absent from migration SQL/schema. DTOs do not cap permission array length (the enum currently bounds unique practical values, but a direct DB writer is still governed only by enum/composite PK).

**Affected files:** seller service/DTO; `sellers` schema and migrations.

**Attack/failure scenario:** a large seller population exhausts response memory/latency; direct or future code writes contradictory seller status or financially invalid terms.

**Impact:** admin endpoint availability degradation and invalid seller/payout policy state.

**Smallest remediation:** paginate with deterministic ordering and matching index; after deciding the canonical seller-status representation, enforce it and financial rate constraints in PostgreSQL.

## 2. False positives, already-fixed items, and dormant candidates

### Already fixed in the current working tree

- **Product mutation authentication and seller derivation:** `product.controller.ts:32-82` protects seller list/create/offer routes with `SellerProductsGuard`; `seller-products.guard.ts:23-56` verifies the current user, role, active seller state, and `products_manage`, then derives `sellerId` from PostgreSQL. The client no longer supplies seller authority.
- **Product runtime validation:** concrete decorated DTOs in `product/dto/product.dto.ts` bound IDs, enums, strings, arrays, money-string format, and fulfillment fields. The global pipe at `main.ts:18-20` whitelists, forbids extra fields, and transforms.
- **Product persistence and tenant scoping:** `product.service.ts:125-573` uses Prisma, transactions for multi-table writes, `Prisma.Decimal`, scoped seller lookups/updates, explicit selects, capped seller pagination, and UUIDs. Public product reads expose only active products/offers from active sellers and do not expose digital file references (`product.service.ts:125-313`).
- **Vendor administration authentication and DTO validation:** `seller.controller.ts:35-65` uses `PlatformAdminGuard`; vendor DTO classes are decorated and writes are transactional (`seller.service.ts:32-159`). CSRF, pagination, and DB invariants remain open as F-07/F-15.
- **Current-role refresh:** API authorization does not trust the token's role snapshot. `auth.service.ts:107-126` verifies the token and reloads the user, role, seller permissions, and user existence before returning the actor.
- **Basic credential handling:** login uses a generic error and dummy scrypt hash (`auth.service.ts:82-104`), passwords use salted scrypt and timing-safe comparison (`auth.service.ts:242-296`), and auth request DTOs have runtime length/format checks.
- **HTTP CORS is no longer globally permissive:** `main.ts:10-20` uses a configured allowlist and credentialed CORS. CORS does not replace CSRF, and Socket.IO still has its own wildcard policy.

### Not currently a reachable vulnerability

- **Payment adapter behavior:** `PaymentService` has no controller or repository caller. Therefore the local adapter's prefix-only `verify` and unconditional `refund` are not currently externally exploitable. They are unsafe scaffolding and must not be connected to real money until provider verification, persistence, idempotency, signatures/freshness, amount/currency/merchant/order matching, and error handling are implemented.
- **Socket message DTO validation:** the gateway currently declares no client-originated `@SubscribeMessage` handlers. There are therefore no inbound socket message payloads to validate today. Handshake authentication/origin/room isolation is still a confirmed finding (F-11); every future inbound event must receive a concrete runtime schema and authorization check.
- **Next.js middleware token parsing:** `apps/web/src/middleware.ts:32-44` checks only `exp`, but it is an optimization/redirect hint. Protected server pages call the API-backed `requireUser`, and direct API authorization must remain authoritative. Do not treat middleware parsing as proof of identity; it is not itself the API auth bypass described in the dossier.
- **Public product reads:** unauthenticated `GET /api/products` and `GET /api/products/:idOrSlug` are consistent with the marketplace homepage and are safely narrowed in the current service. They should remain explicitly public unless product policy changes.
- **`admin-notifications` data leak:** no client is joined to that room, so the current defect is missing delivery rather than unauthorized receipt. The global room is the actual disclosure path.

## 3. Required product-policy and deployment decisions

Implementation must stop at these boundaries until the named owner supplies the decision. A route/transition matrix is preferable to prose.

For the implemented order/payout slice, the user approved this concrete interim policy: authenticated buyers create one-seller orders from active offers; buyers/sellers/platform admins read only their approved scope; cross-tenant resources are hidden with 404; only a verified payment provider may move `pending` to `paid`; sellers move paid orders through fulfillment; physical delivery and digital/service completion require buyer confirmation; buyers may cancel pending orders; payouts cover one complete delivered order with no partial amount; sellers with `payouts_request` request, and platform admins approve/settle; rates are fractions whose sum is at most one and are snapshotted; IRR uses integer units with half-up Decimal calculations; every mutation is idempotent and records immutable audit/outbox data. Items below remain decisions wherever they extend beyond that slice.

1. **Order creation identity and cart model:** Must a buyer be authenticated? Can platform admins create on behalf of a buyer? Does one order contain offers from exactly one seller, or can a cart span sellers and split into seller orders? Which stored offer/variant is the client allowed to select?
2. **Order read scope:** May a buyer read only their own orders, each seller read only its own orders, seller staff read based on `orders_manage`, and platform admins read all? Should cross-tenant lookups return 404 or 403?
3. **Order transition matrix:** For every edge among `pending`, `paid`, `processing`, `shipped`, `delivered`, and `cancelled`, specify the initiating actor/permission, preconditions, whether reversal is possible, and side effects. Clarify digital/service equivalents for shipped/delivered and who confirms delivery.
4. **Payout lifecycle:** Does a payout request cover one order, multiple eligible ledger entries, or an account balance? Is partial payout allowed? Who may request, approve, reject/dispute, settle, or reopen? What external evidence makes `settled` true?
5. **Commission/holdback policy:** Are rates fractions or percentages; what are maximums; must `commission + holdback <= 1`; when are terms snapshotted; can terms vary by seller/product/order; what happens to holdback on delivery, cancellation, refund, or dispute?
6. **Currency and rounding:** Supported ISO-like currency codes, scale per currency (notably IRR), rounding mode, display/storage contract, and whether all monetary values use fixed decimal strings or integer minor units. Current project convention says Prisma Decimal; changing to minor units requires an explicit decision.
7. **Seller staff tenancy:** Is a seller staff member a distinct user linked to an existing seller organization, or is every seller-role user the owner of a one-to-one `sellers` row? The current `sellers.user_id @unique` model cannot represent multiple staff users belonging to one seller organization without additional membership data.
8. **Seller catalog authority:** May any seller with `products_manage` create globally shared catalog products and activate them immediately, or must new catalog entries/edits be platform-reviewed while sellers only manage listings/offers?
9. **Agent and invite exposure:** Is the agent directory public, and may public responses include phone numbers and availability? Who creates agents? Is `POST /seller/invites` a public seller application, a platform-admin invitation, or both as separate routes? Who may list applications/invitations?
10. **Session policy:** Required session lifetime, per-device sessions, logout-all, password-change invalidation, admin forced revocation, concurrent-session limits, and whether bearer API clients share the browser session mechanism.
11. **CSRF/origin topology:** Exact browser origins and whether any same-site sibling subdomains are untrusted; whether cross-site embedding/requests are required; and whether bearer-only non-browser mutations are supported.
12. **Realtime audiences and durability:** Which roles need each order event, whether buyers and seller staff receive different projections, and whether notification delivery must survive process failure/reconnect or merely prompt clients to refetch.
13. **Payment provider status:** Is `local-country-gateway` strictly a development mock? Identify the real provider(s), signed callback/webhook protocol, merchant/account checks, settlement source of truth, refund semantics, and timeout/retry contract before enabling payment routes.
14. **Deployment and migration baseline:** Is `docker-compose.yml` development-only? Which databases already have which Prisma migrations recorded, and how were the base tables created? Supply a sanitized `prisma_migrations` inventory/schema dump per environment before choosing a baseline procedure.
15. **Retention/audit/legal requirements:** Required retention and immutability for orders, payment attempts, payout ledger entries, status transitions, admin actions, idempotency records, and outbox events; identify PII deletion/anonymization requirements.

## 4. Prioritized implementation sequence

Each phase is intentionally reviewable and should be a separate PR or similarly isolated change. Do not mix the existing product/catalog migration with order/payout migrations.

### Phase 0 — Freeze the contract and establish a reproducible database baseline

- Obtain decisions 1-15 and turn decisions 1-6 into explicit authorization/state/money tables in code documentation and tests.
- Inventory migration state in every environment. Create a fresh-install baseline and an explicit adoption procedure for existing databases; do not edit already-applied migrations.
- Add disposable PostgreSQL migration verification to CI before money tables are changed.

**Exit condition:** a fresh database can be created solely from checked-in artifacts, and existing databases have a documented, tested reconciliation path.

### Phase 1 — Central authentication, CSRF, configuration, and abuse controls

- Introduce one reusable authenticated-actor guard/decorator used by HTTP and Socket.IO; retain current-database role/permission lookup.
- Centralize unsafe-method cookie Origin/Fetch-Metadata or CSRF-token enforcement; remove route-local drift after equivalent coverage exists.
- Add distributed rate limits for login/registration and policy hooks for money endpoints.
- Fail fast on placeholder/weak secrets and invalid origin/cookie/runtime configuration; document development-only exceptions.
- Add revocable sessions or token versioning according to decision 10.

**Exit condition:** every protected route obtains the same verified actor; cookie mutations are consistently CSRF-protected; sessions are revocable; abuse/config tests pass.

### Phase 2 — Persist and secure order creation/read paths

- Add concrete DTOs for offer selection, quantities, addresses/fulfillment inputs, cursor pagination, and idempotency key.
- Derive buyer from the actor. Fetch active offer, listing, seller, product/variant, stock/availability, price, currency, and snapshotted seller terms in the transaction.
- Persist a normalized order plus order items/snapshots with database UUIDs; never accept buyer/seller/total/commission as client authority.
- Scope buyer/seller/admin reads in the query and return narrow response models.

**Exit condition:** no process-local order state remains and no caller can create/read an order outside the approved scope.

### Phase 3 — Add atomic order transitions, immutable ledger, and outbox

- Implement the approved transition matrix with actor/tenant/expected-state predicates.
- In one PostgreSQL transaction, update the order, reserve/decrement inventory where applicable, append an immutable transition/audit record, create/update the derived payout ledger entry, and enqueue an outbox event.
- Make replay and concurrent execution safe through database uniqueness/conditional writes.

**Exit condition:** illegal, repeated, and racing transitions cannot duplicate side effects; order and ledger cannot commit inconsistently.

### Phase 4 — Secure payout request/approval/settlement operations

- Separate seller request DTO/routes from platform finance actions.
- Derive seller and payable balance from authoritative eligible ledger rows; apply the approved partial/batch policy.
- Require idempotency keys/provider settlement references and conditional legal transitions; append immutable audit entries.
- Add rate limits and explicit response projections.

**Exit condition:** sellers see/request only their funds; only authorized finance actors approve/settle; duplicate/concurrent calls are deterministic.

### Phase 5 — Authenticate and tenant-scope realtime delivery

- Apply the same origin allowlist and actor resolution during the Socket.IO handshake.
- Join verified user/seller/admin rooms only after current permission/status checks.
- Publish outbox-derived, minimal events after commit; use events as refetch hints, not state authority.
- Add a shared Socket.IO adapter only if multi-instance realtime is required; bound/rate-limit every future inbound event.

**Exit condition:** an anonymous or wrong-tenant socket receives no private event, and reconnect/refetch restores truth.

### Phase 6 — Persist and authorize seller agents/invitations; harden vendor administration

- Split public directory/application APIs from authenticated administration according to decision 9.
- Add runtime DTOs, narrow public/admin projections, pagination, rate limits, durable tables, opaque IDs, audit fields, and tenant/admin scoping.
- Paginate vendor listing and add approved seller-status/financial constraints.

**Exit condition:** no mutable seller marketplace state remains process-local and no applicant PII is publicly enumerable.

### Phase 7 — Implement production payment adapters only when provider policy is available

- Keep mock adapters unambiguously development-only.
- Persist payment attempts before redirecting; enforce unique provider reference and idempotency keys.
- Verify signature, freshness/replay, merchant, amount, currency, and order association server-to-server before settlement.
- Put verified payment/order/ledger/outbox effects in one transaction; implement bounded timeouts and safe retries.

**Exit condition:** no client redirect or prefix check can settle/refund an order, and provider replay/concurrency tests pass.

## 5. Tests required for every phase

### Phase 0 tests

- Run the complete migration chain against an empty supported PostgreSQL version and compare the resulting schema with Prisma expectations.
- Restore a production-like legacy snapshot, run adoption plus migrations, verify row counts/checksums and application reads, and rehearse failure recovery.
- Confirm a second `prisma migrate deploy` is a no-op.

### Phase 1 tests

- E2E: missing, malformed, expired, revoked, deleted-user, downgraded-role, password-changed, and valid sessions.
- E2E: cookie mutation from allowed origin succeeds; disallowed/missing-origin and hostile Fetch-Metadata cases fail; bearer policy behaves as documented.
- Rate-limit tests for account/IP buckets, reset windows, proxy-header spoofing, and multiple API instances.
- Startup tests reject missing/known-placeholder secrets, invalid origins, and insecure production cookie configuration.

### Phase 2 tests

- DTO tests for unknown fields, malformed UUIDs, collection/string bounds, invalid quantity/currency, and client attempts to submit seller/buyer/price/commission/total fields.
- E2E: unauthenticated, wrong role, buyer-other-order, seller-other-tenant, suspended seller, missing permission, platform-admin branch, and 404/403 policy.
- PostgreSQL integration: inactive offer/seller, stale price, insufficient stock, duplicate idempotency key, mismatched request fingerprint, and concurrent order creation.
- Money fixtures verify exact Decimal snapshots and serialization for every supported currency.

### Phase 3 tests

- Unit table tests for every allowed and forbidden state edge and actor.
- PostgreSQL integration tests for two simultaneous transitions, replay, cancellation versus fulfillment race, stock race, missing payout row, and rollback after each injected failure point.
- Assert one immutable audit row and one outbox row per committed business operation; assert none on rollback.

### Phase 4 tests

- E2E: cross-seller read/request, staff without permission, seller attempting approval/settlement, admin scope, negative/zero/over-limit amount, and missing resource semantics.
- PostgreSQL integration: duplicate/replayed key, partial/batch policy, two simultaneous requests/approvals/settlements, unique provider settlement reference, and rollback consistency.
- Exact Decimal tests for commission, holdback, release, refund/dispute, and payable invariants.

### Phase 5 tests

- Socket E2E: absent/invalid/revoked token, disallowed origin, suspended seller, missing permission, room membership by actor, and cross-tenant non-delivery.
- Contract validation for every emitted/inbound event, including payload size and rate limits.
- Reconnect, outbox retry/deduplication, multi-instance adapter, and database-refetch behavior.

### Phase 6 tests

- E2E role/tenant matrix for public directory, applications/invites, agent administration, and vendor administration.
- DTO bounds/unknown-field tests, public projection tests proving PII exclusion, pagination limits/order, and rate-limit tests.
- PostgreSQL tests for uniqueness, seller status/rate constraints, concurrent invitation acceptance, and audit attribution.

### Phase 7 tests

- Provider contract tests with signed valid/invalid/stale/replayed fixtures and merchant/amount/currency/order mismatches.
- E2E and PostgreSQL tests for duplicate initiation/callback/refund, callback-before-redirect, concurrent verification, provider timeout, retry safety, and transaction rollback.
- Ensure logs/metrics redact tokens, signatures, provider secrets, payment payloads, and PII.

Every implementation phase must also run the narrow focused tests plus `pnpm --filter topgsm-api type-check`, `lint`, `build`, and `prisma:generate` when the schema/client changes. Initial authentication unit and PostgreSQL integration test scripts now exist; comprehensive order, payout, payment, realtime, and seller tests remain to be added. The lint script is currently unusable because the repository has no installed ESLint executable/configuration.

## 6. Migration, deployment, compatibility, and rollback risks

### Migration risks

- **Fresh/disposable baseline resolved; existing databases still need care.** The new initial migration makes the complete chain reproducible from empty PostgreSQL. Any non-disposable database that predates the baseline must be reset or explicitly mark/adopt the baseline after its actual `_prisma_migrations` and schema state are captured.
- **The existing shared-catalog migration is large and destructive.** It creates/backfills tables, installs triggers, drops legacy fulfillment tables, and drops product price/currency/seller columns in one migration. It requires disposable-database and production-like snapshot rehearsal, explicit lock/statement timeouts, row-count/checksum validation, disk/WAL headroom, and a tested restore/forward-fix plan.
- **Do not use `CREATE INDEX CONCURRENTLY` inside a normal transactional Prisma migration.** For large live tables, use an explicitly managed non-transactional deployment step with retry/invalid-index cleanup, or accept a measured maintenance window. New empty tables may use ordinary indexes.
- **Use expand/backfill/validate/contract.** Add nullable/new tables first, dual-read/write only when necessary, backfill in bounded batches, add CHECK/FK constraints as `NOT VALID` where appropriate, validate separately, switch reads, then remove legacy columns in a later release.
- **Constraint rollout can fail on existing rows.** Preflight commission/holdback ranges and sum, currency normalization, nonnegative/equality money invariants, seller status combinations, order/ledger seller consistency, timestamps, duplicate provider/idempotency references, and orphaned relations before validation.
- **PostgreSQL cannot safely encode every transition with an enum alone.** Use conditional application writes plus immutable transition/audit records; reserve triggers for stable cross-row invariants that cannot be expressed with keys/checks, and test trigger concurrency/deadlocks.

### Deployment and compatibility risks

- Adding auth/tenant scoping will change currently public order/payout/seller-admin behavior from success to 401/403/404. Coordinate web/API clients and publish the final status-code contract; do not preserve insecure anonymous behavior for compatibility.
- Decimal strings replace current numeric money responses. Version or coordinate shared types/web parsing; never silently coerce back to JavaScript numbers in the API.
- Replacing millisecond IDs with UUIDs changes fixtures and client assumptions. Existing prototype array contents are non-durable and cannot be migrated after restart; decide whether any running instance contains data that must be exported before cutover.
- Revocable sessions require a session store lookup and deployment ordering. Deploy additive schema first, then code that can accept old/new tokens during a bounded transition if continuity is required; a secret rotation intentionally logs everyone out.
- Tightened cookie security requires HTTPS and correct reverse-proxy configuration. Explicitly configure trusted proxies before IP rate limiting or secure-cookie decisions; never trust arbitrary forwarded headers.
- Origin enforcement requires exact scheme/host/port inventory for web, preview, and admin surfaces. A bad allowlist can lock out legitimate clients; a wildcard or reflective policy defeats the protection.
- Socket room changes must deploy with compatible clients. During rolling deployment, treat events as optional refetch hints so old/new event schemas cannot corrupt client truth.
- Outbox workers require observable retry/dead-letter behavior and idempotent consumers. Deploy schema, producer, then consumer; monitor backlog before removing direct best-effort emission.
- `docker-compose.yml` currently exposes PostgreSQL and runs the web development server while consuming `.env.example`. Treat it as development-only unless hardened; production must use secret injection, non-default credentials, TLS/proxy policy, production commands, and restricted database networking.

### Rollback strategy

- Prefer **roll-forward** for committed financial data. Never roll back by deleting settled ledger/audit rows; append compensating records under an approved policy.
- Make schema phases backward-compatible so the prior application can run during rollback. Contract/drop migrations occur only after the rollback window closes and backups are verified.
- Before destructive catalog or money migrations, take and verify a restorable backup/snapshot and record migration checksums. Rehearse restore time against the allowed outage objective.
- Feature-flag new workers/routes where practical, but authorization checks must fail closed. A rollback must not re-expose unauthenticated order or payout mutations.
- If a concurrent index build fails, remove only the specifically identified invalid index and retry. If constraint validation fails, leave the unvalidated constraint/data intact, repair rows, and retry validation rather than dropping protections broadly.

## Recommended first implementation phase

The authentication foundation and the approved one-seller order/payout slice are now implemented. The smallest remaining highest-risk phase is **production payment verification** because no client route can safely mark an order paid and payout eligibility intentionally depends on an authoritative `paid` transition.

That phase is blocked on decision 13: identify the real payment provider(s), webhook/signature specification, merchant/account identifiers, provider idempotency/reference rules, settlement and refund semantics, and timeout/retry expectations. Do not expose a client-driven `pending -> paid` shortcut.

The next independent slice is seller agent/invite persistence, but decisions 7-9 are required first: staff-to-seller membership, public directory PII, and whether applications and invitations are distinct routes. Existing-database rollout still requires decision 14; the implemented money migration assumes the explicitly authorized disposable/fresh database path.
