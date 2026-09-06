## `RealtimeGateway.emitOrderStatusChanged` in apps/api/src/modules/realtime/realtime.gateway.ts (L23-L30)

**Purpose:** Broadcasts an order-status event to the shared global room and an admin-shaped notification to the `admin-notifications` room (L23-L30).

---

**Inputs & Assumptions:**
- `orderId` (`string`): route id after a successful order lookup on the visible caller path (`order.controller.ts:L55-L67`). Trust: semi-trusted.
- `payload` (`Record<string, unknown>`): built from route/body data by the caller (`order.controller.ts:L67-L70`). Trust: untrusted-derived.
- Precondition: `server` is initialized by Nest before use; framework-established via `@WebSocketServer` (L12-L13).
- Precondition: intended administrators join `admin-notifications`; no join to that room is present in this gateway or elsewhere in repository source, so establishment is nothing found (L15-L17, L25).

---

**Outputs & Effects:** Issues `order.status.updated` to `global` (L24) and `admin.notification` to `admin-notifications` with fixed `event` plus merged payload (L25-L29). In both objects, later spread keys can replace preceding `orderId`, and in the admin object can replace `event` (L24-L29).

---

**Block-by-Block:**

```typescript
// L23-L24
emitOrderStatusChanged(orderId: string, payload: Payload) {
  this.server.to("global").emit("order.status.updated", { orderId, ...payload });
```
- **What:** Broadcasts the general status event. **Why here:** global notification precedes the admin-specific emit. **Assumes:** payload envelope and global audience are appropriate. **Establishes:** the first emit call has run before the second begins. **Depended on by:** global-room consumers.

```typescript
// L25-L29
this.server.to(`admin-notifications`).emit("admin.notification", {
  orderId,
  event: "order.status.updated",
  ...payload
});
```
- **What:** Broadcasts an admin notification envelope. **Why here:** occurs after the global event. **Assumes:** intended clients occupy the room and payload cannot alter envelope meaning; membership is established by nothing found and the generic type permits colliding keys. **Establishes:** an admin-room emit call is issued on normal execution. **Depended on by:** admin notification consumers.

---

**Cross-Function Dependencies:**
- Callees `Server.to` and broadcast `emit` (external-black-box) twice at L24-L29.
- Caller: `OrderController.updateStatus` only (`order.controller.ts:L67-L70`).
- Shared state: gateway server, `global` room populated by `handleConnection`, and `admin-notifications` room with no visible population path (L12-L17, L25).

---

**Open Questions:**
- unclear; need client listener schemas and the mechanism that populates `admin-notifications`.
- unclear; need semantics expected if the first emit succeeds and the second does not.

