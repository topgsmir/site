## `RealtimeGateway.handleConnection` in apps/api/src/modules/realtime/realtime.gateway.ts (L15-L17)

**Purpose:** Handles each Socket.IO connection to namespace `/socket` by joining the client to the shared `global` room (L10-L17).

---

**Inputs & Assumptions:**
- `client` (`Socket`): framework-created socket representing a remote connection. Trust: untrusted remote peer mediated by Socket.IO (L15).
- Implicit: gateway accepts origins using `cors: { origin: "*" }` at L10.
- Precondition: every connected client is intended to receive global order events; no authentication, handshake inspection, or conditional membership is present, so policy establishment is nothing found (L10-L17).

---

**Outputs & Effects:** Calls `client.join("global")`, changing Socket.IO room membership (L16). The method neither awaits nor returns the join result (L15-L17).

---

**Block-by-Block:**

```typescript
// L15-L17
handleConnection(client: Socket) {
  client.join(`global`);
}
```
- **What:** Adds the new socket to one shared room. **Why here:** connection time ensures later broadcasts target it. **Assumes:** the adapter's join operation succeeds without requiring asynchronous handling, and all clients belong in this room; nothing local checks either. **Establishes:** a join call has been issued for `global`; completion semantics depend on the Socket.IO adapter. **Depended on by:** `emitOrderCreated` and `emitOrderStatusChanged`, which broadcast to `global` (L19-L24).

---

**Cross-Function Dependencies:**
- Callee `Socket.join` (external-black-box): room-membership operation at L16.
- Caller: Nest WebSocket lifecycle because the class implements `OnGatewayConnection` (L11, L15); gateway is registered by `RealtimeModule` (`realtime.module.ts:L4-L7`).
- Shared state: Socket.IO namespace room membership. Web client connections target `/socket` and force WebSocket transport (`apps/web/src/lib/sockets/socket.ts:L3-L10`).

---

**Open Questions:**
- unclear; need realtime audience policy and any deployment-level Socket.IO middleware not present in repository source.
- unclear; need configured adapter semantics to know whether `join` is asynchronous in deployment.

