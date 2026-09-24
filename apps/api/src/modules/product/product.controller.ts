import { ProductTranslationsService } from "./product-translations.service";
import { ProductCategoriesQueryDto, UpdateProductCategoryDto } from "./dto/product-category.dto";
import { BrowserSessionMutation } from "../auth/browser-session-mutation.decorator";
import { ParseConstrainedStringPipe, ROUTE_SLUG_PATTERN } from "../../common/http/parse-constrained-string.pipe";
import { ProductLocaleQueryDto, ProductTranslationParamsDto, ProductTranslationDraftDto } from "./dto/product-seo.dto";
import {
  Body,
  Controller,
  Delete,
  Get,
  Ip,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { PlatformAdminGuard, type AuthenticatedRequest } from "../auth/platform-admin.guard";
import { AuthRateLimitService } from "../auth/auth-rate-limit.service";
import { PlatformPermissionGuard } from "../auth/platform-permission.guard";
import { RequirePlatformPermission } from "../auth/platform-permission.decorator";
import {
  AddSellerOffersDto,
  BulkUndoProductChangesDto,
  CreateProductDto,
  ListProductsQueryDto,
  ManageProductsQueryDto,
  SellerProductsQueryDto,
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
import { MediaService } from "../media/media.service";

@Controller("products")
export class ProductController {
  constructor(
    private readonly productService: ProductService,
    private readonly rateLimits: AuthRateLimitService,
    private readonly translations: ProductTranslationsService,
    private readonly media: MediaService
  ) {}

  @Get()
  list(@Query() query: ListProductsQueryDto) {
    return this.productService.listPublic(query);
  }

  @Get("page")
  page(@Query() query: ListProductsQueryDto) {
    return this.productService.listPublicPage(query);
  }

  @Get("categories")
  listCategories(@Query() query: ProductCategoriesQueryDto) {
    return this.productService.listCategories(query);
  }

  @Patch("admin/categories/:categoryId")
  @BrowserSessionMutation()
  @UseGuards(PlatformAdminGuard)
  async updateCategory(
    @Param("categoryId", new ParseUUIDPipe({ version: "4" })) categoryId: string,
    @Body() body: UpdateProductCategoryDto,
    @Req() request: AuthenticatedRequest,
    @Ip() clientIp: string
  ) {
    await this.rateLimits.consumeProductMutation(request.authenticatedUser!.id, clientIp);
    return this.productService.updateCategory(categoryId, request.authenticatedUser!.id, body);
  }

  @Get("admin/:productId/translations")
  @UseGuards(PlatformAdminGuard)
  listTranslations(@Param("productId", new ParseUUIDPipe({ version: "4" })) productId: string) {
    return this.translations.list(productId);
  }

  @Patch("admin/:productId/translations/:locale")
  @UseGuards(PlatformAdminGuard)
  async saveTranslation(@Param() params: ProductTranslationParamsDto, @Body() body: ProductTranslationDraftDto, @Req() request: AuthenticatedRequest, @Ip() clientIp: string) {
    await this.rateLimits.consumeProductMutation(request.authenticatedUser!.id, clientIp);
    return this.translations.change(params.productId, params.locale, request.authenticatedUser!.id, "draft", body);
  }

  @Post("admin/:productId/translations/:locale/publish")
  @UseGuards(PlatformAdminGuard)
  async publishTranslation(@Param() params: ProductTranslationParamsDto, @Req() request: AuthenticatedRequest, @Ip() clientIp: string) {
    await this.rateLimits.consumeProductMutation(request.authenticatedUser!.id, clientIp);
    return this.translations.change(params.productId, params.locale, request.authenticatedUser!.id, "publish");
  }

  @Post("admin/:productId/translations/:locale/unpublish")
  @UseGuards(PlatformAdminGuard)
  async unpublishTranslation(@Param() params: ProductTranslationParamsDto, @Req() request: AuthenticatedRequest, @Ip() clientIp: string) {
    await this.rateLimits.consumeProductMutation(request.authenticatedUser!.id, clientIp);
    return this.translations.change(params.productId, params.locale, request.authenticatedUser!.id, "unpublish");
  }

  @Get("mine")
  @UseGuards(SellerProductsGuard)
  listMine(
    @Query() query: SellerProductsQueryDto,
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
  listForAdmin(@Query() query: ManageProductsQueryDto) {
    return this.productService.listAdminProducts(query);
  }

  @Get("admin/changes")
  @UseGuards(PlatformAdminGuard)
  listChanges(@Query() query: ListProductsQueryDto) {
    return this.productService.listProductChanges(query);
  }

  @Post("admin/changes/bulk-undo/preview")
  @UseGuards(PlatformAdminGuard)
  async previewBulkUndo(@Body() body: PreviewBulkUndoProductChangesDto, @Req() request: AuthenticatedRequest, @Ip() clientIp: string) {
    await this.rateLimits.consumeProductBulkUndo(request.authenticatedUser!.id, clientIp);
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
  async restoreProduct(
    @Param("productId", new ParseUUIDPipe({ version: "4" })) productId: string,
    @Body() body: RestoreProductChangeDto,
    @Req() request: AuthenticatedRequest,
    @Ip() clientIp: string
  ) {
    await this.rateLimits.consumeProductMutation(request.authenticatedUser!.id, clientIp);
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
  async create(
    @Body() body: CreateProductDto,
    @Req() request: AuthenticatedRequest,
    @Ip() clientIp: string
  ) {
    await this.rateLimits.consumeProductMutation(request.authenticatedUser!.id, clientIp);
    return this.productService.createProduct(
      request.sellerContext!.sellerId,
      request.sellerContext!.user.id,
      body
    );
  }

  @Patch("admin/:productId")
  @UseGuards(PlatformAdminGuard)
  async updateForAdmin(
    @Param("productId", new ParseUUIDPipe({ version: "4" })) productId: string,
    @Body() body: UpdateAdminProductDto,
    @Req() request: AuthenticatedRequest,
    @Ip() clientIp: string
  ) {
    await this.rateLimits.consumeProductMutation(request.authenticatedUser!.id, clientIp);
    return this.productService.updateAdminProduct(
      productId,
      request.authenticatedUser!.id,
      body
    );
  }

  @Post("admin/:productId/image")
  @UseGuards(PlatformAdminGuard)
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 8 * 1024 * 1024, files: 1, fields: 0, parts: 1 } }))
  async uploadImageForAdmin(
    @Param("productId", new ParseUUIDPipe({ version: "4" })) productId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Ip() clientIp: string,
    @Req() request: AuthenticatedRequest
  ) {
    await this.rateLimits.consumeMediaUpload(request.authenticatedUser!.id, clientIp);
    return this.media.uploadProductImage(productId, request.authenticatedUser!.id, null, file);
  }

  @Delete("admin/:productId/image")
  @UseGuards(PlatformAdminGuard)
  async deleteImageForAdmin(
    @Param("productId", new ParseUUIDPipe({ version: "4" })) productId: string,
    @Req() request: AuthenticatedRequest,
    @Ip() clientIp: string
  ) {
    await this.rateLimits.consumeMediaUpload(request.authenticatedUser!.id, clientIp);
    return this.media.deleteProductImage(productId, null, request.authenticatedUser!.id);
  }

  @Post(":productId/image")
  @UseGuards(SellerProductsGuard)
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 8 * 1024 * 1024, files: 1, fields: 0, parts: 1 } }))
  async uploadImage(
    @Param("productId", new ParseUUIDPipe({ version: "4" })) productId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Ip() clientIp: string,
    @Req() request: AuthenticatedRequest
  ) {
    await this.rateLimits.consumeMediaUpload(request.authenticatedUser!.id, clientIp);
    return this.media.uploadProductImage(
      productId,
      request.authenticatedUser!.id,
      request.sellerContext!.sellerId,
      file
    );
  }

  @Delete(":productId/image")
  @UseGuards(SellerProductsGuard)
  async deleteImage(
    @Param("productId", new ParseUUIDPipe({ version: "4" })) productId: string,
    @Req() request: AuthenticatedRequest,
    @Ip() clientIp: string
  ) {
    await this.rateLimits.consumeMediaUpload(request.authenticatedUser!.id, clientIp);
    return this.media.deleteProductImage(productId, request.sellerContext!.sellerId, request.authenticatedUser!.id);
  }

  @Patch("admin/listings/:listingId")
  @UseGuards(PlatformAdminGuard)
  async updateListingForAdmin(
    @Param("listingId", new ParseUUIDPipe({ version: "4" })) listingId: string,
    @Body() body: UpdateAdminListingDto,
    @Req() request: AuthenticatedRequest,
    @Ip() clientIp: string
  ) {
    await this.rateLimits.consumeProductMutation(request.authenticatedUser!.id, clientIp);
    return this.productService.updateAdminListing(listingId, body.status);
  }

  @Patch("admin/offers/:offerId")
  @UseGuards(PlatformAdminGuard)
  async updateOfferForAdmin(
    @Param("offerId", new ParseUUIDPipe({ version: "4" })) offerId: string,
    @Body() body: UpdateSellerOfferDto,
    @Req() request: AuthenticatedRequest,
    @Ip() clientIp: string
  ) {
    await this.rateLimits.consumeProductMutation(request.authenticatedUser!.id, clientIp);
    return this.productService.updateAdminOffer(offerId, body);
  }

  @Patch(":productId")
  @UseGuards(SellerProductsGuard)
  async update(
    @Param("productId", new ParseUUIDPipe({ version: "4" })) productId: string,
    @Body() body: UpdateProductDto,
    @Req() request: AuthenticatedRequest,
    @Ip() clientIp: string
  ) {
    await this.rateLimits.consumeProductMutation(request.authenticatedUser!.id, clientIp);
    return this.productService.updateProduct(
      request.sellerContext!.sellerId,
      productId,
      request.sellerContext!.user.id,
      body
    );
  }

  @Patch("admin/:productId/review")
  @UseGuards(PlatformAdminGuard)
  async review(
    @Param("productId", new ParseUUIDPipe({ version: "4" })) productId: string,
    @Body() body: ReviewProductDto,
    @Req() request: AuthenticatedRequest,
    @Ip() clientIp: string
  ) {
    await this.rateLimits.consumeProductMutation(request.authenticatedUser!.id, clientIp);
    return this.productService.reviewProduct(
      productId,
      request.authenticatedUser!.id,
      body.status,
      body.reason
    );
  }

  @Post(":productId/offers")
  @UseGuards(SellerProductsGuard)
  async addOffers(
    @Param("productId", new ParseUUIDPipe({ version: "4" })) productId: string,
    @Body() body: AddSellerOffersDto,
    @Req() request: AuthenticatedRequest,
    @Ip() clientIp: string
  ) {
    await this.rateLimits.consumeProductMutation(request.authenticatedUser!.id, clientIp);
    return this.productService.addSellerOffers(
      request.sellerContext!.sellerId,
      productId,
      body
    );
  }

  @Patch("offers/:offerId")
  @UseGuards(SellerProductsGuard)
  async updateOffer(
    @Param("offerId", new ParseUUIDPipe({ version: "4" })) offerId: string,
    @Body() body: UpdateSellerOfferDto,
    @Req() request: AuthenticatedRequest,
    @Ip() clientIp: string
  ) {
    await this.rateLimits.consumeProductMutation(request.authenticatedUser!.id, clientIp);
    return this.productService.updateSellerOffer(
      request.sellerContext!.sellerId,
      offerId,
      body
    );
  }

  @Get(":idOrSlug")
  get(@Param("idOrSlug", new ParseConstrainedStringPipe({ label: "Product identifier", maxLength: 200, pattern: ROUTE_SLUG_PATTERN })) idOrSlug: string, @Query() query: ProductLocaleQueryDto) {
    return this.productService.getPublic(idOrSlug, query.locale);
  }
}
