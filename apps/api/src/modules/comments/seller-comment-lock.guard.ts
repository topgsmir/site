import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { AuthService } from "../auth/auth.service";
import type { AuthenticatedRequest } from "../auth/platform-admin.guard";
import { readSessionToken } from "../auth/session-token";
import { CommentsService } from "./comments.service";

@Injectable()
export class SellerCommentLockGuard implements CanActivate {
  constructor(private readonly auth: AuthService, private readonly comments: CommentsService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest & { path?: string }>();
    const path = request.path ?? "";
    if (path.startsWith("/api/auth/") || path.startsWith("/api/comments/") || path.startsWith("/api/admin/settings/comments")) return true;
    const token = readSessionToken(request.headers.cookie, request.headers.authorization);
    if (!token) return true;
    let user;
    try {
      user = await this.auth.getUserFromToken(token);
    } catch (error) {
      if (error instanceof UnauthorizedException) return true;
      throw error;
    }
    request.authenticatedUser = user;
    if (await this.comments.isLockedUser(user)) {
      throw new ForbiddenException("Answer or flag unanswered product comments before using the seller workspace");
    }
    return true;
  }
}
