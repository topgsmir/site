import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import { BROWSER_SESSION_MUTATION } from "./browser-session-mutation.decorator";
import { getAllowedWebOrigins } from "./security-config";
import { hasSessionCookie } from "./session-token";
import type { AuthenticatedRequest } from "./platform-admin.guard";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const BEARER_PATTERN = /^Bearer\s+[^\s]+$/i;

@Injectable()
export class BrowserMutationGuard implements CanActivate {
  private readonly allowedOrigins: ReadonlySet<string>;

  constructor(
    private readonly reflector: Reflector,
    config: ConfigService
  ) {
    this.allowedOrigins = new Set(getAllowedWebOrigins(config));
  }

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (SAFE_METHODS.has(request.method?.toUpperCase() ?? "GET")) return true;

    const createsBrowserSession = this.reflector.getAllAndOverride<boolean>(
      BROWSER_SESSION_MUTATION,
      [context.getHandler(), context.getClass()]
    );
    const cookieAuthenticated = hasSessionCookie(request.headers.cookie);

    if (!createsBrowserSession && !cookieAuthenticated) return true;
    if (!createsBrowserSession && BEARER_PATTERN.test(request.headers.authorization ?? "")) {
      return true;
    }

    const origin = request.headers.origin;
    if (!origin || !this.allowedOrigins.has(origin)) {
      throw new ForbiddenException("Request origin is not allowed");
    }

    return true;
  }
}
