import { Body, Controller, Get, Ip, Param, ParseUUIDPipe, Post, Req, UseGuards } from "@nestjs/common";
import { AuthenticatedGuard } from "../auth/authenticated.guard";
import { AuthRateLimitService } from "../auth/auth-rate-limit.service";
import { IdempotencyKey } from "../auth/idempotency-key.decorator";
import type { AuthenticatedRequest } from "../auth/platform-admin.guard";
import { RequestAuthenticationService } from "../auth/request-authentication.service";
import { CheckoutService } from "./checkout.service";
import { CheckoutShippingPlacesDto, CreateCheckoutDto, InitiateCheckoutPaymentDto, QuoteCheckoutDto } from "./dto/checkout.dto";

@Controller("checkouts")
export class CheckoutController {
  constructor(private readonly checkouts: CheckoutService, private readonly rateLimits: AuthRateLimitService, private readonly auth: RequestAuthenticationService) {}

  @Post("quote")
  async quote(@Body() body: QuoteCheckoutDto, @Ip() clientIp: string, @Req() request: AuthenticatedRequest) {
    await this.rateLimits.consumeCheckoutQuote(body.items.map((item) => item.offerId).sort().join(":"), clientIp);
    const buyer = body.clubPoints || body.clubRewardId ? await this.auth.authenticate(request) : null;
    return this.checkouts.quote(body, buyer?.id);
  }

  @Post("shipping-places")
  async shippingPlaces(@Body() body: CheckoutShippingPlacesDto, @Ip() clientIp: string) {
    const subject = body.items.map((item) => item.offerId).sort().join(":");
    await this.rateLimits.consumeCheckoutQuote(`shipping-places:${subject}:${body.provinceId ?? "provinces"}`, clientIp);
    return this.checkouts.shippingPlaces(body);
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
    @IdempotencyKey() idempotencyKey: string,
    @Body() body: InitiateCheckoutPaymentDto
  ) {
    await this.rateLimits.consumePaymentInitiation(request.authenticatedUser!.id, clientIp);
    return this.checkouts.initiate(request.authenticatedUser!, id, groupId, idempotencyKey, body.walletAmount ?? "0");
  }
}
