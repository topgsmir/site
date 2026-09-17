import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { PlatformAdminGuard, type AuthenticatedRequest } from "../auth/platform-admin.guard";
import { CouponService } from "./coupon.service";
import { CreateAdminCouponDto, CreateCouponDto, ListAdminCouponsQueryDto, ListCouponsQueryDto, UpdateCouponDto } from "./dto/coupon.dto";
import { SellerCouponsGuard } from "./seller-coupons.guard";

@Controller("coupons")
export class CouponController {
  constructor(private readonly couponService: CouponService) {}

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
  create(
    @Body() body: CreateCouponDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.couponService.create(request.sellerContext!.sellerId, body);
  }

  @Get("admin")
  @UseGuards(PlatformAdminGuard)
  listAdmin(@Query() query: ListAdminCouponsQueryDto) {
    return this.couponService.listAdmin(query);
  }

  @Post("admin")
  @UseGuards(PlatformAdminGuard)
  createAdmin(@Body() body: CreateAdminCouponDto) {
    return this.couponService.createAdmin(body);
  }

  @Patch("admin/:id")
  @UseGuards(PlatformAdminGuard)
  updateAdmin(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() body: UpdateCouponDto
  ) {
    return this.couponService.updateAdmin(id, body);
  }

  @Delete("admin/:id")
  @UseGuards(PlatformAdminGuard)
  deleteAdmin(@Param("id", new ParseUUIDPipe({ version: "4" })) id: string) {
    return this.couponService.deleteAdmin(id);
  }
}
