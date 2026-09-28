import { Controller, Get, Header, Ip, Param, Query, Req, UseGuards } from "@nestjs/common";
import { AuthenticatedGuard } from "../auth/authenticated.guard";
import { AuthRateLimitService } from "../auth/auth-rate-limit.service";
import type { AuthenticatedRequest } from "../auth/platform-admin.guard";
import { SellerCustomerDetailQueryDto, SellerCustomerIdDto, SellerCustomerSearchDto } from "./dto/seller-customers.dto";
import { SellerCustomersService } from "./seller-customers.service";

@Controller("seller/customers")
@UseGuards(AuthenticatedGuard)
export class SellerCustomersController {
  constructor(private readonly customers: SellerCustomersService, private readonly rateLimits: AuthRateLimitService) {}

  @Get()
  @Header("Cache-Control", "private, no-store")
  async search(@Req() request: AuthenticatedRequest, @Ip() clientIp: string, @Query() query: SellerCustomerSearchDto) {
    await this.rateLimits.consumeAnalyticsRead(request.authenticatedUser!.id, clientIp);
    return this.customers.search(request.authenticatedUser!, query);
  }

  @Get(":id")
  @Header("Cache-Control", "private, no-store")
  async detail(@Req() request: AuthenticatedRequest, @Ip() clientIp: string, @Param() params: SellerCustomerIdDto, @Query() query: SellerCustomerDetailQueryDto) {
    await this.rateLimits.consumeAnalyticsRead(request.authenticatedUser!.id, clientIp);
    return this.customers.detail(request.authenticatedUser!, params.id, query);
  }
}
