import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException
} from "@nestjs/common";
import { createHmac, randomBytes } from "node:crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { GoghdiSettingsService } from "./goghdi-settings.service";

export type GoghdiTicketOptions = {
  productId: string;
  chatTitle: string;
  category: "order" | "support";
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
    const options: GoghdiTicketOptions = {
      productId: item ? `order-item:${item.id}` : `order:${order.id}`,
      chatTitle: this.orderTicketTitle(order.id, item ? `${item.product_title} · ${order.seller.shop_name}` : order.seller.shop_name),
      category: "order",
      chatInfo: JSON.stringify({
        orderId: order.id,
        sellerId: order.seller.id,
        ...(item ? { orderItemId: item.id } : {}),
        products: item ? [item.product_title] : order.items.map((entry) => entry.product_title)
      }),
      agentIds: [order.seller.goghdi_agent_id]
    };
    return this.sign(options);
  }

  async signAgentTicket(sellerId: string) {
    const seller = await this.prisma.sellers.findFirst({
      where: {
        id: sellerId,
        invited: false,
        approved: true,
        suspended_at: null
      },
      select: {
        id: true,
        shop_name: true,
        profile_name: true,
        goghdi_agent_id: true
      }
    });
    if (!seller) throw new NotFoundException("Expert was not found");
    if (!seller.goghdi_agent_id) {
      throw new ServiceUnavailableException("The seller is not configured for chat");
    }
    const displayName = (seller.profile_name ?? seller.shop_name).trim();
    const options: GoghdiTicketOptions = {
      productId: `seller:${seller.id}`,
      chatTitle: this.supportTicketTitle(displayName),
      category: "support",
      chatInfo: JSON.stringify({ sellerId: seller.id, source: "remote" }),
      agentIds: [seller.goghdi_agent_id]
    };
    return this.sign(options);
  }

  private async sign(options: GoghdiTicketOptions) {
    const { secret } = await this.settings.ticketCredentials();
    const timestamp = Date.now();
    const nonce = randomBytes(24).toString("base64url");
    const signature = createHmac("sha256", secret)
      .update(`${timestamp}.${nonce}.${JSON.stringify(options)}`)
      .digest("hex");
    return { options, proof: { signature, timestamp, nonce } };
  }

  private orderTicketTitle(orderId: string, shopName: string) {
    const title = `Order ${orderId.slice(-8)} · ${shopName.trim()}`;
    return title.length <= 100 ? title : `${title.slice(0, 99).trimEnd()}…`;
  }

  private supportTicketTitle(name: string) {
    const title = `Remote support · ${name}`;
    return title.length <= 100 ? title : `${title.slice(0, 99).trimEnd()}…`;
  }
}
