# TopGSM Audit Context Dossier

## Scope and orientation

This dossier describes the repository as read on 2026-09-06. It is context for a later review, not a list of findings. The application is a pnpm monorepo whose documented runtime pieces are a Next.js frontend, a NestJS API with Socket.IO, and PostgreSQL persistence (`README.md:L1-L9`, `README.md:L11-L18`). The source tree also contains several process-local prototype stores alongside the Prisma-backed seller and user paths.

The API composition root imports authentication, sellers, products, orders, payouts, realtime, payments, and Prisma modules (`apps/api/src/app.module.ts:L12-L28`). `bootstrap` creates that graph, configures credentialed HTTP CORS, installs one global validation pipe, adds the `/api` prefix, and starts listening (`apps/api/src/main.ts:L6-L22`). The web app uses Next.js file-system routes under a required locale segment; middleware applies to every route except the exclusions in its matcher (`apps/web/src/middleware.ts:L4-L29`, `apps/web/src/middleware.ts:L46-L48`).

The Prisma schema is the authoritative database model visible in the repository. It declares users, sellers, seller permissions, typed product variants, orders, and payout ledger rows (`apps/api/src/prisma/schema/schema.prisma:L48-L183`). However, only authentication and vendor management call Prisma in current source (`apps/api/src/modules/auth/auth.service.ts:L61-L68`, `apps/api/src/modules/auth/auth.service.ts:L84-L92`, `apps/api/src/modules/seller/seller.service.ts:L19-L29`, `apps/api/src/modules/seller/seller.service.ts:L32-L70`, `apps/api/src/modules/seller/seller.service.ts:L82-L149`).

The migration directory contains only additive migrations for `users.password_hash`, `users.username`, seller metadata, and `seller_permissions` (`apps/api/src/prisma/schema/migrations/20260905000000_add_user_password/migration.sql:L1-L3`, `apps/api/src/prisma/schema/migrations/20260905010000_add_user_username/migration.sql:L1-L5`, `apps/api/src/prisma/schema/migrations/20260906000000_add_seller_permissions/migration.sql:L1-L36`). A migration that initially creates `users`, `sellers`, products, orders, or payout ledger tables: **nothing found**.

## Outside entry points and reachability

All HTTP paths below inherit the `/api` prefix from `apps/api/src/main.ts:L21`.

