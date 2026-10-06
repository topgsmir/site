import { ProductTranslationsService } from "./product-translations.service";
import { ProductDescriptionTemplatesService } from "./product-description-templates.service";
import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { MediaModule } from "../media/media.module";
import { ProductController } from "./product.controller";
import { ProductService } from "./product.service";
import { ProductBulkService } from "./product-bulk.service";
import { SellerProductsGuard } from "./seller-products.guard";
import { ProductDownloadLinksService } from "./product-download-links.service";

@Module({
  imports: [AuthModule, MediaModule],
  controllers: [ProductController],
  providers: [ProductTranslationsService, ProductDescriptionTemplatesService, ProductService, ProductBulkService, ProductDownloadLinksService, SellerProductsGuard]
})
export class ProductModule {}
