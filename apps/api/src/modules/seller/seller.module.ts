import { Module } from "@nestjs/common";
import { SellerController } from "./seller.controller";
import { AuthModule } from "../auth/auth.module";
import { SellerService } from "./seller.service";
import { SellerProfileGuard } from "./seller-profile.guard";
import { MediaModule } from "../media/media.module";

@Module({
  imports: [AuthModule, MediaModule],
  controllers: [SellerController],
  providers: [SellerService, SellerProfileGuard],
  exports: []
})
export class SellerModule {}