| Method and path | Handler | Upstream identity/role enforcement visible in registration |
| --- | --- | --- |
| `POST /api/auth/register` | `AuthController.register` (`apps/api/src/modules/auth/auth.controller.ts:L28-L36`) | Public route; DTO validation is supplied by the global pipe (`apps/api/src/main.ts:L18-L20`). |
| `POST /api/auth/login` | `AuthController.login` (`apps/api/src/modules/auth/auth.controller.ts:L38-L47`) | Public route; DTO validation is supplied by the global pipe (`apps/api/src/main.ts:L18-L20`). |
| `GET /api/auth/me` | `AuthController.me` (`apps/api/src/modules/auth/auth.controller.ts:L49-L57`) | Shared token extraction and service verification occur inside the handler/callees rather than a route guard (`apps/api/src/modules/auth/auth.controller.ts:L54-L56`, `apps/api/src/modules/auth/session-token.ts:L3-L16`, `apps/api/src/modules/auth/auth.service.ts:L107-L126`). |
| `POST /api/auth/logout` | `AuthController.logout` (`apps/api/src/modules/auth/auth.controller.ts:L59-L63`) | Public route; clears the response cookie. |
| `GET /api/seller/vendors` | `SellerController.listVendors` (`apps/api/src/modules/seller/seller.controller.ts:L35-L39`) | `PlatformAdminGuard` is attached at `L36`. |
| `POST /api/seller/vendors` | `SellerController.createVendor` (`apps/api/src/modules/seller/seller.controller.ts:L41-L51`) | `PlatformAdminGuard` is attached at `L42`; the handler consumes the user placed on the request by the guard (`L45-L50`). |
| `PATCH /api/seller/vendors/:id` | `SellerController.updateVendor` (`apps/api/src/modules/seller/seller.controller.ts:L53-L65`) | `PlatformAdminGuard` is attached at `L54`; the handler consumes the user placed on the request by the guard (`L58-L64`). |
| `GET /api/seller/agents` | `SellerController.listAgents` (`apps/api/src/modules/seller/seller.controller.ts:L67-L70`) | No guard/decorator enforcing identity appears on this route: **nothing found**. |
| `POST /api/seller/agents` | `SellerController.createAgent` (`apps/api/src/modules/seller/seller.controller.ts:L72-L77`) | No guard/decorator enforcing identity or role appears on this route: **nothing found**. |
| `GET /api/seller/invites` | `SellerController.list` (`apps/api/src/modules/seller/seller.controller.ts:L79-L82`) | No guard/decorator enforcing identity or role appears on this route: **nothing found**. |
| `POST /api/seller/invites` | `SellerController.create` (`apps/api/src/modules/seller/seller.controller.ts:L84-L89`) | No guard/decorator enforcing identity or role appears on this route: **nothing found**. |
| `GET /api/products` | `ProductController.list` (`apps/api/src/modules/product/product.controller.ts:L37-L40`) | No guard/decorator enforcing identity appears: **nothing found**. |
| `POST /api/products` | `ProductController.create` (`apps/api/src/modules/product/product.controller.ts:L42-L54`) | No guard/decorator enforcing identity or seller ownership appears: **nothing found**. |
| `GET /api/products/:id` | `ProductController.get` (`apps/api/src/modules/product/product.controller.ts:L56-L59`) | No guard/decorator enforcing identity appears: **nothing found**. |
| `GET /api/orders` | `OrderController.list` (`apps/api/src/modules/order/order.controller.ts:L33-L36`) | No guard/decorator constraining identity or tenant scope appears: **nothing found**. |
| `POST /api/orders` | `OrderController.create` (`apps/api/src/modules/order/order.controller.ts:L38-L53`) | No guard/decorator establishing the caller, buyer, or seller relationship appears: **nothing found**. |
| `PATCH /api/orders/:id/status` | `OrderController.updateStatus` (`apps/api/src/modules/order/order.controller.ts:L55-L73`) | No guard/decorator establishing who may change a status appears: **nothing found**. |
| `GET /api/payouts` | `PayoutController.list` (`apps/api/src/modules/payout/payout.controller.ts:L19-L22`) | No guard/decorator constraining identity or tenant scope appears: **nothing found**. |
| `GET /api/payouts/:id` | `PayoutController.get` (`apps/api/src/modules/payout/payout.controller.ts:L24-L27`) | No guard/decorator constraining identity or tenant scope appears: **nothing found**. |
| `POST /api/payouts/requests` | `PayoutController.requestPayout` (`apps/api/src/modules/payout/payout.controller.ts:L29-L32`) | No guard/decorator establishing the requesting seller appears: **nothing found**. |
| `PATCH /api/payouts/requests/:id` | `PayoutController.setStatus` (`apps/api/src/modules/payout/payout.controller.ts:L34-L37`) | No guard/decorator establishing who may set a payout status appears: **nothing found**. |

The realtime entry point is Socket.IO namespace `/socket`. Its gateway registration permits `origin: "*"` and declares no connection guard (`apps/api/src/modules/realtime/realtime.gateway.ts:L10-L16`). Each connecting socket is joined to `global` (`L15-L17`). No code joins a socket to `admin-notifications`: **nothing found**; the only reference to that room is an emission target (`apps/api/src/modules/realtime/realtime.gateway.ts:L25-L29`).

