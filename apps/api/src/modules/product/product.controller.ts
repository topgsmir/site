import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards
} from "@nestjs/common";
import { PlatformAdminGuard, type AuthenticatedRequest } from "../auth/platform-admin.guard";
import { PlatformPermissionGuard } from "../auth/platform-permission.guard";
import { RequirePlatformPermission } from "../auth/platform-permission.decorator";
import {
  AddSellerOffersDto,
  CreateProductDto,
  ListProductsQueryDto,
  ReviewProductDto,
  UpdateSellerOfferDto
} from "./dto/product.dto";
import { ProductService } from "./product.service";
import { SellerProductsGuard } from "./seller-products.guard";

@Controller("products")
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Get()
  list(@Query() query: ListProductsQueryDto) {
    return this.productService.listPublic(query);
  }

  @Get("mine")
  @UseGuards(SellerProductsGuard)
  listMine(
    @Query() query: ListProductsQueryDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.productService.listSellerListings(
      request.sellerContext!.sellerId,
      query
    );
  }

  @Get("admin")
  @RequirePlatformPermission("catalog_view")
  @UseGuards(PlatformPermissionGuard)
  listForAdmin(@Query() query: ListProductsQueryDto) {
    return this.productService.listAdminProducts(query);
  }

  @Get("sitemap")
  sitemap() {
    return this.productService.sitemapProjection();
  }

  @Post()
  @UseGuards(SellerProductsGuard)
  create(
    @Body() body: CreateProductDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.productService.createProduct(
      request.sellerContext!.sellerId,
      body
    );
  }

  @Patch("admin/:productId/review")
  @UseGuards(PlatformAdminGuard)
  review(
    @Param("productId", new ParseUUIDPipe({ version: "4" })) productId: string,
    @Body() body: ReviewProductDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.productService.reviewProduct(
      productId,
      request.authenticatedUser!.id,
      body.status,
      body.reason
    );
  }

  @Post(":productId/offers")
  @UseGuards(SellerProductsGuard)
  addOffers(
    @Param("productId", new ParseUUIDPipe({ version: "4" })) productId: string,
    @Body() body: AddSellerOffersDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.productService.addSellerOffers(
      request.sellerContext!.sellerId,
      productId,
      body
    );
  }

  @Patch("offers/:offerId")
  @UseGuards(SellerProductsGuard)
  updateOffer(
    @Param("offerId", new ParseUUIDPipe({ version: "4" })) offerId: string,
    @Body() body: UpdateSellerOfferDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.productService.updateSellerOffer(
      request.sellerContext!.sellerId,
      offerId,
      body
    );
  }

  @Get(":idOrSlug")
  get(@Param("idOrSlug") idOrSlug: string) {
    return this.productService.getPublic(idOrSlug);
  }
}
