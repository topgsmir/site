import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";

type Payload = Record<string, unknown>;

@WebSocketGateway({ cors: { origin: "*" }, namespace: "/socket" })
export class RealtimeGateway implements OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  handleConnection(client: Socket) {
    client.join(`global`);
  }

  emitOrderCreated(orderId: string, payload: Payload) {
    this.server.to("global").emit("order.created", { orderId, ...payload });
  }

  emitOrderStatusChanged(orderId: string, payload: Payload) {
    this.server.to("global").emit("order.status.updated", { orderId, ...payload });
    this.server.to(`admin-notifications`).emit("admin.notification", {
      orderId,
      event: "order.status.updated",
      ...payload
    });
  }
}