The web entry points are `/[locale]`, `/[locale]/login`, `/[locale]/admin`, and `/[locale]/seller-dashboard`, as represented by their page functions (`apps/web/src/app/[locale]/page.tsx:L95-L145`, `apps/web/src/app/[locale]/login/page.tsx:L16`, `apps/web/src/app/[locale]/admin/page.tsx:L23-L31`, `apps/web/src/app/[locale]/seller-dashboard/page.tsx:L22-L41`). Middleware redirects locale-less paths and performs an expiry-only session precheck for admin and seller dashboard paths (`apps/web/src/middleware.ts:L4-L29`, `apps/web/src/middleware.ts:L32-L44`). The server page functions independently call `requireUser`: admin allows `platform-admin` (`apps/web/src/app/[locale]/admin/page.tsx:L28-L31`), and the seller dashboard allows platform admin, seller admin, and seller staff (`apps/web/src/app/[locale]/seller-dashboard/page.tsx:L27-L29`).

## Trust and authentication boundaries

The HTTP request boundary is Nest's global `ValidationPipe` with `whitelist`, `forbidNonWhitelisted`, and `transform` enabled (`apps/api/src/main.ts:L18-L20`). Decorated DTO classes provide constraints for auth and vendor routes; the product, order, and payout request bodies are TypeScript-only types, which do not supply runtime metadata or decorators in their declarations (`apps/api/src/modules/product/product.controller.ts:L3-L11`, `apps/api/src/modules/order/order.controller.ts:L6-L16`, `apps/api/src/modules/payout/payout.controller.ts:L5-L13`). Runtime validation for those TypeScript-only bodies: **nothing found**.

The API accepts a session from either a bearer header or `topgsm_session` cookie, with bearer taking precedence through the shared `readSessionToken` helper (`apps/api/src/modules/auth/session-token.ts:L1-L16`). Session signatures are HMAC-SHA256 over the encoded header and body; verification checks shape, signature length/equality, algorithm, subject presence, and expiration (`apps/api/src/modules/auth/auth.service.ts:L153-L162`, `apps/api/src/modules/auth/auth.service.ts:L164-L203`). `getUserFromToken` then reloads the user and seller permissions from PostgreSQL before returning the public identity (`apps/api/src/modules/auth/auth.service.ts:L107-L126`). `AuthController.me` and `PlatformAdminGuard.canActivate` both use that helper before calling the service (`apps/api/src/modules/auth/auth.controller.ts:L54-L56`, `apps/api/src/modules/auth/platform-admin.guard.ts:L32-L36`); the guard checks the current public role and writes the resulting identity to the request (`apps/api/src/modules/auth/platform-admin.guard.ts:L38-L43`).

The session cookie is `HttpOnly`, `SameSite=Lax`, has `Path=/`, a configured max age, an optional configured domain, and `Secure` only when `NODE_ENV` equals `production` (`apps/api/src/modules/auth/auth.controller.ts:L65-L86`). Its integrity depends on `JWT_SECRET`; absence always stops signing/verification, while minimum length and placeholder rejection are only performed for `NODE_ENV=production` (`apps/api/src/modules/auth/auth.service.ts:L206-L218`). Enforcement that every deployed internet-facing environment identifies itself as `production`: **nothing found**.

The Next.js middleware's `hasActiveSession` reads only the payload's `exp` claim and does not call the API verification path (`apps/web/src/middleware.ts:L32-L44`). This function is used to decide whether to redirect before the page is reached (`apps/web/src/middleware.ts:L15-L20`); protected page functions perform the API-backed identity/role check afterward (`apps/web/src/lib/auth/server.ts:L27-L49`). API handlers remain the data mutation boundary; the web middleware does not sit upstream of direct API requests because its matcher explicitly excludes `api` (`apps/web/src/middleware.ts:L46-L48`).

## Persistent and process-local state

