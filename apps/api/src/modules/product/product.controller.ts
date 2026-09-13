import {
  Body,
  Controller,
  Get,
  Ip,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards
} from "@nestjs/common";
import { PlatformAdminGuard, type AuthenticatedRequest } from "../auth/platform-admin.guard";
import { AuthRateLimitService } from "../auth/auth-rate-limit.service";
import { PlatformPermissionGuard } from "../auth/platform-permission.guard";
import { RequirePlatformPermission } from "../auth/platform-permission.decorator";
import {
  AddSellerOffersDto,
  BulkUndoProductChangesDto,
  CreateProductDto,
  ListProductsQueryDto,
  PreviewBulkUndoProductChangesDto,
  ReviewProductDto,
  RestoreProductChangeDto,
  UpdateAdminListingDto,
  UpdateAdminProductDto,
  UpdateProductDto,
  UpdateSellerOfferDto
} from "./dto/product.dto";
import { ProductService } from "./product.service";
import { SellerProductsGuard } from "./seller-products.guard";

@Controller("products")
export class ProductController {
  constructor(
    private readonly productService: ProductService,
    private readonly rateLimits: AuthRateLimitService
  ) {}

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

  @Get("admin/changes")
  @UseGuards(PlatformAdminGuard)
  listChanges(@Query() query: ListProductsQueryDto) {
    return this.productService.listProductChanges(query);
  }

  @Post("admin/changes/bulk-undo/preview")
  @UseGuards(PlatformAdminGuard)
  previewBulkUndo(@Body() body: PreviewBulkUndoProductChangesDto) {
    return this.productService.previewBulkUndo(body);
  }

  @Post("admin/changes/bulk-undo")
  @UseGuards(PlatformAdminGuard)
  async bulkUndo(
    @Body() body: BulkUndoProductChangesDto,
    @Req() request: AuthenticatedRequest,
    @Ip() clientIp: string
  ) {
    await this.rateLimits.consumeProductBulkUndo(
      request.authenticatedUser!.id,
      clientIp
    );
    return this.productService.bulkUndo(
      body,
      request.authenticatedUser!.id
    );
  }

  @Get("admin/:productId/changes")
  @UseGuards(PlatformAdminGuard)
  listChangesForProduct(
    @Param("productId", new ParseUUIDPipe({ version: "4" })) productId: string,
    @Query() query: ListProductsQueryDto
  ) {
    return this.productService.listProductChanges(query, productId);
  }

  @Post("admin/:productId/restore")
  @UseGuards(PlatformAdminGuard)
  restoreProduct(
    @Param("productId", new ParseUUIDPipe({ version: "4" })) productId: string,
    @Body() body: RestoreProductChangeDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.productService.restoreProductChange(
      productId,
      body.changeId,
      request.authenticatedUser!.id,
      body.side
    );
  }

  @Get("admin/:productId")
  @UseGuards(PlatformAdminGuard)
  getForAdmin(
    @Param("productId", new ParseUUIDPipe({ version: "4" })) productId: string,
    @Query() query: ListProductsQueryDto
  ) {
    return this.productService.getAdminProduct(productId, query);
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
      request.sellerContext!.user.id,
      body
    );
  }

  @Patch("admin/:productId")
  @UseGuards(PlatformAdminGuard)
  updateForAdmin(
    @Param("productId", new ParseUUIDPipe({ version: "4" })) productId: string,
    @Body() body: UpdateAdminProductDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.productService.updateAdminProduct(
      productId,
      request.authenticatedUser!.id,
      body
    );
  }

  @Patch("admin/listings/:listingId")
  @UseGuards(PlatformAdminGuard)
  updateListingForAdmin(
    @Param("listingId", new ParseUUIDPipe({ version: "4" })) listingId: string,
    @Body() body: UpdateAdminListingDto
  ) {
    return this.productService.updateAdminListing(listingId, body.status);
  }

  @Patch("admin/offers/:offerId")
  @UseGuards(PlatformAdminGuard)
  updateOfferForAdmin(
    @Param("offerId", new ParseUUIDPipe({ version: "4" })) offerId: string,
    @Body() body: UpdateSellerOfferDto
  ) {
    return this.productService.updateAdminOffer(offerId, body);
  }

  @Patch(":productId")
  @UseGuards(SellerProductsGuard)
  update(
    @Param("productId", new ParseUUIDPipe({ version: "4" })) productId: string,
    @Body() body: UpdateProductDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.productService.updateProduct(
      request.sellerContext!.sellerId,
      productId,
      request.sellerContext!.user.id,
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
