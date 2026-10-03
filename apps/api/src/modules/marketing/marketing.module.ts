import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { MarketingController } from "./marketing.controller";
import { MarketingService } from "./marketing.service";
import { SellerProductsGuard } from "../product/seller-products.guard";

@Module({ imports: [AuthModule], controllers: [MarketingController], providers: [MarketingService, SellerProductsGuard], exports: [MarketingService] })
export class MarketingModule {}