| State | Writers/readers | Lifetime and governing constraints |
| --- | --- | --- |
| PostgreSQL `users` | Auth registration creates rows; login and session resolution read them (`apps/api/src/modules/auth/auth.service.ts:L61-L70`, `L84-L104`, `L107-L126`). Vendor creation/update also writes the linked user (`apps/api/src/modules/seller/seller.service.ts:L38-L68`, `L98-L111`). | Durable. Email and username uniqueness are schema constraints (`apps/api/src/prisma/schema/schema.prisma:L48-L61`). |
| PostgreSQL `sellers` and `seller_permissions` | Vendor service lists, creates, and updates them (`apps/api/src/modules/seller/seller.service.ts:L19-L29`, `L32-L70`, `L82-L149`). | Durable. Seller ownership is one-to-one through unique `user_id`; permissions have a composite `(seller_id, permission)` key (`apps/api/src/prisma/schema/schema.prisma:L64-L95`). |
| PostgreSQL products/orders/payout ledger | Models and relations exist (`apps/api/src/prisma/schema/schema.prisma:L98-L183`). | Durable model only; current product, order, and payout handlers do not call Prisma: **nothing found**. |
| Module-level `products` array | Product list/create/get (`apps/api/src/modules/product/product.controller.ts:L20-L29`, `L37-L59`). | Process lifetime. IDs use `Date.now()` and list returns a copied/sorted array (`L39`, `L44-L52`). |
| Module-level `orders` array | Order list/create/status update (`apps/api/src/modules/order/order.controller.ts:L24-L24`, `L33-L73`). | Process lifetime. Objects are mutated in place on status update (`L60-L66`). |
| Module-level `ledger` array | Payout service draft creation, order-driven status update, reads, requests, and direct status update (`apps/api/src/modules/payout/payout.service.ts:L16-L16`, `L23-L90`). | Process lifetime. Returned rows are the same mutable objects held by the array (`L59-L64`, `L79-L80`, `L88-L89`). |
| Module-level `agents` and `invitedSellers` arrays | Seller controller lists/appends (`apps/api/src/modules/seller/seller.controller.ts:L12-L29`, `L67-L89`). | Process lifetime. List endpoints return the arrays directly (`L68-L69`, `L80-L81`). |
| Browser session cookie | Set and cleared by auth responses (`apps/api/src/modules/auth/auth.controller.ts:L28-L46`, `L59-L86`); forwarded by `requireUser` (`apps/web/src/lib/auth/server.ts:L27-L35`) and credentialed Axios/fetch calls (`apps/web/src/lib/api/client.ts:L3-L8`, `apps/web/src/app/[locale]/login/LoginForm.tsx:L87-L95`). | Browser cookie lifetime bounded by max age; no server-side session row is visible. |
| Browser theme | Read from the document and written to `localStorage` (`apps/web/src/components/theme/ThemeToggle.tsx:L14-L23`, `L29-L42`). | Per-browser preference; unrelated to authorization or server state. |
| Client socket singleton | Created once in module state and returned thereafter (`apps/web/src/lib/sockets/socket.ts:L3-L14`). | Browser module lifetime. No call sites elsewhere in current source: **nothing found**. |

## External and black-box interactions

- PostgreSQL is reached through generated Prisma client methods. Connection configuration comes from `DATABASE_URL` (`apps/api/src/prisma/schema/schema.prisma:L5-L8`), and connection lifecycle is delegated to Prisma's `$connect`/`$disconnect` (`apps/api/src/prisma/prisma.service.ts:L9-L15`). Prisma and PostgreSQL behavior are external-source-available dependencies, not implemented in this repository.
- The web server calls `${API_BASE}/auth/me` with the incoming cookie header and `cache: "no-store"` (`apps/web/src/lib/auth/server.ts:L27-L35`). Its callers assume non-OK and transport failure redirect away, and that a successful JSON body has the locally declared `AppUser` shape (`L31-L49`). Runtime response-shape enforcement: **nothing found**.
- The homepage server calls `/products` and `/seller/agents`, revalidating at 60 seconds, and substitutes local fallback arrays for transport errors, non-OK responses, non-arrays, and empty arrays (`apps/web/src/app/[locale]/page.tsx:L52-L61`, `L98-L101`). Runtime validation of individual returned elements: **nothing found**.
- `VendorManagement` uses a credentialed Axios singleton to call seller vendor endpoints (`apps/web/src/lib/api/client.ts:L3-L8`, `apps/web/src/components/admin/VendorManagement.tsx:L292`, `L428-L429`). Axios, the browser cookie jar, and the network are black-box interactions from component code.
- `LoginForm` posts JSON credentials to API auth endpoints with `credentials: "include"`, parses the response, and navigates using the returned role plus the requested next path (`apps/web/src/app/[locale]/login/LoginForm.tsx:L72-L116`).
- `RealtimeGateway` emits Socket.IO messages to `global` and `admin-notifications` rooms (`apps/api/src/modules/realtime/realtime.gateway.ts:L19-L29`). Delivery, ordering, and recipient lifecycle are delegated to Socket.IO.
- The local payment adapter is currently deterministic scaffolding: `initiate` constructs a provider reference and relative URL, `verify` checks a prefix, and `refund` returns true (`apps/api/src/integrations/payments/providers/local-gateway/local-gateway.adapter.ts:L12-L26`). No route or other call site reaches `PaymentService` in current source: **nothing found**.

