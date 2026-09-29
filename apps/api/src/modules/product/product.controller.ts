import { ProductTranslationsService } from "./product-translations.service";
import { CreateProductCategoryDto, DeleteProductCategoryDto, ProductCategoriesQueryDto, UpdateProductCategoryDto } from "./dto/product-category.dto";
import { BrowserSessionMutation } from "../auth/browser-session-mutation.decorator";
import { ParseConstrainedStringPipe, ROUTE_SLUG_PATTERN } from "../../common/http/parse-constrained-string.pipe";
import { ProductLocaleQueryDto, ProductTranslationParamsDto, ProductTranslationDraftDto } from "./dto/product-seo.dto";
import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Ip,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
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
  ApplyProductBulkEditDto,
  BulkUndoProductChangesDto,
  CreateProductDto,
  ListProductsQueryDto,
  ManageProductsQueryDto,
  SellerProductsQueryDto,
  PreviewBulkUndoProductChangesDto,
  PreviewProductBulkEditDto,
  ProductSlugAvailabilityQueryDto,
  ReviewProductDto,
  RestoreProductChangeDto,
  UpdateAdminListingDto,
  UpdateAdminProductDto,
  TransferProductSellerDto,
  UpdateProductDto,
  UpdateSellerOfferDto
} from "./dto/product.dto";
import { ProductService } from "./product.service";
import { ProductBulkService } from "./product-bulk.service";
import { SellerProductsGuard } from "./seller-products.guard";
import { MediaService } from "../media/media.service";
import { AdminUploadsService } from "../media/admin-uploads.service";

@Controller("products")
export class ProductController {
  constructor(
    private readonly productService: ProductService,
    private readonly bulkProducts: ProductBulkService,
    private readonly rateLimits: AuthRateLimitService,
    private readonly translations: ProductTranslationsService,
    private readonly media: MediaService,
    private readonly uploads: AdminUploadsService
  ) {}

  @Post("admin/bulk-edit/preview")
  @BrowserSessionMutation()
  @UseGuards(PlatformAdminGuard)
  async previewBulkEdit(@Body() body: PreviewProductBulkEditDto, @Req() request: AuthenticatedRequest, @Ip() clientIp: string) {
    await this.rateLimits.consumeProductMutation(request.authenticatedUser!.id, clientIp);
    return this.bulkProducts.preview(body);
  }

  @Post("admin/bulk-edit")
  @BrowserSessionMutation()
  @UseGuards(PlatformAdminGuard)
  async applyBulkEdit(@Body() body: ApplyProductBulkEditDto, @Req() request: AuthenticatedRequest, @Ip() clientIp: string) {
    await this.rateLimits.consumeProductMutation(request.authenticatedUser!.id, clientIp);
    return this.bulkProducts.apply(body, request.authenticatedUser!.id);
  }

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

  @Get("categories/:categoryId/image")
  async categoryImage(
    @Param("categoryId", new ParseUUIDPipe({ version: "4" })) categoryId: string,
    @Headers("if-none-match") ifNoneMatch: string | undefined,
    @Res() response: { setHeader(name: string, value: string): void; status(code: number): { end(): unknown }; send(data: Buffer): unknown }
  ) {
    const image = await this.productService.getCategoryImage(categoryId);
    response.setHeader("Content-Type", "image/webp");
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Cache-Control", "public, max-age=300");
    response.setHeader("ETag", image.etag);
    if (ifNoneMatch === image.etag) return response.status(304).end();
    return response.send(image.buffer);
  }

  @Get("admin/categories")
  @UseGuards(PlatformAdminGuard)
  listManagedCategories(@Query() query: ProductCategoriesQueryDto) {
    return this.productService.listManagedCategories(query);
  }

  @Post("admin/categories")
  @BrowserSessionMutation()
  @UseGuards(PlatformAdminGuard)
  async createCategory(@Body() body: CreateProductCategoryDto, @Req() request: AuthenticatedRequest, @Ip() clientIp: string) {
    await this.rateLimits.consumeProductMutation(request.authenticatedUser!.id, clientIp);
    return this.productService.createCategory(request.authenticatedUser!.id, body);
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

  @Delete("admin/categories/:categoryId")
  @BrowserSessionMutation()
  @UseGuards(PlatformAdminGuard)
  async deleteCategory(
    @Param("categoryId", new ParseUUIDPipe({ version: "4" })) categoryId: string,
    @Body() body: DeleteProductCategoryDto,
    @Req() request: AuthenticatedRequest,
    @Ip() clientIp: string
  ) {
    await this.rateLimits.consumeProductMutation(request.authenticatedUser!.id, clientIp);
    return this.productService.deleteCategory(categoryId, request.authenticatedUser!.id, body);
  }

  @Post("admin/categories/:categoryId/image")
  @BrowserSessionMutation()
  @UseGuards(PlatformAdminGuard)
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 8 * 1024 * 1024, files: 1, fields: 0, parts: 1 } }))
  async uploadCategoryImage(
    @Param("categoryId", new ParseUUIDPipe({ version: "4" })) categoryId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() request: AuthenticatedRequest,
    @Ip() clientIp: string
  ) {
    await this.rateLimits.consumeMediaUpload(request.authenticatedUser!.id, clientIp);
    const image = await this.media.prepareCategoryImage(file);
    return this.productService.setCategoryImage(categoryId, request.authenticatedUser!.id, image);
  }

  @Delete("admin/categories/:categoryId/image")
  @BrowserSessionMutation()
  @UseGuards(PlatformAdminGuard)
  async deleteCategoryImage(
    @Param("categoryId", new ParseUUIDPipe({ version: "4" })) categoryId: string,
    @Req() request: AuthenticatedRequest,
    @Ip() clientIp: string
  ) {
    await this.rateLimits.consumeMediaUpload(request.authenticatedUser!.id, clientIp);
    return this.productService.setCategoryImage(categoryId, request.authenticatedUser!.id, null);
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

  @Get("admin/slug-availability")
  @UseGuards(PlatformAdminGuard)
  adminSlugAvailability(@Query() query: ProductSlugAvailabilityQueryDto) {
    return this.productService.productSlugAvailability(query.slug, query.currentProductId);
  }

  @Get("mine/slug-availability")
  @UseGuards(SellerProductsGuard)
  sellerSlugAvailability(@Query() query: ProductSlugAvailabilityQueryDto, @Req() request: AuthenticatedRequest) {
    return this.productService.productSlugAvailability(query.slug, query.currentProductId, request.sellerContext!.sellerId);
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

  @Post("admin/:productId/transfer")
  @BrowserSessionMutation()
  @UseGuards(PlatformAdminGuard)
  async transferForAdmin(
    @Param("productId", new ParseUUIDPipe({ version: "4" })) productId: string,
    @Body() body: TransferProductSellerDto,
    @Req() request: AuthenticatedRequest,
    @Ip() clientIp: string
  ) {
    await this.rateLimits.consumeProductMutation(request.authenticatedUser!.id, clientIp);
    return this.productService.transferProductSeller(productId, request.authenticatedUser!.id, body.sellerId);
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
    @BrowserSessionMutation()
    @UseGuards(SellerProductsGuard)
  async deleteImage(
    @Param("productId", new ParseUUIDPipe({ version: "4" })) productId: string,
    @Req() request: AuthenticatedRequest,
    @Ip() clientIp: string
  ) {
    await this.rateLimits.consumeMediaUpload(request.authenticatedUser!.id, clientIp);
    return this.uploads.requestProductImageDeletion(productId, request.sellerContext!.sellerId, request.authenticatedUser!.id);
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
