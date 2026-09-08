import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { PlatformPermission } from "@topgsm/shared-types";
import type { AuthenticatedRequest } from "./platform-admin.guard";
import {
  PLATFORM_PERMISSION_KEY
} from "./platform-permission.decorator";
import { RequestAuthenticationService } from "./request-authentication.service";

@Injectable()
export class PlatformPermissionGuard implements CanActivate {
  constructor(
    private readonly authentication: RequestAuthenticationService,
    private readonly reflector: Reflector
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = await this.authentication.authenticate(request);
    const permission = this.reflector.getAllAndOverride<PlatformPermission>(
      PLATFORM_PERMISSION_KEY,
      [context.getHandler(), context.getClass()]
    );

    if (!permission) {
      throw new ForbiddenException("A platform permission must be declared");
    }
    if (
      user.role !== "platform-admin" &&
      (user.role !== "platform-staff" ||
        !user.platformPermissions?.includes(permission))
    ) {
      throw new ForbiddenException(`Platform permission '${permission}' is required`);
    }
    return true;
  }
}
