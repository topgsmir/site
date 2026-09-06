## `SellerService.updateVendor` in apps/api/src/modules/seller/seller.service.ts (L82-L159)

**Purpose:** Applies a partial vendor/user/password/status/permission update atomically, then returns the refreshed projection (L82-L159).

---

**Inputs & Assumptions:**
- `sellerId`: untrusted route id; existence enforced at L87-L91.
- `input`: untrusted but `UpdateVendorDto`-validated (`seller.controller.ts:L53-L64`, `vendor.dto.ts:L75-L126`).
- `adminUserId`: guard-derived platform admin; FK-enforced only when new permissions are inserted (`schema.prisma:L88-L94`, L137-L144 here); otherwise persistence of actor is nothing found.

---

**Outputs & Effects:** Reads seller; may hash; transactionally updates user/seller and replaces permission rows; returns refreshed vendor; maps P2002 (L87-L157).

---

**Block-by-Block:**

```typescript
// L87-L95
const current = await this.prisma.sellers.findUnique(...);
if (!current) throw new NotFoundException(...);
const passwordHash = input.password ? await this.authService.createPasswordHash(...) : undefined;
```
- **What:** Resolves relation and optional hash. **Why here:** current user id is needed by transaction. **Assumes:** seller remains present until transaction update; between-query continuity is enforced by database update failure, not an explicit transaction spanning lookup (L87-L98). **Establishes:** a current user id snapshot.

```typescript
// L98-L149
await this.prisma.$transaction(async (transaction) => { ...users.update...; ...sellers.update...; ...deleteMany...createMany...; });
return this.getVendor(sellerId);
```
- **What:** Applies conditional fields and all-or-nothing permission replacement. **Why here:** delete/create grants share transaction with entity updates. **Assumes:** undefined fields mean no change; established by conditional spreads L99-L130. **Establishes:** requested patch and exact requested permission set on commit. **Depended on by:** refreshed response.

---

**Cross-Function Dependencies:**
- AuthService hash, `statusData`, Prisma read/transaction/update/delete/create, `getVendor` (L87-L149). Shared state: users/sellers/permissions.

---

**Open Questions:**
- unclear; need concurrent update conflict policy; no version predicate appears in update where clauses (L100-L115).

