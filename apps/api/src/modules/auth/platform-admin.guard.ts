import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable
} from "@nestjs/common";
import type { AppUser } from "@topgsm/shared-types";
import { RequestAuthenticationService } from "./request-authentication.service";

export type AuthenticatedRequest = {
  method?: string;
  ip?: string;
  headers: {
    cookie?: string;
    authorization?: string;
    origin?: string;
    "sec-fetch-site"?: string;
  };
  authenticatedUser?: AppUser;
  sellerContext?: {
    sellerId: string;
    user: AppUser;
  };
  blogActor?:
    | { type: "platform"; user: AppUser }
    | {
        type: "seller";
        sellerId: string;
        reviewRequired: boolean;
        user: AppUser;
      };
};

@Injectable()
export class PlatformAdminGuard implements CanActivate {
  constructor(private readonly requestAuthentication: RequestAuthenticationService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = await this.requestAuthentication.authenticate(request);

    if (user.role !== "platform-admin") {
      throw new ForbiddenException("Platform administrator access is required");
    }

    return true;
  }
}
