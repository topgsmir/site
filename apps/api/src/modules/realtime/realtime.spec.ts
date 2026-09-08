import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import type { Server, Socket } from "socket.io";
import type { AuthService } from "../auth/auth.service";
import type { PrismaService } from "../../prisma/prisma.service";
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
  it("disconnects a socket when session authentication fails", async () => {
    const auth = {
      getUserFromToken: async () => {
        throw new Error("invalid");
      }
    } as unknown as AuthService;
    const gateway = new RealtimeGateway(auth, {} as PrismaService);
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
      sellers: {
        findFirst: async () => ({
          id: "seller-1",
          permissions: [{ permission: "orders_manage" }]
        })
      }
    } as unknown as PrismaService;
    const gateway = new RealtimeGateway(auth, prisma);
    const client = socketFor({ authorization: "Bearer opaque" });
    await gateway.handleConnection(client.socket);
    assert.deepEqual(client.rooms, ["user:user-1", "seller:seller-1:orders"]);
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
    const gateway = new RealtimeGateway(auth, {} as PrismaService);
    const client = socketFor({ authorization: "Bearer opaque" });
    await gateway.handleConnection(client.socket);
    assert.deepEqual(client.rooms, ["user:editor-1"]);
  });

  it("emits order events only to buyer, seller, and platform rooms", () => {
    const emissions: Array<{ room: string; event: string }> = [];
    const gateway = new RealtimeGateway({} as AuthService, {} as PrismaService);
    gateway.server = {
      to: (room: string) => ({
        emit: (event: string) => emissions.push({ room, event })
      })
    } as unknown as Server;

    gateway.emitOrderStatusChanged(
      { buyerId: "buyer-1", sellerId: "seller-1" },
      { orderId: "order-1", status: "shipped" }
    );
    assert.deepEqual(emissions, [
      { room: "user:buyer-1", event: "order.status.updated" },
      { room: "seller:seller-1:orders", event: "order.status.updated" },
      { room: "platform:orders", event: "order.status.updated" }
    ]);
    assert.ok(emissions.every((entry) => entry.room !== "global"));
  });
});
