import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import type { AuthenticatedRequest } from "../auth/platform-admin.guard";
import { RequestAuthenticationService } from "../auth/request-authentication.service";

export type BlogActor = NonNullable<AuthenticatedRequest["blogActor"]>;

@Injectable()
export class BlogManageGuard implements CanActivate {
  constructor(
    private readonly authentication: RequestAuthenticationService,
    private readonly prisma: PrismaService
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = await this.authentication.authenticate(request);
    if (
      user.role === "platform-admin" ||
      (user.role === "platform-staff" &&
        user.platformPermissions?.includes("blog_manage"))
    ) {
      request.blogActor = { type: "platform", user };
      return true;
    }
    if (user.role !== "seller-admin" && user.role !== "seller-staff") {
      throw new ForbiddenException("Blog management access is required");
    }
    const seller = await this.prisma.sellers.findFirst({
      where: {
        user_id: user.id,
        invited: false,
        approved: true,
        suspended_at: null,
        permissions: { some: { permission: "blog_manage" } }
      },
      select: { id: true, blog_review_required: true }
    });
    if (!seller) {
      throw new ForbiddenException(
        "An active seller with blog-management permission is required"
      );
    }
    request.blogActor = {
      type: "seller",
      sellerId: seller.id,
      reviewRequired: seller.blog_review_required,
      user
    };
    return true;
  }
}
