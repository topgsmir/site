## `getSocket` in apps/web/src/lib/sockets/socket.ts (L3-L14)

**Purpose:** Lazily creates and then reuses one browser Socket.IO connection to the API's `/socket` namespace (L3-L14).

---

**Inputs & Assumptions:**
- Implicit: public API URL configuration, browser networking, module-scoped `socket` state (L3-L8).
- Precondition: removing the first literal `/api` from `NEXT_PUBLIC_API_URL` yields the socket origin. Established by: nothing found (L3).
- Precondition: callers want one shared Socket instance for the module lifetime. Established by module-scoped cache (L4, L7-L13).

---

**Outputs & Effects:**
- On first call, initiates a websocket-only Socket.IO client connection to `${SOCKET_URL}/socket` and stores it (L7-L10).
- Returns the cached `Socket` on every call (L13).
- No explicit disconnect/reset path appears in this module (L4-L14).

---

**Block-by-Block:**

```ts
// L7-L13
if (!socket) {
  socket = io(`${SOCKET_URL}/socket`, { transports: ["websocket"] });
}
return socket;
```
- **What:** Performs lazy singleton initialization.
- **Why here:** Defers connection until requested and prevents duplicate instances from this module.
- **Assumes:** the Socket.IO server is compatible and reachable via WebSocket. Established by runtime handshake: nothing found before connection.
- **Establishes:** after the assignment, later calls return the same client object.
- **Depended on by:** no callers found under `apps/web/src`.

---

**Cross-Function Dependencies:**
- Callee `io` (external-source-available Socket.IO client): owns handshake, reconnection, events, and transport lifecycle (L8-L10).
- Callers: nothing found under `apps/web/src`.
- Shared state: module singleton `socket` (L4); network connection and Socket.IO internal state.
- Invariant couplings: authentication/authorization behavior for the `/socket` namespace is not established by this client helper.

---

**Open Questions:**
- unclear; need to inspect the API Socket.IO gateway and deployment URL conventions before relying on namespace or authentication behavior.

