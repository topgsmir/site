import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import type { AuthenticatedRequest } from "../auth/platform-admin.guard";
import { RequestAuthenticationService } from "../auth/request-authentication.service";

@Injectable()
export class SellerUploadsGuard implements CanActivate {
  constructor(private readonly authentication: RequestAuthenticationService, private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = await this.authentication.authenticate(request);
    if (user.role !== "seller-admin" && user.role !== "seller-staff") throw new ForbiddenException("Seller access is required");
    const membership = await this.prisma.seller_memberships.findFirst({
      where: { user_id: user.id, active: true, seller: { invited: false, approved: true, suspended_at: null } },
      select: { role: true, seller: { select: { id: true } } }
    });
    if (!membership) throw new ForbiddenException("An active seller is required");
    request.sellerContext = { sellerId: membership.seller.id, membershipRole: membership.role, user };
    return true;
  }
}
