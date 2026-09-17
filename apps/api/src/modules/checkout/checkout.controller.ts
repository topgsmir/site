import { Body, Controller, Get, Ip, Param, ParseUUIDPipe, Post, Req, UseGuards } from "@nestjs/common";
import { AuthenticatedGuard } from "../auth/authenticated.guard";
import { AuthRateLimitService } from "../auth/auth-rate-limit.service";
import { IdempotencyKey } from "../auth/idempotency-key.decorator";
import type { AuthenticatedRequest } from "../auth/platform-admin.guard";
import { CheckoutService } from "./checkout.service";
import { CreateCheckoutDto, QuoteCheckoutDto } from "./dto/checkout.dto";

@Controller("checkouts")
export class CheckoutController {
  constructor(private readonly checkouts: CheckoutService, private readonly rateLimits: AuthRateLimitService) {}

  @Post("quote")
  async quote(@Body() body: QuoteCheckoutDto, @Ip() clientIp: string) {
    await this.rateLimits.consumeCheckoutQuote(body.items.map((item) => item.offerId).sort().join(":"), clientIp);
    return this.checkouts.quote(body);
  }

  @Post()
  @UseGuards(AuthenticatedGuard)
  async create(
    @Req() request: AuthenticatedRequest,
    @Ip() clientIp: string,
    @Body() body: CreateCheckoutDto,
    @IdempotencyKey() idempotencyKey: string
  ) {
    await this.rateLimits.consumeOrderMutation(request.authenticatedUser!.id, clientIp);
    return this.checkouts.create(request.authenticatedUser!, body, idempotencyKey);
  }

  @Get(":id")
  @UseGuards(AuthenticatedGuard)
  get(@Req() request: AuthenticatedRequest, @Param("id", new ParseUUIDPipe({ version: "4" })) id: string) {
    return this.checkouts.get(request.authenticatedUser!, id);
  }

  @Post(":id/payment-groups/:groupId/initiate")
  @UseGuards(AuthenticatedGuard)
  async initiate(
    @Req() request: AuthenticatedRequest,
    @Ip() clientIp: string,
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Param("groupId", new ParseUUIDPipe({ version: "4" })) groupId: string,
    @IdempotencyKey() idempotencyKey: string
  ) {
    await this.rateLimits.consumePaymentInitiation(request.authenticatedUser!.id, clientIp);
    return this.checkouts.initiate(request.authenticatedUser!, id, groupId, idempotencyKey);
  }
}
