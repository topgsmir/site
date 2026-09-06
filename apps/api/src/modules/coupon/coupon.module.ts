import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { CouponController } from "./coupon.controller";
import { CouponService } from "./coupon.service";
import { SellerCouponsGuard } from "./seller-coupons.guard";

@Module({
  imports: [AuthModule],
  controllers: [CouponController],
  providers: [CouponService, SellerCouponsGuard]
})
export class CouponModule {}
