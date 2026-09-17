import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { MediaModule } from "../media/media.module";
import { ProductController } from "./product.controller";
import { ProductService } from "./product.service";
import { SellerProductsGuard } from "./seller-products.guard";

@Module({
  imports: [AuthModule, MediaModule],
  controllers: [ProductController],
  providers: [ProductService, SellerProductsGuard]
})
export class ProductModule {}
