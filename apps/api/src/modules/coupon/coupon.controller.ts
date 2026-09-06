import { Body, Controller, Get, Post, Query, Req, UseGuards } from "@nestjs/common";
import type { AuthenticatedRequest } from "../auth/platform-admin.guard";
import { CouponService } from "./coupon.service";
import { CreateCouponDto, ListCouponsQueryDto } from "./dto/coupon.dto";
import { SellerCouponsGuard } from "./seller-coupons.guard";

@Controller("coupons")
@UseGuards(SellerCouponsGuard)
export class CouponController {
  constructor(private readonly couponService: CouponService) {}

  @Get("mine")
  listMine(
    @Query() query: ListCouponsQueryDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.couponService.listMine(request.sellerContext!.sellerId, query);
  }

  @Post()
  create(
    @Body() body: CreateCouponDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.couponService.create(request.sellerContext!.sellerId, body);
  }
}
