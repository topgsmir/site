import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { RequestAuthenticationService } from "../auth/request-authentication.service";
import type { AuthenticatedRequest } from "../auth/platform-admin.guard";

@Injectable()
export class SellerBlogGuard implements CanActivate {
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

    const membership = await this.prisma.seller_memberships.findFirst({
      where: {
        user_id: user.id,
        active: true,
        seller: {
          invited: false,
          approved: true,
          suspended_at: null,
          permissions: { some: { permission: "blog_manage" } }
        }
      },
      select: { role: true, seller: { select: { id: true } } }
    });

    if (!membership) {
      throw new ForbiddenException(
        "An active seller with blog-management permission is required"
      );
    }

    request.sellerContext = {
      sellerId: membership.seller.id,
      membershipRole: membership.role,
      user
    };
    return true;
  }
}
