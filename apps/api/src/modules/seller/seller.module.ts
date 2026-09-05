import { Module } from "@nestjs/common";
import { SellerController } from "./seller.controller";

@Module({
  controllers: [SellerController],
  providers: [],
  exports: []
})
export class SellerModule {}

