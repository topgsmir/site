import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { PrismaService } from "../../prisma/prisma.service";
import { AuthService } from "../auth/auth.service";
import { readSessionToken } from "../auth/session-token";
import { CommentsService } from "../comments/comments.service";

type Payload = Record<string, unknown>;
type OrderAudience = { buyerId: string; sellerId: string };

@WebSocketGateway({ namespace: "/socket" })
export class RealtimeGateway implements OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly auth: AuthService,
    private readonly prisma: PrismaService,
    private readonly comments: CommentsService
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
      if (user.role === "platform-admin" || user.role === "platform-staff") {
        const permissions = new Set(user.platformPermissions ?? []);
        if (user.role === "platform-admin" || permissions.has("orders_manage")) {
          await client.join("platform:orders");
        }
        if (user.role === "platform-admin" || permissions.has("payouts_manage")) {
          await client.join("platform:payouts");
        }
      } else if (user.role === "seller-admin" || user.role === "seller-staff") {
        if (await this.comments.isLockedUser(user)) {
          client.disconnect(true);
          return;
        }
        const membership = await this.prisma.seller_memberships.findFirst({
          where: {
            user_id: user.id,
            active: true,
            seller: { invited: false, approved: true, suspended_at: null }
          },
          select: { seller: { select: { id: true, permissions: { select: { permission: true } } } } }
        });
        if (membership) {
          const seller = membership.seller;
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
    return this.emitToOrderAudience(audience, "order.created", payload);
  }

  emitOrderStatusChanged(audience: OrderAudience, payload: Payload) {
    return this.emitToOrderAudience(audience, "order.status.updated", payload);
  }

  emitPayoutStatusChanged(sellerId: string, payload: Payload) {
    return this.emitAuthorized([`seller:${sellerId}:payouts`, "platform:payouts"], "payout.status.updated", payload);
  }

  private emitToOrderAudience(
    audience: OrderAudience,
    event: string,
    payload: Payload
  ) {
    return this.emitAuthorized([`user:${audience.buyerId}`, `seller:${audience.sellerId}:orders`, "platform:orders"], event, payload);
  }

  private async emitAuthorized(rooms: string[], event: string, payload: Payload) {
    // Room membership is not a cached authorization decision. Recheck before
    // each private delivery, including sockets connected to another replica.
    try {
      const sockets = await this.server.in(rooms).fetchSockets();
      for (const socket of sockets) {
        try {
          await this.auth.getUserFromToken(readSessionToken(socket.handshake.headers.cookie, socket.handshake.headers.authorization));
          socket.emit(event, payload);
        } catch { socket.disconnect(true); }
      }
    } catch { /* Fail closed when the adapter/database is unavailable. */ }
  }
}
