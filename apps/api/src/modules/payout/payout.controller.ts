import {
  Body,
  Controller,
  Get,
  Ip,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards
} from "@nestjs/common";
import { AuthenticatedGuard } from "../auth/authenticated.guard";
import { AuthRateLimitService } from "../auth/auth-rate-limit.service";
import { IdempotencyKey } from "../auth/idempotency-key.decorator";
import type { AuthenticatedRequest } from "../auth/platform-admin.guard";
import {
  ListPayoutsQueryDto,
  RequestPayoutDto,
  SetPayoutStatusDto
} from "./dto/payout.dto";
import { PayoutService } from "./payout.service";

@Controller("payouts")
@UseGuards(AuthenticatedGuard)
export class PayoutController {
  constructor(
    private readonly payouts: PayoutService,
    private readonly rateLimits: AuthRateLimitService
  ) {}

  @Get()
  list(@Req() request: AuthenticatedRequest, @Query() query: ListPayoutsQueryDto) {
    return this.payouts.list(request.authenticatedUser!, query);
  }

  @Get(":id")
  get(
    @Req() request: AuthenticatedRequest,
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string
  ) {
    return this.payouts.get(request.authenticatedUser!, id);
  }

  @Post("requests")
  async requestPayout(
    @Req() request: AuthenticatedRequest,
    @Ip() clientIp: string,
    @Body() body: RequestPayoutDto,
    @IdempotencyKey() idempotencyKey: string
  ) {
    await this.rateLimits.consumePayoutMutation(
      request.authenticatedUser!.id,
      clientIp
    );
    return this.payouts.request(
      request.authenticatedUser!,
      body.orderId,
      idempotencyKey
    );
  }

  @Patch("requests/:id")
  async setStatus(
    @Req() request: AuthenticatedRequest,
    @Ip() clientIp: string,
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() body: SetPayoutStatusDto,
    @IdempotencyKey() idempotencyKey: string
  ) {
    await this.rateLimits.consumePayoutMutation(
      request.authenticatedUser!.id,
      clientIp
    );
    return this.payouts.setStatus(
      request.authenticatedUser!,
      id,
      body,
      idempotencyKey
    );
  }
}