## Cross-function invariants and continuity map

1. **Route validation continuity.** `bootstrap` installs the validation pipe globally (`apps/api/src/main.ts:L18-L20`). Its effective field rules depend on runtime-decorated DTOs. Auth DTOs and vendor DTOs have decorators; request bodies declared only as type aliases have no such rules in their declarations (`apps/api/src/modules/product/product.controller.ts:L3-L11`, `apps/api/src/modules/order/order.controller.ts:L6-L16`, `apps/api/src/modules/payout/payout.controller.ts:L5-L13`).

2. **Authenticated platform-admin continuity.** A guarded vendor route depends on `PlatformAdminGuard.canActivate` to call the shared token extractor, call `AuthService.getUserFromToken`, compare the current role, and populate `request.authenticatedUser` (`apps/api/src/modules/auth/platform-admin.guard.ts:L30-L43`, `apps/api/src/modules/auth/session-token.ts:L3-L16`). The create/update handlers' non-null assertion on `authenticatedUser` is established by that guard at their registrations (`apps/api/src/modules/seller/seller.controller.ts:L41-L50`, `L53-L64`).

3. **Session continuity.** Registration/login normalize or resolve the user, verify or create a password hash, and call `createSession` (`apps/api/src/modules/auth/auth.service.ts:L52-L80`, `L82-L105`). `createSession` derives `iat` and `exp`, signs them, and maps the user (`L137-L150`); `verifyToken` checks signature/expiry (`L164-L203`); `getUserFromToken` establishes that the subject still resolves to a database user and obtains current role/permissions (`L107-L126`). Revocation before token expiry through a session record or token version: **nothing found**.

4. **Vendor aggregate continuity.** `createVendor` wraps user, seller, and permission creation in one Prisma transaction and returns the completed aggregate only after commit (`apps/api/src/modules/seller/seller.service.ts:L37-L70`). `updateVendor` wraps related user, seller, and permission replacement writes in one transaction (`L97-L149`). Database relations and uniqueness constraints couple these tables (`apps/api/src/prisma/schema/schema.prisma:L48-L95`).

5. **Order-to-payout continuity.** `OrderController.create` first appends an order, then calls `PayoutService.recordDraft`, then emits `order.created` (`apps/api/src/modules/order/order.controller.ts:L38-L52`). Status update first mutates the order, then updates the payout row, then emits (`L55-L72`). These are three distinct process-local or external effects. A transaction/rollback boundary spanning them: **nothing found**.

6. **Payout arithmetic continuity.** `recordDraft` derives commission, holdback, and payable from fixed service percentages and stores rounded component fields (`apps/api/src/modules/payout/payout.service.ts:L20-L39`). `request` assumes the row's seller ID represents the requester because it matches the body-supplied `sellerId`; enforcement tying that field to an authenticated identity: **nothing found** (`L67-L80`).

