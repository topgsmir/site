import { SeoModule } from "./modules/seo/seo.module";
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
import { AdminUsersModule } from "./modules/admin-users/admin-users.module";
import { AiModule } from "./integrations/ai/ai.module";
import { ContentAiModule } from "./modules/content-ai/content-ai.module";
import { DataAssistantModule } from "./modules/data-assistant/data-assistant.module";
import { CheckoutModule } from "./modules/checkout/checkout.module";
import { UsdRateModule } from "./modules/usd-rate/usd-rate.module";
import { AnalyticsModule } from "./modules/analytics/analytics.module";
import { CommentsModule } from "./modules/comments/comments.module";
import { CaptchaModule } from "./modules/captcha/captcha.module";
import { PlatformNoticeModule } from "./modules/platform-notice/platform-notice.module";
import { BackupModule } from "./modules/backup/backup.module";
import { HomepageStoriesModule } from "./modules/homepage-stories/homepage-stories.module";
import { HomepageModule } from "./modules/homepage/homepage.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env", ".env.local"]
    }),
    PrismaModule,
    AuthModule,
    AdminUsersModule,
    AiModule,
    ContentAiModule,
    DataAssistantModule,
    StaffModule,
    MediaModule,
    SellerModule,
    ProductModule,
    SeoModule,
    BlogModule,
    CouponModule,
    BridgeModule,
    SmsModule,
    OrderModule,
    CheckoutModule,
    UsdRateModule,
    AnalyticsModule,
    CommentsModule,
    CaptchaModule,
    PlatformNoticeModule,
    HomepageStoriesModule,
    HomepageModule,
    BackupModule,
    PayoutModule,
    RealtimeModule,
    GoghdiModule,
    PaymentsModule
  ]
})
export class AppModule {}
