import { Injectable } from "@nestjs/common";
import { AuthService } from "./auth.service";
import type { AuthenticatedRequest } from "./platform-admin.guard";
import { readSessionToken } from "./session-token";

@Injectable()
export class RequestAuthenticationService {
  constructor(private readonly authService: AuthService) {}

  async authenticate(request: AuthenticatedRequest) {
    const authenticated = await this.authService.getUserFromToken(
      readSessionToken(request.headers.cookie, request.headers.authorization)
    );
    const user = request.headers["x-topgsm-workspace"] === "seller"
      ? await this.authService.inSellerWorkspace(authenticated)
      : authenticated;
    request.authenticatedUser = user;
    return user;
  }
}
