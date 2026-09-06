import { Module } from "@nestjs/common";
import { SellerController } from "./seller.controller";
import { AuthModule } from "../auth/auth.module";
import { SellerService } from "./seller.service";

@Module({
  imports: [AuthModule],
  controllers: [SellerController],
  providers: [SellerService],
  exports: []
})
export class SellerModule {}
