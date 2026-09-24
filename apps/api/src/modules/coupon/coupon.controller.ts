import { Body, Controller, Delete, Get, Ip, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { AuthRateLimitService } from "../auth/auth-rate-limit.service";
import { PlatformAdminGuard, type AuthenticatedRequest } from "../auth/platform-admin.guard";
import { CouponService } from "./coupon.service";
import { CreateAdminCouponDto, CreateCouponDto, ListAdminCouponsQueryDto, ListCouponsQueryDto, UpdateCouponDto } from "./dto/coupon.dto";
import { SellerCouponsGuard } from "./seller-coupons.guard";

@Controller("coupons")
export class CouponController {
  constructor(private readonly couponService: CouponService, private readonly rateLimits: AuthRateLimitService) {}

  @Get("mine")
  @UseGuards(SellerCouponsGuard)
  listMine(
    @Query() query: ListCouponsQueryDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.couponService.listMine(request.sellerContext!.sellerId, query);
  }

  @Post()
  @UseGuards(SellerCouponsGuard)
  async create(
    @Body() body: CreateCouponDto,
    @Req() request: AuthenticatedRequest,
    @Ip() clientIp: string
  ) {
    await this.rateLimits.consumeCouponMutation(request.authenticatedUser!.id, clientIp);
    return this.couponService.create(request.sellerContext!.sellerId, body);
  }

  @Get("admin")
  @UseGuards(PlatformAdminGuard)
  listAdmin(@Query() query: ListAdminCouponsQueryDto) {
    return this.couponService.listAdmin(query);
  }

  @Post("admin")
  @UseGuards(PlatformAdminGuard)
  async createAdmin(@Body() body: CreateAdminCouponDto, @Req() request: AuthenticatedRequest, @Ip() clientIp: string) {
    await this.rateLimits.consumeCouponMutation(request.authenticatedUser!.id, clientIp);
    return this.couponService.createAdmin(body);
  }

  @Patch("admin/:id")
  @UseGuards(PlatformAdminGuard)
  async updateAdmin(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() body: UpdateCouponDto,
    @Req() request: AuthenticatedRequest,
    @Ip() clientIp: string
  ) {
    await this.rateLimits.consumeCouponMutation(request.authenticatedUser!.id, clientIp);
    return this.couponService.updateAdmin(id, body);
  }

  @Delete("admin/:id")
  @UseGuards(PlatformAdminGuard)
  async deleteAdmin(@Param("id", new ParseUUIDPipe({ version: "4" })) id: string, @Req() request: AuthenticatedRequest, @Ip() clientIp: string) {
    await this.rateLimits.consumeCouponMutation(request.authenticatedUser!.id, clientIp);
    return this.couponService.deleteAdmin(id);
  }
}
