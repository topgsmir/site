## `OrderController.create` in apps/api/src/modules/order/order.controller.ts (L38-L53)

**Purpose:** Implements `POST /api/orders`, appends a pending order, derives a draft payout ledger row, emits an order-created socket event, and returns the order (L26, L38-L53; `main.ts:L21`).

---

**Inputs & Assumptions:**
- `body` (`CreateOrderDto` type alias): untrusted HTTP JSON (L6-L12, L39).
- Preconditions: ids, product type, amount, and currency have the declared shapes and business meaning; the type alias provides no runtime class metadata and no local checks establish them; nothing found (L6-L12, L39-L47).
- Precondition: generated millisecond id is distinct in both `orders` and payout `ledger`; nothing found (L41, `payout.service.ts:L28`, L38).

---

**Outputs & Effects:** Appends a pending one-item order (L40-L46), appends a derived draft payout row through `recordDraft` (L47; `payout.service.ts:L23-L39`), emits `order.created` to room `global` (L48-L51; `realtime.gateway.ts:L19-L21`), and returns the order (L52). There is no rollback across these separate effects (L46-L52).

---

**Block-by-Block:**

```typescript
// L40-L46
const order = { id: `${Date.now()}`, status: "pending" as const, items: [body] } satisfies Order;
orders.push(order);
```
- **What:** Constructs and stores the order. **Why here:** later payout/event calls need its id and status. **Assumes:** body validity and id uniqueness; nothing found. **Establishes:** the order is visible to `list`/`updateStatus` before downstream calls execute. **Depended on by:** L47-L52 and later requests.

```typescript
// L47-L52
this.payoutService.recordDraft(order.id, body.sellerId, body.amount, body.currency);
this.realtime.emitOrderCreated(order.id, { orderId: order.id, status: order.status });
return order;
```
- **What:** Creates accounting state, publishes a socket message, then returns. **Why here:** both derive from the stored order. **Assumes:** both calls complete without throwing and consumers accept duplicate `orderId` assignment in the emitted object; internal callees are synchronous on visible paths. **Establishes:** on normal return, all three effects have run in order. **Depended on by:** payout requests/status propagation and realtime consumers.

---

**Cross-Function Dependencies:**
- Callee `PayoutService.recordDraft` (internal, `payout.service.ts:L23-L40`): computes fixed 10% commission and 5% holdback, rounds components, and appends unconditionally.
- Callee `RealtimeGateway.emitOrderCreated` (internal, `realtime.gateway.ts:L19-L21`): emits to `global`; all connecting sockets join that room in `handleConnection` (L15-L17).
- Callers: HTTP clients via `OrderModule` (`order.module.ts:L6-L9`). No guard is declared on controller or method (L26-L53).
- Shared state: writes `orders` and, through the service, `ledger`; gateway interacts with connected socket rooms.
- Invariant coupling: the order and draft row share `order.id`, but their creation is separate sequential mutation (L46-L48).

---

**Open Questions:**
- unclear; need order creation policy to establish buyer/seller identity, product/price source, accepted currencies, and amount bounds.
- unclear; need caller expectations for partial completion if a downstream call throws after `orders.push`.

