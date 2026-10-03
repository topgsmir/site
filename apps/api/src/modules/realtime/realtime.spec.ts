import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { UnauthorizedException } from "@nestjs/common";
import type { Server, Socket } from "socket.io";
import type { AuthService } from "../auth/auth.service";
import type { PrismaService } from "../../prisma/prisma.service";
import type { CommentsService } from "../comments/comments.service";
import { RealtimeGateway } from "./realtime.gateway";

function socketFor(headers: { cookie?: string; authorization?: string } = {}) {
  const rooms: string[] = [];
  let disconnected = false;
  const socket = {
    handshake: { auth: {}, headers },
    join: async (room: string) => {
      rooms.push(room);
    },
    disconnect: () => {
      disconnected = true;
    }
  } as unknown as Socket;
  return { socket, rooms, disconnected: () => disconnected };
}

describe("realtime tenant isolation", () => {
  const comments = { isLockedUser: async () => false } as unknown as CommentsService;
  it("disconnects a socket when session authentication fails", async () => {
    const auth = {
      getUserFromToken: async () => {
        throw new Error("invalid");
      }
    } as unknown as AuthService;
    const gateway = new RealtimeGateway(auth, {} as PrismaService, comments);
    const client = socketFor();
    await gateway.handleConnection(client.socket);
    assert.equal(client.disconnected(), true);
    assert.deepEqual(client.rooms, []);
  });

  it("joins only verified actor and active seller rooms", async () => {
    const auth = {
      getUserFromToken: async () => ({
        id: "user-1",
        fullName: "Seller",
        email: "seller@example.com",
        role: "seller-admin"
      })
    } as unknown as AuthService;
    const prisma = {
      seller_memberships: {
        findFirst: async () => ({
          seller: { id: "seller-1", permissions: [{ permission: "orders_manage" }] }
        })
      }
    } as unknown as PrismaService;
    const gateway = new RealtimeGateway(auth, prisma, comments);
    const client = socketFor({ authorization: "Bearer opaque" });
    await gateway.handleConnection(client.socket);
    assert.deepEqual(client.rooms, ["user:user-1", "seller:seller-1:orders"]);
  });

  it("disconnects a seller with unanswered comments before joining seller rooms", async () => {
    const auth = { getUserFromToken: async () => ({ id: "user-1", role: "seller-admin" }) } as unknown as AuthService;
    const lockedComments = { isLockedUser: async () => true } as unknown as CommentsService;
    const gateway = new RealtimeGateway(auth, {} as PrismaService, lockedComments);
    const client = socketFor({ authorization: "Bearer opaque" });
    await gateway.handleConnection(client.socket);
    assert.equal(client.disconnected(), true);
    assert.equal(client.rooms.includes("seller:seller-1:orders"), false);
  });

  it("does not join order or payout rooms for blog-only platform staff", async () => {
    const auth = {
      getUserFromToken: async () => ({
        id: "editor-1",
        fullName: "Editor",
        email: "editor@example.com",
        role: "platform-staff",
        platformPermissions: ["blog_manage"]
      })
    } as unknown as AuthService;
    const gateway = new RealtimeGateway(auth, {} as PrismaService, comments);
    const client = socketFor({ authorization: "Bearer opaque" });
    await gateway.handleConnection(client.socket);
    assert.deepEqual(client.rooms, ["user:editor-1"]);
  });

  it("rechecks authentication before delivering private events to scoped rooms", async () => {
    const emissions: Array<{ room: string; event: string }> = [];
    const gateway = new RealtimeGateway({ getUserFromToken: async () => ({ id: "buyer-1", role: "buyer" }) } as unknown as AuthService, {} as PrismaService, comments);
    gateway.server = {
      in: (rooms: string[]) => ({ fetchSockets: async () => rooms.map(room => ({ rooms: new Set([room]), handshake: { headers: { authorization: "Bearer active" } }, emit: (event: string) => emissions.push({ room, event }), disconnect: () => undefined })) })
    } as unknown as Server;

    await gateway.emitOrderStatusChanged(
      { buyerId: "buyer-1", sellerId: "seller-1" },
      { orderId: "order-1", status: "shipped" }
    );
    assert.deepEqual(emissions, [{ room: "user:buyer-1", event: "order.status.updated" }]);
    assert.ok(emissions.every((entry) => entry.room !== "global"));
  });
  it("disconnects revoked or blocked sockets instead of delivering private events", async () => {
    let disconnected = false; let emitted = false;
    const gateway = new RealtimeGateway({ getUserFromToken: async () => { throw new UnauthorizedException("revoked"); } } as unknown as AuthService, {} as PrismaService, comments);
    gateway.server = { in: () => ({ fetchSockets: async () => [{ rooms: new Set(["seller:seller:payouts"]), handshake: { headers: {} }, disconnect: () => { disconnected = true; }, emit: () => { emitted = true; } }] }) } as unknown as Server;
    await gateway.emitPayoutStatusChanged("seller", {});
    assert.equal(disconnected, true); assert.equal(emitted, false);
  });

  it("stops seller delivery immediately when the current permission is revoked", async () => {
    let emitted = false; let disconnected = false;
    const auth = { getUserFromToken: async () => ({ id: "staff-1", role: "seller-staff" }) } as unknown as AuthService;
    const prisma = { seller_memberships: { findFirst: async ({ where }: { where: Record<string, unknown> }) => {
      assert.equal(where.seller_id, "seller-1");
      assert.deepEqual(where.seller, { invited: false, approved: true, suspended_at: null, permissions: { some: { permission: "orders_manage" } } });
      return null;
    } } } as unknown as PrismaService;
    const gateway = new RealtimeGateway(auth, prisma, comments);
    gateway.server = { in: () => ({ fetchSockets: async () => [{ rooms: new Set(["seller:seller-1:orders"]), handshake: { headers: {} }, emit: () => { emitted = true; }, disconnect: () => { disconnected = true; } }] }) } as unknown as Server;
    await gateway.emitOrderCreated({ buyerId: "buyer-1", sellerId: "seller-1" }, {});
    assert.equal(emitted, false);
    assert.equal(disconnected, true);
  });

  it("delivers to an active seller and propagates membership lookup failures", async () => {
    let emitted = 0;
    let shouldFail = false;
    const auth = { getUserFromToken: async () => ({ id: "staff-1", role: "seller-staff" }) } as unknown as AuthService;
    const prisma = { seller_memberships: { findFirst: async () => {
      if (shouldFail) throw new Error("database unavailable");
      return { seller_id: "seller-1" };
    } } } as unknown as PrismaService;
    const gateway = new RealtimeGateway(auth, prisma, comments);
    gateway.server = { in: () => ({ fetchSockets: async () => [{ rooms: new Set(["seller:seller-1:payouts"]), handshake: { headers: {} }, emit: () => { emitted++; }, disconnect: () => undefined }] }) } as unknown as Server;
    await gateway.emitPayoutStatusChanged("seller-1", {});
    assert.equal(emitted, 1);
    shouldFail = true;
    await assert.rejects(gateway.emitPayoutStatusChanged("seller-1", {}), /database unavailable/);
  });
});
