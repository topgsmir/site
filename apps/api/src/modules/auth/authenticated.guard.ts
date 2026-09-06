import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { RequestAuthenticationService } from "./request-authentication.service";
import type { AuthenticatedRequest } from "./platform-admin.guard";

@Injectable()
export class AuthenticatedGuard implements CanActivate {
  constructor(private readonly authentication: RequestAuthenticationService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    await this.authentication.authenticate(request);
    return true;
  }
}
