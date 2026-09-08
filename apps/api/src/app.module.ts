import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AuthModule } from "./modules/auth/auth.module";
import { SellerModule } from "./modules/seller/seller.module";
import { ProductModule } from "./modules/product/product.module";
import { OrderModule } from "./modules/order/order.module";
import { PayoutModule } from "./modules/payout/payout.module";
import { RealtimeModule } from "./modules/realtime/realtime.module";
import { PaymentsModule } from "./integrations/payments/payment.module";
import { PrismaModule } from "./prisma/prisma.module";
import { BlogModule } from "./modules/blog/blog.module";
import { CouponModule } from "./modules/coupon/coupon.module";
import { StaffModule } from "./modules/staff/staff.module";
import { MediaModule } from "./modules/media/media.module";
import { BridgeModule } from "./modules/bridge/bridge.module";
import { SmsModule } from "./modules/sms/sms.module";
import { GoghdiModule } from "./modules/goghdi/goghdi.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env", ".env.local"]
    }),
    PrismaModule,
    AuthModule,
    StaffModule,
    MediaModule,
    SellerModule,
    ProductModule,
    BlogModule,
    CouponModule,
    BridgeModule,
    SmsModule,
    OrderModule,
    PayoutModule,
    RealtimeModule,
    GoghdiModule,
    PaymentsModule
  ]
})
export class AppModule {}
