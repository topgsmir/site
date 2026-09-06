## `OrderController.updateStatus` in apps/api/src/modules/order/order.controller.ts (L55-L73)

**Purpose:** Implements `PATCH /api/orders/:id/status`, changes a matching in-memory order, projects selected order states into payout state, emits status messages, and returns the order or a message object (L26, L55-L73; `main.ts:L21`).

---

**Inputs & Assumptions:**
- `id` (`string`): untrusted route parameter (L57).
- `body` (`UpdateOrderStatusDto` type alias): untrusted HTTP JSON (L14-L16, L58).
- Precondition: `body.status` is an allowed `OrderStatus` and the transition is permitted from the current state; runtime establishment is nothing found because the alias is erased and no transition check appears (L14-L16, L60-L70).
- Precondition: the caller may mutate this order; no guard or ownership check is declared, so establishment is nothing found (L26, L55-L73).

---

**Outputs & Effects:** Returns `{message: "order not found"}` without mutation on a miss (L60-L63). On a hit, mutates `order.status`, may mutate the payout row, emits two socket event shapes through the gateway, and returns the order (L65-L72). Separate effects are not transactionally grouped.

---

**Block-by-Block:**

```typescript
// L60-L63
const order = orders.find((item) => item.id === id);
if (!order) return { message: "order not found" };
```
- **What:** Resolves the order and exits on a miss. **Why here:** prevents later mutation of an absent object. **Assumes:** first id match is authoritative; uniqueness is established by nothing found. **Establishes:** `order` is present for L65-L72. **Depended on by:** all later lines.

```typescript
// L65-L70
order.status = body.status;
this.payoutService.updateFromOrderStatus(id, body.status);
this.realtime.emitOrderStatusChanged(id, { orderId: id, status: body.status });
```
- **What:** Applies status to three observable subsystems in sequence. **Why here:** the order object is updated before payout projection and notification. **Assumes:** arbitrary supplied transitions are meaningful; nothing found enforces a state graph. **Establishes:** on completion, the order stores the supplied value; payout changes only for `cancelled`/`delivered`; socket messages carry it. **Depended on by:** response and downstream payout/socket consumers.

```typescript
// L72
return order;
```
- **What:** Returns the mutated object. **Why here:** all downstream calls completed first. **Assumes:** the response need not expose whether a ledger row existed; `updateFromOrderStatus` can return `null` but its result is ignored (`payout.service.ts:L42-L56`). **Establishes:** normal response reflects current order status.

---

**Cross-Function Dependencies:**
- Callee `PayoutService.updateFromOrderStatus` (internal, `payout.service.ts:L42-L57`): returns `null` if no row, maps `cancelled` to `disputed`, `delivered` to `approved`, and leaves other statuses unchanged.
- Callee `RealtimeGateway.emitOrderStatusChanged` (internal, `realtime.gateway.ts:L23-L30`): emits to `global` and `admin-notifications` rooms.
- Callers: HTTP clients through `OrderModule` (`order.module.ts:L6-L9`).
- Shared state: mutates an object in `orders`; may mutate matching `ledger`; emits over gateway server.
- Invariant coupling: order-to-payout correspondence is keyed only by `orderId`; absent ledger is allowed by the callee and not surfaced here (L66, `payout.service.ts:L43-L46`).

---

**Open Questions:**
- unclear; need the order state-transition and caller-authorization policy.
- unclear; need API response policy for a missing order and for a present order with no ledger row.

