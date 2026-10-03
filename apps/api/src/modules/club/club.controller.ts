import { Body, Controller, Get, Ip, Post, Query, Req, UseGuards } from "@nestjs/common";
import { AuthenticatedGuard } from "../auth/authenticated.guard";
import { AuthRateLimitService } from "../auth/auth-rate-limit.service";
import { IdempotencyKey } from "../auth/idempotency-key.decorator";
import type { AuthenticatedRequest } from "../auth/platform-admin.guard";
import { ClubService } from "./club.service";
import { ClubHistoryQueryDto, ClubWalletRedeemDto } from "./dto/club.dto";

@Controller("club")
@UseGuards(AuthenticatedGuard)
export class ClubController {
  constructor(private readonly club: ClubService, private readonly rateLimits: AuthRateLimitService) {}

  private member(request: AuthenticatedRequest) {
    return request.authenticatedUser!.id;
  }

  @Get("me") summary(@Req() request: AuthenticatedRequest) { return this.club.summary(this.member(request)); }
  @Get("me/history") history(@Req() request: AuthenticatedRequest, @Query() query: ClubHistoryQueryDto) { return this.club.history(this.member(request), query.cursor, query.limit); }
  @Get("rewards") rewards(@Req() request: AuthenticatedRequest) { this.member(request); return this.club.rewards(); }
  @Post("me/wallet-redemptions") async redeem(@Req() request: AuthenticatedRequest, @Ip() ip: string, @Body() body: ClubWalletRedeemDto, @IdempotencyKey() key: string) {
    await this.rateLimits.consumePaymentInitiation(this.member(request), ip);
    return this.club.redeemWallet(this.member(request), body.rewardId, key);
  }
}
