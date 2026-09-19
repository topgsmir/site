import { Body, Controller, Get, Ip, Param, ParseUUIDPipe, Patch, Post, Query, Req, Res, UseGuards } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AuthenticatedGuard } from "../../modules/auth/authenticated.guard";
import { AuthRateLimitService } from "../../modules/auth/auth-rate-limit.service";
import { IdempotencyKey } from "../../modules/auth/idempotency-key.decorator";
import type { AuthenticatedRequest } from "../../modules/auth/platform-admin.guard";
import { PlatformAdminGuard } from "../../modules/auth/platform-admin.guard";
import {
  CompleteLocalPaymentDto,
  InitiatePaymentDto,
  ListAdminPaymentTransactionsQueryDto,
  ListPaymentSellerOptionsQueryDto,
  PaymentCallbackQueryDto,
  PaymentProviderParamDto,
  RefundPaymentDto,
  UpdatePaymentMethodDto
} from "./dto/payment.dto";
import { PaymentApplicationService } from "./payment-application.service";

@Controller("payments")
export class PaymentController {
  constructor(
    private readonly application: PaymentApplicationService,
    private readonly config: ConfigService,
    private readonly rateLimits: AuthRateLimitService
  ) {}

  @Get("local/:authority")
  @UseGuards(AuthenticatedGuard)
  localPayment(@Req() request: AuthenticatedRequest, @Param("authority") authority: string) {
    return this.application.localPayment(request.authenticatedUser!, authority);
  }

  @Post("local/:authority/complete")
  @UseGuards(AuthenticatedGuard)
  async completeLocalPayment(
    @Req() request: AuthenticatedRequest,
    @Ip() clientIp: string,
    @Param("authority") authority: string,
    @Body() body: CompleteLocalPaymentDto
  ) {
    await this.rateLimits.consumePaymentCallback(authority, clientIp);
    return this.application.completeLocalPayment(request.authenticatedUser!, authority, body.status);
  }

  @Post(":providerCode")
  @UseGuards(AuthenticatedGuard)
  async initiate(
    @Req() request: AuthenticatedRequest,
    @Ip() clientIp: string,
    @Param() params: PaymentProviderParamDto,
    @Body() body: InitiatePaymentDto,
    @IdempotencyKey() idempotencyKey: string
  ) {
    await this.rateLimits.consumePaymentInitiation(request.authenticatedUser!.id, clientIp);
    return this.application.initiate(request.authenticatedUser!, body.orderId, idempotencyKey, params.providerCode);
  }

  @Get("zarinpal/callback")
  async callback(@Query() query: PaymentCallbackQueryDto, @Ip() clientIp: string, @Res({ passthrough: true }) response: { redirect?(url: string): void }) {
    await this.rateLimits.consumePaymentCallback(query.Authority, clientIp);
    const result = await this.application.callback("zarinpal", query.Authority, query.Status);
    const webUrl = this.config.get<string>("WEB_APP_URL")?.trim().replace(/\/$/, "");
    if (webUrl && /^https:\/\//i.test(webUrl) && response.redirect) {
      const locale = this.config.get<string>("DEFAULT_LOCALE")?.trim() || "fa";
      const safeLocale = ["fa", "en", "ar"].includes(locale) ? locale : "fa";
      const destination = "checkoutId" in result && result.checkoutId
        ? `${webUrl}/${safeLocale}/checkout/${result.checkoutId}?payment=${result.status}`
        : `${webUrl}/${safeLocale}/orders/${"orderId" in result ? result.orderId : ""}?payment=${result.status}`;
      response.redirect(destination);
    }
    return result;
  }

  @Get("admin/methods")
  @UseGuards(PlatformAdminGuard)
  methods() {
    return this.application.listMethods();
  }

  @Patch("admin/methods/:providerCode")
  @UseGuards(PlatformAdminGuard)
  async updateMethod(
    @Req() request: AuthenticatedRequest,
    @Ip() clientIp: string,
    @Param() params: PaymentProviderParamDto,
    @Body() body: UpdatePaymentMethodDto
  ) {
    await this.rateLimits.consumePaymentConfiguration(request.authenticatedUser!.id, clientIp);
    return this.application.updateMethod(params.providerCode, {
      enabled: body.enabled,
      productTypes: body.productTypes,
      sellerIds: body.sellerIds,
      credentials: {
        merchantId: body.merchantId,
        callbackUrl: body.callbackUrl,
        refundAccessToken: body.refundAccessToken,
        clearRefundAccessToken: body.clearRefundAccessToken
      }
    }, request.authenticatedUser!.id);
  }

  @Get("admin/seller-options")
  @UseGuards(PlatformAdminGuard)
  sellerOptions(@Query() query: ListPaymentSellerOptionsQueryDto) {
    return this.application.listSellerOptions(query.query, query.limit);
  }

  @Get("admin/transactions")
  @UseGuards(PlatformAdminGuard)
  transactions(@Query() query: ListAdminPaymentTransactionsQueryDto) {
    return this.application.listTransactions(query);
  }

  @Post("admin/:attemptId/refund")
  @UseGuards(PlatformAdminGuard)
  async refund(
    @Req() request: AuthenticatedRequest,
    @Ip() clientIp: string,
    @Param("attemptId", new ParseUUIDPipe({ version: "4" })) attemptId: string,
    @Body() body: RefundPaymentDto,
    @IdempotencyKey() idempotencyKey: string
  ) {
    await this.rateLimits.consumePaymentRefund(request.authenticatedUser!.id, clientIp);
    return this.application.refund(request.authenticatedUser!, attemptId, body.reason, idempotencyKey);
  }
}
