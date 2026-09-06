import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { PrismaService } from "../../prisma/prisma.service";
import { AuthService } from "../auth/auth.service";
import { readSessionToken } from "../auth/session-token";

type Payload = Record<string, unknown>;
type OrderAudience = { buyerId: string; sellerId: string };

@WebSocketGateway({ namespace: "/socket" })
export class RealtimeGateway implements OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly auth: AuthService,
    private readonly prisma: PrismaService
  ) {}

  async handleConnection(client: Socket) {
    try {
      const user = await this.auth.getUserFromToken(
        readSessionToken(
          client.handshake.headers.cookie,
          client.handshake.headers.authorization
        )
      );

      await client.join(`user:${user.id}`);
      if (user.role === "platform-admin") {
        await client.join("platform-admin");
      } else if (user.role === "seller-admin" || user.role === "seller-staff") {
        const seller = await this.prisma.sellers.findFirst({
          where: {
            user_id: user.id,
            invited: false,
            approved: true,
            suspended_at: null
          },
          select: { id: true, permissions: { select: { permission: true } } }
        });
        if (seller) {
          const permissions = new Set(
            seller.permissions.map((item) => item.permission)
          );
          if (permissions.has("orders_manage")) {
            await client.join(`seller:${seller.id}:orders`);
          }
          if (permissions.has("payouts_request")) {
            await client.join(`seller:${seller.id}:payouts`);
          }
        }
      }
    } catch {
      client.disconnect(true);
    }
  }

  emitOrderCreated(audience: OrderAudience, payload: Payload) {
    this.emitToOrderAudience(audience, "order.created", payload);
  }

  emitOrderStatusChanged(audience: OrderAudience, payload: Payload) {
    this.emitToOrderAudience(audience, "order.status.updated", payload);
  }

  emitPayoutStatusChanged(sellerId: string, payload: Payload) {
    this.server
      .to(`seller:${sellerId}:payouts`)
      .emit("payout.status.updated", payload);
    this.server.to("platform-admin").emit("payout.status.updated", payload);
  }

  private emitToOrderAudience(
    audience: OrderAudience,
    event: string,
    payload: Payload
  ) {
    this.server.to(`user:${audience.buyerId}`).emit(event, payload);
    this.server.to(`seller:${audience.sellerId}:orders`).emit(event, payload);
    this.server.to("platform-admin").emit(event, payload);
  }
}
