import { Body, Controller, Ip, Post } from "@nestjs/common";
import { AuthRateLimitService } from "../auth/auth-rate-limit.service";
import { CaptchaService } from "./captcha.service";
import { CreateCaptchaChallengeDto } from "./dto/captcha.dto";

@Controller("captcha")
export class CaptchaController {
  constructor(
    private readonly captcha: CaptchaService,
    private readonly rateLimits: AuthRateLimitService
  ) {}

  @Post("challenge")
  async create(@Body() body: CreateCaptchaChallengeDto, @Ip() clientIp: string) {
    await this.rateLimits.consumeCaptchaChallenge(clientIp);
    return this.captcha.createChallenge(body.action);
  }
}
