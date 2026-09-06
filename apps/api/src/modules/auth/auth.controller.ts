import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Ip,
  Post,
  Res
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";
import { AuthRateLimitService } from "./auth-rate-limit.service";
import { BrowserSessionMutation } from "./browser-session-mutation.decorator";
import { readSessionToken, SESSION_COOKIE } from "./session-token";

type HeaderResponse = {
  setHeader(name: string, value: string): void;
};

@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly rateLimits: AuthRateLimitService,
    private readonly config: ConfigService
  ) {}

  @Post("register")
  @BrowserSessionMutation()
  async register(
    @Body() body: RegisterDto,
    @Ip() clientIp: string,
    @Res({ passthrough: true }) response: HeaderResponse
  ) {
    await this.rateLimits.consumeRegistration(body.email, clientIp);
    const session = await this.authService.register(body);
    this.setSessionCookie(response, session.token);
    return { user: session.user };
  }

  @Post("login")
  @BrowserSessionMutation()
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() body: LoginDto,
    @Ip() clientIp: string,
    @Res({ passthrough: true }) response: HeaderResponse
  ) {
    await this.rateLimits.consumeLogin(body.identifier, clientIp);
    const session = await this.authService.login(body);
    await this.rateLimits.clearSuccessfulLogin(body.identifier);
    this.setSessionCookie(response, session.token);
    return { user: session.user };
  }

  @Get("me")
  me(
    @Headers("cookie") cookieHeader?: string,
    @Headers("authorization") authorization?: string
  ) {
    return this.authService.getUserFromToken(
      readSessionToken(cookieHeader, authorization)
    );
  }

  @Post("logout")
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Headers("cookie") cookieHeader: string | undefined,
    @Headers("authorization") authorization: string | undefined,
    @Res({ passthrough: true }) response: HeaderResponse
  ) {
    await this.authService.revokeSession(
      readSessionToken(cookieHeader, authorization)
    );
    response.setHeader("Set-Cookie", this.serializeCookie("", 0));
  }

  private setSessionCookie(response: HeaderResponse, token: string) {
    response.setHeader(
      "Set-Cookie",
      this.serializeCookie(token, this.authService.sessionTtlSeconds)
    );
  }

  private serializeCookie(value: string, maxAge: number) {
    const attributes = [
      `${SESSION_COOKIE}=${value}`,
      "Path=/",
      "HttpOnly",
      "SameSite=Lax",
      `Max-Age=${maxAge}`,
      ...(maxAge === 0 ? ["Expires=Thu, 01 Jan 1970 00:00:00 GMT"] : [])
    ];
    const domain = this.config.get<string>("AUTH_COOKIE_DOMAIN")?.trim();

    if (domain) attributes.push(`Domain=${domain}`);
    if (this.config.get("NODE_ENV") === "production") attributes.push("Secure");

    return attributes.join("; ");
  }
}
