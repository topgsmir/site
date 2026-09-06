import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable
} from "@nestjs/common";
import type { AuthenticatedRequest } from "../auth/platform-admin.guard";
import { RequestAuthenticationService } from "../auth/request-authentication.service";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class SellerProductsGuard implements CanActivate {
  constructor(
    private readonly requestAuthentication: RequestAuthenticationService,
    private readonly prisma: PrismaService
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = await this.requestAuthentication.authenticate(request);

    if (user.role !== "seller-admin" && user.role !== "seller-staff") {
      throw new ForbiddenException("Seller access is required");
    }

    const seller = await this.prisma.sellers.findFirst({
      where: {
        user_id: user.id,
        invited: false,
        approved: true,
        suspended_at: null,
        permissions: { some: { permission: "products_manage" } }
      },
      select: { id: true }
    });

    if (!seller) {
      throw new ForbiddenException(
        "An active seller with product-management permission is required"
      );
    }

    request.sellerContext = { sellerId: seller.id, user };
    return true;
  }
}
