import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Req, Res, UseGuards } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AuthenticatedGuard } from "../../modules/auth/authenticated.guard";
import { IdempotencyKey } from "../../modules/auth/idempotency-key.decorator";
import type { AuthenticatedRequest } from "../../modules/auth/platform-admin.guard";
import { PlatformAdminGuard } from "../../modules/auth/platform-admin.guard";
import { InitiatePaymentDto, RefundPaymentDto } from "./dto/payment.dto";
import { PaymentApplicationService } from "./payment-application.service";

@Controller("payments")
export class PaymentController {
  constructor(private readonly application: PaymentApplicationService, private readonly config: ConfigService) {}

  @Post("zarinpal")
  @UseGuards(AuthenticatedGuard)
  initiate(@Req() request: AuthenticatedRequest, @Body() body: InitiatePaymentDto, @IdempotencyKey() idempotencyKey: string) {
    return this.application.initiate(request.authenticatedUser!, body.orderId, idempotencyKey);
  }

  @Get("zarinpal/callback")
  async callback(@Query("Authority") authority: string, @Query("Status") status: string | undefined, @Res({ passthrough: true }) response: { redirect?(url: string): void }) {
    const result = await this.application.callback(authority, status);
    const webUrl = this.config.get<string>("WEB_APP_URL")?.trim().replace(/\/$/, "");
    if (webUrl && /^https:\/\//i.test(webUrl) && response.redirect) {
      const locale = this.config.get<string>("DEFAULT_LOCALE")?.trim() || "fa";
      response.redirect(`${webUrl}/${["fa", "en", "ar"].includes(locale) ? locale : "fa"}/orders/${result.orderId}?payment=${result.status}`);
    }
    return result;
  }

  @Post("admin/:attemptId/refund")
  @UseGuards(PlatformAdminGuard)
  refund(@Param("attemptId", new ParseUUIDPipe({ version: "4" })) attemptId: string, @Body() body: RefundPaymentDto) {
    return this.application.refund(attemptId, body.reason);
  }
}