7. **Status-transition continuity.** Order and payout status unions enumerate possible names at compile time (`packages/shared-types/src/index.ts:L2-L15`). Runtime handlers accept TypeScript-only body types, and direct assignments accept any value present at runtime (`apps/api/src/modules/order/order.controller.ts:L55-L70`, `apps/api/src/modules/payout/payout.controller.ts:L34-L37`, `apps/api/src/modules/payout/payout.service.ts:L83-L89`). Runtime transition-graph enforcement: **nothing found**.

8. **Multi-seller boundary.** Durable products, orders, and payouts each carry `seller_id` and schema relations (`apps/api/src/prisma/schema/schema.prisma:L98-L114`, `L149-L183`). Current in-memory routes accept seller IDs from request bodies or route lookup and do not derive tenant scope from an authenticated identity: **nothing found** (`apps/api/src/modules/product/product.controller.ts:L42-L53`, `apps/api/src/modules/order/order.controller.ts:L38-L52`, `apps/api/src/modules/payout/payout.controller.ts:L19-L37`).

9. **Realtime audience continuity.** Every connection is placed into `global` (`apps/api/src/modules/realtime/realtime.gateway.ts:L15-L17`) and order events are emitted to that room (`L19-L24`). The second event is also emitted to `admin-notifications` (`L25-L29`), but room-membership establishment for that room is **nothing found**.

## Configuration and deployment boundary

The provided Compose topology exposes PostgreSQL on host port 5432, API on 4000, and web on 3000 (`docker-compose.yml:L3-L14`, `L16-L29`, `L31-L45`). The checked-in example supplies database, web/API origin, JWT secret placeholder, and socket origin variables (`.env.example:L5-L19`). Compose passes `.env.example` as `env_file` while overriding selected URLs (`docker-compose.yml:L21-L29`, `L36-L45`). The API image builds the source and Prisma client, while Compose's API command installs dependencies again at container start; the web Compose command starts the development server although its Dockerfile default is the production server (`infrastructure/docker/api.Dockerfile:L1-L7`, `infrastructure/docker/web.Dockerfile:L1-L6`, `docker-compose.yml:L29`, `L45`). Whether this Compose file is intended for development only or deployment is an open question.

HTTP CORS uses the first configured value among `WEB_ORIGIN`, `SOCKET_CORS_ORIGIN`, or localhost and permits credentials (`apps/api/src/main.ts:L10-L17`). Socket.IO has its own independent wildcard origin setting (`apps/api/src/modules/realtime/realtime.gateway.ts:L10`). The relationship expected between those policies is not documented: **nothing found**.

## Unenforced assumptions index

The exact phrase below means the analysis searched the visible route registration, callers, and relevant callees but found no enforcement in repository source.

