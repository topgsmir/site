## `bootstrap` in apps/api/src/main.ts (L6-L23)

**Purpose:** Constructs the Nest application, derives its network and browser-facing configuration, installs global request processing, and begins listening (L6-L23).

---

**Inputs & Assumptions:**
- Implicit environment: `API_PORT`, `WEB_ORIGIN`, and `SOCKET_CORS_ORIGIN`, read through `ConfigService` (L8-L16). Trust: semi-trusted deployment configuration.
- Precondition: `API_PORT`, when present, converts to a usable listen port; established by nothing found beyond `Number(...)` at L9.
- Precondition: each comma-separated origin is a complete origin acceptable to Nest CORS; established by trimming only (L10-L17).

---

**Outputs & Effects:** Creates application/module instances (L7), configures credentialed CORS for the computed origin list (L17), enables a global whitelist/transform validation pipe (L18-L20), prefixes HTTP routes with `/api` (L21), and opens the listening socket (L22). Rejection propagates to the unawaited top-level call at L25.

---

**Block-by-Block:**

```typescript
// L7-L9
const app = await NestFactory.create(AppModule);
const config = app.get(ConfigService);
const port = Number(config.get("API_PORT") || 4000);
```
- **What:** Builds the dependency graph and selects the port. **Why here:** the application and configuration provider are prerequisites for every later setup call. **Assumes:** module creation and configuration lookup succeed; `Number` yields a listenable value. **Establishes:** an application instance and a candidate port. **Depended on by:** L10-L22.

```typescript
// L10-L20
const allowedOrigins = (...).split(",").map((origin) => origin.trim());
app.enableCors({ origin: allowedOrigins, credentials: true });
app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
```
- **What:** Computes accepted origins and installs global CORS and DTO processing. **Why here:** these policies must be attached before listening. **Assumes:** the selected environment string represents the full intended origin set; nothing found verifies its entries. **Establishes:** framework-level CORS and validation behavior for subsequently registered requests. **Depended on by:** all HTTP controllers; DTO enforcement still depends on runtime class metadata.

```typescript
// L21-L22
app.setGlobalPrefix("api");
await app.listen(port);
```
- **What:** Sets the route prefix and starts the server. **Why here:** all configuration is complete first. **Assumes:** the port can be bound. **Establishes:** imported controller routes are reachable below `/api`. **Depended on by:** HTTP clients such as `fetchCollection`, which defaults to `http://localhost:4000/api` (`apps/web/src/app/[locale]/page.tsx:L11`, L52-L57).

---

**Cross-Function Dependencies:**
- Callee `NestFactory.create` (external-black-box): expected to instantiate `AppModule` and its imported providers; called at L7, with imports declared at `app.module.ts:L12-L27`.
- Callees `ConfigService.get`, `enableCors`, `useGlobalPipes`, `setGlobalPrefix`, and `listen` (external-black-box): configuration and framework setup at L8-L22.
- Caller: module top level invokes `bootstrap()` without awaiting or attaching a rejection handler (L25).
- Shared state: process environment through `ConfigModule.forRoot`, configured with `.env` before `.env.local` in its list (`app.module.ts:L14-L17`); the precise precedence is an external framework behavior.

---

**Open Questions:**
- unclear; need deployment configuration to know actual port and allowed origins.
- unclear; need the Nest configuration implementation or runtime check to establish precedence when the same key occurs in both environment files.

