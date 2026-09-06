## `PlatformAdminGuard.canActivate` in apps/api/src/modules/auth/platform-admin.guard.ts (L30-L44)

**Purpose:** Gates decorated seller-vendor routes by resolving the request token against current database state and requiring the public role `platform-admin` (L30-L43; `seller.controller.ts:L35-L64`).

---

**Inputs & Assumptions:**
- `context`: semi-trusted Nest execution context containing untrusted HTTP headers (L30-L35).
- Precondition: context is HTTP and request headers have the declared shape; established by use as a route guard, but runtime shape beyond Nest is established by: nothing found (L31-L35).

---

**Outputs & Effects:** Returns true for a current platform admin, attaches `authenticatedUser`, or throws through the service/ForbiddenException (L36-L43).

---

**Block-by-Block:**

```typescript
// L31-L43
const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
const token = readSessionToken(...);
const user = await this.authService.getUserFromToken(token);
if (user.role !== "platform-admin") throw new ForbiddenException(...);
request.authenticatedUser = user;
return true;
```
- **What:** Extracts, authenticates, role-checks, then annotates the request. **Why here:** identity is attached only after both checks. **Assumes:** `getUserFromToken` reflects current role; established by its database lookup (`auth.service.ts:L109-L126`). **Establishes:** guarded handlers receive `authenticatedUser` with platform-admin role. **Depended on by:** vendor create/update non-null assertions (`seller.controller.ts:L47-L64`).

---

**Cross-Function Dependencies:**
- Callees `readSessionToken`, `AuthService.getUserFromToken` (internal) (`session-token.ts:L3-L16`, L32-L36).
- Callers: only three `@UseGuards` vendor routes found (`seller.controller.ts:L35-L64`).
- Shared state: request object and database user/permission rows (`auth.service.ts:L109-L120`).

---

**Open Questions:**
- unclear; need Nest adapter behavior for non-HTTP invocation, if this guard is later reused outside HTTP.