- Identity/role/tenant enforcement for the unguarded seller agent/invite, product, order, and payout routes: **nothing found** (route citations are in the entry-point table).
- Runtime DTO validation for product, order, and payout bodies represented only by TypeScript aliases: **nothing found** (`apps/api/src/modules/product/product.controller.ts:L3-L11`, `apps/api/src/modules/order/order.controller.ts:L6-L16`, `apps/api/src/modules/payout/payout.controller.ts:L5-L13`).
- A server-side session record, token version, or other revocation check before the signed expiration time: **nothing found** (`apps/api/src/modules/auth/auth.service.ts:L137-L203`).
- A transaction/rollback mechanism spanning order array mutation, payout array mutation, and Socket.IO emission: **nothing found** (`apps/api/src/modules/order/order.controller.ts:L38-L72`).
- A runtime order or payout transition graph: **nothing found** (`apps/api/src/modules/order/order.controller.ts:L55-L70`, `apps/api/src/modules/payout/payout.service.ts:L42-L56`, `L83-L89`).
- Enforcement that a payout request's body-supplied seller ID belongs to the caller: **nothing found** (`apps/api/src/modules/payout/payout.service.ts:L67-L80`).
- Membership establishment for the `admin-notifications` room: **nothing found** (`apps/api/src/modules/realtime/realtime.gateway.ts:L15-L29`).
- Runtime structural validation of JSON returned to `requireUser`, homepage collection fetches, or `VendorManagement`: **nothing found** (`apps/web/src/lib/auth/server.ts:L44-L49`, `apps/web/src/app/[locale]/page.tsx:L52-L61`, `apps/web/src/components/admin/VendorManagement.tsx:L292`, `L428-L429`).
- A reachable caller for the payment abstraction and a caller for the web socket singleton: **nothing found** (`apps/api/src/integrations/payments/payment.service.ts:L18-L27`, `apps/web/src/lib/sockets/socket.ts:L6-L14`).
- Persistence backing the current product, order, payout, agent, and invite handlers: **nothing found** (state citations are in the persistent/process-local state table).
- A checked-in migration that creates the base tables referenced by the additive migrations: **nothing found** (`apps/api/src/prisma/schema/migrations/20260905000000_add_user_password/migration.sql:L1-L3`, `apps/api/src/prisma/schema/migrations/20260906000000_add_seller_permissions/migration.sql:L1-L36`).
- Enforcement that internet-facing deployment sets `NODE_ENV=production`, which controls additional token-secret and cookie behavior: **nothing found** (`apps/api/src/modules/auth/auth.controller.ts:L80-L85`, `apps/api/src/modules/auth/auth.service.ts:L206-L218`).

## Open questions

- Is `docker-compose.yml` a development-only topology or a deployment artifact? Its web command runs `dev`, it exposes PostgreSQL, and it uses the example environment file (`docker-compose.yml:L11-L14`, `L23-L29`, `L38-L45`).
- How are the base PostgreSQL tables created in a fresh environment when the checked-in migration history begins with `ALTER TABLE` statements?
- Are the process-local product, order, payout, invite, and agent stores intentional prototype paths, or are they expected to use the corresponding Prisma models?
- Which identities and roles are intended to reach each currently unguarded API route?
- Are seller staff represented by their own `users` and seller relation, or does the current one-to-one `sellers.user_id` model represent only seller administrators (`apps/api/src/prisma/schema/schema.prisma:L64-L80`)?
- Which status transitions are intended for orders and payouts, and who is intended to initiate each transition?
- Is the `admin-notifications` room planned for future subscription logic, or should an existing connection path join it?
- Is the local gateway adapter a mock, an offline provider, or the contract expected of a future third-party integration (`apps/api/src/integrations/payments/providers/local-gateway/local-gateway.adapter.ts:L12-L26`)?
- Should the homepage treat a valid empty API collection as empty, or intentionally replace it with fallback content (`apps/web/src/app/[locale]/page.tsx:L52-L61`)?
- Is a token's `role` claim intended to be authoritative anywhere, or only descriptive? API authorization reloads the role from the database, while middleware reads only `exp` (`apps/api/src/modules/auth/auth.service.ts:L107-L126`, `apps/web/src/middleware.ts:L32-L44`).

## Coverage and exclusions

The completed context corpus contains 127 records: 72 for API functions and 55 for web functions or stateful component bodies. These records cover the externally reachable, stateful, persistence-facing, authentication/authorization, realtime, payment, and deployment-adjacent execution paths identified in current source.

Function records under `audit-context/functions/` cover executable functions, component bodies with state/effects, route handlers, guards, lifecycle hooks, and the meaningful callbacks nested inside them. The orientation also reads module wiring, DTO decorators, Prisma schema/migrations, deployment configuration, shared types, and static route registration because those establish assumptions even when they are not named functions.

Static translation dictionaries, CSS declarations, image artifacts, generated build metadata, lockfile internals, empty placeholder modules, and purely declarative type aliases/interfaces do not receive per-function records. Their relevant boundary facts are cited here where they affect runtime code. Dependencies in `node_modules` and framework/generated Prisma implementations remain external-source-available or black-box callees; behavior not established by repository code is retained as an open question rather than inferred.
