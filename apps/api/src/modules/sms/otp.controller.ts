import { Body, Controller, Ip, Post, Res } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AuthRateLimitService } from "../auth/auth-rate-limit.service";
import { BrowserSessionMutation } from "../auth/browser-session-mutation.decorator";
import { SESSION_COOKIE } from "../auth/session-token";
import { RequestOtpDto, VerifyOtpDto } from "./dto/otp.dto";
import { normalizeIranianPhone } from "./phone-number";
import { OtpService } from "./otp.service";

type HeaderResponse = { setHeader(name: string, value: string): void };

@Controller("auth/otp")
export class OtpController {
  constructor(private readonly otp: OtpService, private readonly rateLimits: AuthRateLimitService, private readonly config: ConfigService) {}

  @Post("request") @BrowserSessionMutation()
  async request(@Body() body: RequestOtpDto, @Ip() clientIp: string) {
    const phone = normalizeIranianPhone(body.phoneNumber);
    await this.rateLimits.consumeOtp(phone, clientIp);
    return this.otp.request(phone);
  }

  @Post("verify") @BrowserSessionMutation()
  async verify(@Body() body: VerifyOtpDto, @Ip() clientIp: string, @Res({ passthrough: true }) response: HeaderResponse) {
    const phone = normalizeIranianPhone(body.phoneNumber);
    await this.rateLimits.consumeOtp(phone, clientIp);
    const session = await this.otp.verify(body);
    response.setHeader("Set-Cookie", this.cookie(session.token));
    return { user: session.user };
  }

  private cookie(token: string) {
    const values = [`${SESSION_COOKIE}=${token}`, "Path=/", "HttpOnly", "SameSite=Lax", `Max-Age=${60 * 60 * 24 * 7}`];
    const domain = this.config.get<string>("AUTH_COOKIE_DOMAIN")?.trim();
    if (domain) values.push(`Domain=${domain}`);
    if (this.config.get<string>("NODE_ENV") === "production") values.push("Secure");
    return values.join("; ");
  }
}
