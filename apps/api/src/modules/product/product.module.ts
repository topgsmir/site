import { ProductTranslationsService } from "./product-translations.service";
import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { MediaModule } from "../media/media.module";
import { ProductController } from "./product.controller";
import { ProductService } from "./product.service";
import { ProductBulkService } from "./product-bulk.service";
import { SellerProductsGuard } from "./seller-products.guard";

@Module({
  imports: [AuthModule, MediaModule],
  controllers: [ProductController],
  providers: [ProductTranslationsService, ProductService, ProductBulkService, SellerProductsGuard]
})
export class ProductModule {}
