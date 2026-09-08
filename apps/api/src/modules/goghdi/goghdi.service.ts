import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHmac } from "node:crypto";
import { PrismaService } from "../../prisma/prisma.service";

export type GoghdiProductTicketOptions = {
  productId: string;
  chatTitle: string;
  department?: string;
};

@Injectable()
export class GoghdiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService
  ) {}

  async signProductTicket(productId: string) {
    const secret = this.config.get<string>("GOGHDI_TENANT_SECRET")?.trim();
    if (!secret) {
      throw new ServiceUnavailableException("Chat support is not configured");
    }

    const product = await this.prisma.products.findFirst({
      where: { id: productId, status: "active" },
      select: { id: true, title: true }
    });
    if (!product) throw new NotFoundException("Product was not found");

    const department = this.config.get<string>("GOGHDI_SUPPORT_DEPARTMENT")?.trim();
    if (department && (department.length < 2 || department.length > 100)) {
      throw new ServiceUnavailableException("Chat support department is misconfigured");
    }
    const options: GoghdiProductTicketOptions = {
      productId: product.id,
      chatTitle: this.ticketTitle(product.title),
      ...(department ? { department } : {})
    };
    const signature = createHmac("sha256", secret)
      .update(JSON.stringify(options))
      .digest("hex");

    return { options, signature };
  }

  private ticketTitle(productTitle: string) {
    const title = `Product support: ${productTitle.trim()}`;
    return title.length <= 100 ? title : `${title.slice(0, 99).trimEnd()}…`;
  }
}
