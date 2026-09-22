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

  async signOrderTicket(orderId: string, buyerUserId: string) {
    const order = await this.prisma.orders.findFirst({
      where: { id: orderId, buyer_id: buyerUserId },
      select: {
        id: true,
        seller: { select: { id: true, shop_name: true, goghdi_agent_id: true } },
        items: { select: { product_type: true, product_title: true } }
      }
    });
    if (!order) throw new NotFoundException("Order was not found");
    if (!order.seller.goghdi_agent_id) {
      throw new ServiceUnavailableException("The seller is not configured for chat");
    }
    const { secret } = await this.settings.ticketCredentials();
    const options: GoghdiOrderTicketOptions = {
      productId: `order:${order.id}`,
      chatTitle: this.ticketTitle(order.id, order.seller.shop_name),
      category: "order",
      chatInfo: JSON.stringify({
        orderId: order.id,
        sellerId: order.seller.id,
        products: order.items.map((item) => item.product_title).slice(0, 20)
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
