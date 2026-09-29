import { Body, Controller, ForbiddenException, Get, Ip, Param, ParseUUIDPipe, Post, Query, Req, UseGuards } from "@nestjs/common";
import { AuthenticatedGuard } from "../auth/authenticated.guard";
import { AuthRateLimitService } from "../auth/auth-rate-limit.service";
import { IdempotencyKey } from "../auth/idempotency-key.decorator";
import { PlatformAdminGuard, type AuthenticatedRequest } from "../auth/platform-admin.guard";
import { WalletAdjustmentDto, WalletHistoryQueryDto, WalletRefundDto, WalletTopupDto } from "./dto/wallet.dto";
import { WalletLedgerService } from "./wallet-ledger.service";
import { WalletService } from "./wallet.service";

@Controller("wallet")
export class WalletController {
  constructor(private readonly ledger: WalletLedgerService, private readonly wallet: WalletService, private readonly rateLimits: AuthRateLimitService) {}

  @Get()
  @UseGuards(AuthenticatedGuard)
  balance(@Req() request: AuthenticatedRequest) {
    if (request.authenticatedUser!.role !== "buyer") throw new ForbiddenException("Only buyers have wallets");
    return this.ledger.balance(request.authenticatedUser!.id);
  }

  @Get("transactions")
  @UseGuards(AuthenticatedGuard)
  transactions(@Req() request: AuthenticatedRequest, @Query() query: WalletHistoryQueryDto) {
    if (request.authenticatedUser!.role !== "buyer") throw new ForbiddenException("Only buyers have wallets");
    return this.ledger.history(request.authenticatedUser!.id, query.cursor, query.limit);
  }

  @Get("topup-methods")
  @UseGuards(AuthenticatedGuard)
  topupMethods(@Req() request: AuthenticatedRequest) {
    if (request.authenticatedUser!.role !== "buyer") throw new ForbiddenException("Only buyers can fund wallets");
    return this.wallet.topupMethods();
  }

  @Post("topups")
  @UseGuards(AuthenticatedGuard)
  async topup(@Req() request: AuthenticatedRequest, @Ip() ip: string, @Body() body: WalletTopupDto, @IdempotencyKey() key: string) {
    await this.rateLimits.consumePaymentInitiation(request.authenticatedUser!.id, ip);
    return this.wallet.topup(request.authenticatedUser!, body, key);
  }

  @Get("topups/:id")
  @UseGuards(AuthenticatedGuard)
  topupStatus(@Req() request: AuthenticatedRequest, @Param("id", new ParseUUIDPipe({ version: "4" })) id: string) {
    return this.wallet.topupStatus(request.authenticatedUser!, id);
  }

  @Get("admin/users/:userId")
  @UseGuards(PlatformAdminGuard)
  adminBalance(@Param("userId", new ParseUUIDPipe({ version: "4" })) userId: string) {
    return this.ledger.balance(userId);
  }

  @Get("admin/users/:userId/transactions")
  @UseGuards(PlatformAdminGuard)
  adminTransactions(@Param("userId", new ParseUUIDPipe({ version: "4" })) userId: string, @Query() query: WalletHistoryQueryDto) {
    return this.ledger.history(userId, query.cursor, query.limit);
  }

  @Post("admin/users/:userId/adjustments")
  @UseGuards(PlatformAdminGuard)
  async adjust(@Req() request: AuthenticatedRequest, @Ip() ip: string, @Param("userId", new ParseUUIDPipe({ version: "4" })) userId: string, @Body() body: WalletAdjustmentDto, @IdempotencyKey() key: string) {
    await this.rateLimits.consumePaymentRefund(request.authenticatedUser!.id, ip);
    return this.wallet.adjust(request.authenticatedUser!, userId, body, key);
  }

  @Post("admin/users/:userId/orders/:orderId/refund")
  @UseGuards(PlatformAdminGuard)
  async refund(@Req() request: AuthenticatedRequest, @Ip() ip: string, @Param("userId", new ParseUUIDPipe({ version: "4" })) userId: string, @Param("orderId", new ParseUUIDPipe({ version: "4" })) orderId: string, @Body() body: WalletRefundDto, @IdempotencyKey() key: string) {
    await this.rateLimits.consumePaymentRefund(request.authenticatedUser!.id, ip);
    return this.wallet.refundOrder(request.authenticatedUser!, userId, orderId, body.reason, key);
  }
}
