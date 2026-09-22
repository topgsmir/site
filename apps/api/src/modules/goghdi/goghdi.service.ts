import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException
} from "@nestjs/common";
import { createHmac, randomBytes } from "node:crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { GoghdiSettingsService } from "./goghdi-settings.service";

export type GoghdiOrderTicketOptions = {
  productId: string;
  chatTitle: string;
  category: "order";
  chatInfo: string;
  agentIds: string[];
};

@Injectable()
export class GoghdiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: GoghdiSettingsService
  ) {}

  async signOrderTicket(orderId: string, buyerUserId: string, orderItemId?: string) {
    const order = await this.prisma.orders.findFirst({
      where: { id: orderId, buyer_id: buyerUserId, ...(orderItemId ? { items: { some: { id: orderItemId } } } : {}) },
      select: {
        id: true,
        seller: { select: { id: true, shop_name: true, goghdi_agent_id: true } },
        items: { where: orderItemId ? { id: orderItemId } : undefined, select: { id: true, product_title: true }, take: 20 }
      }
    });
    if (!order) throw new NotFoundException("Order was not found");
    const item = orderItemId ? order.items.find((candidate) => candidate.id === orderItemId) : undefined;
    if (orderItemId && !item) throw new NotFoundException("Order item was not found");
    if (!order.seller.goghdi_agent_id) {
      throw new ServiceUnavailableException("The seller is not configured for chat");
    }
    const { secret } = await this.settings.ticketCredentials();
    const options: GoghdiOrderTicketOptions = {
      productId: item ? `order-item:${item.id}` : `order:${order.id}`,
      chatTitle: this.ticketTitle(order.id, item ? `${item.product_title} · ${order.seller.shop_name}` : order.seller.shop_name),
      category: "order",
      chatInfo: JSON.stringify({
        orderId: order.id,
        sellerId: order.seller.id,
        ...(item ? { orderItemId: item.id } : {}),
        products: item ? [item.product_title] : order.items.map((entry) => entry.product_title)
      }),
      agentIds: [order.seller.goghdi_agent_id]
    };
    const timestamp = Date.now();
    const nonce = randomBytes(24).toString("base64url");
    const signature = createHmac("sha256", secret)
      .update(`${timestamp}.${nonce}.${JSON.stringify(options)}`)
      .digest("hex");

    return { options, proof: { signature, timestamp, nonce } };
  }

  private ticketTitle(orderId: string, shopName: string) {
    const title = `Order ${orderId.slice(-8)} · ${shopName.trim()}`;
    return title.length <= 100 ? title : `${title.slice(0, 99).trimEnd()}…`;
  }
}
