import {
  Body,
  Controller,
  Delete,
  Get,
  Ip,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards
} from "@nestjs/common";
import { blog_locale } from "../../prisma/client";
import { ParseConstrainedStringPipe, ROUTE_SLUG_PATTERN } from "../../common/http/parse-constrained-string.pipe";
import { AuthRateLimitService } from "../auth/auth-rate-limit.service";
import type { AuthenticatedRequest } from "../auth/platform-admin.guard";
import { RequirePlatformPermission } from "../auth/platform-permission.decorator";
import { PlatformPermissionGuard } from "../auth/platform-permission.guard";
import { BlogManageGuard } from "./blog-manage.guard";
import { BlogService } from "./blog.service";
import {
  CreateBlogPostDto,
  ListBlogPostsQueryDto,
  ManagedBlogQueryDto,
  ProductOptionsQueryDto,
  RejectBlogPostDto,
  RestoreBlogChangeDto,
  TaxonomyDto,
  UpdateBlogPostDto
} from "./dto/blog-post.dto";

@Controller("blog/manage")
@UseGuards(BlogManageGuard)
export class BlogManageController {
  constructor(private readonly blog: BlogService, private readonly rateLimits: AuthRateLimitService) {}

  @Get("posts")
  list(@Query() query: ManagedBlogQueryDto, @Req() request: AuthenticatedRequest) {
    return this.blog.listManaged(request.blogActor!, query);
  }

  @Post("posts")
  async create(@Body() body: CreateBlogPostDto, @Req() request: AuthenticatedRequest, @Ip() clientIp: string) {
    await this.rateLimits.consumeBlogMutation(request.authenticatedUser!.id, clientIp);
    return this.blog.create(request.blogActor!, body);
  }

  @Get("posts/:id")
  get(@Param("id", new ParseUUIDPipe({ version: "4" })) id: string, @Req() request: AuthenticatedRequest) {
    return this.blog.getManaged(request.blogActor!, id);
  }

  @Get("posts/:id/changes")
  changes(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Query() query: ListBlogPostsQueryDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.blog.listChanges(request.blogActor!, id, query);
  }

  @Post("posts/:id/changes/:changeId/restore")
  async restoreChange(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Param("changeId", new ParseUUIDPipe({ version: "4" })) changeId: string,
    @Body() body: RestoreBlogChangeDto,
    @Req() request: AuthenticatedRequest,
    @Ip() clientIp: string
  ) {
    await this.rateLimits.consumeBlogMutation(request.authenticatedUser!.id, clientIp);
    return this.blog.restoreChange(
      request.blogActor!,
      id,
      changeId,
      body.optimisticVersion,
      body.side
    );
  }

  @Patch("posts/:id")
  async update(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() body: UpdateBlogPostDto,
    @Req() request: AuthenticatedRequest,
    @Ip() clientIp: string
  ) {
    await this.rateLimits.consumeBlogMutation(request.authenticatedUser!.id, clientIp);
    return this.blog.update(request.blogActor!, id, body);
  }

  @Post("posts/:id/submit")
  async submit(@Param("id", new ParseUUIDPipe({ version: "4" })) id: string, @Req() request: AuthenticatedRequest, @Ip() clientIp: string) {
    await this.rateLimits.consumeBlogMutation(request.authenticatedUser!.id, clientIp);
    return this.blog.submit(request.blogActor!, id);
  }

  @Post("posts/:id/publish")
  async publish(@Param("id", new ParseUUIDPipe({ version: "4" })) id: string, @Req() request: AuthenticatedRequest, @Ip() clientIp: string) {
    await this.rateLimits.consumeBlogMutation(request.authenticatedUser!.id, clientIp);
    return this.blog.publish(request.blogActor!, id);
  }

  @Post("posts/:id/reject")
  async reject(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() body: RejectBlogPostDto,
    @Req() request: AuthenticatedRequest,
    @Ip() clientIp: string
  ) {
    await this.rateLimits.consumeBlogMutation(request.authenticatedUser!.id, clientIp);
    return this.blog.reject(request.blogActor!, id, body.note);
  }

  @Post("posts/:id/archive")
  async archive(@Param("id", new ParseUUIDPipe({ version: "4" })) id: string, @Req() request: AuthenticatedRequest, @Ip() clientIp: string) {
    await this.rateLimits.consumeBlogMutation(request.authenticatedUser!.id, clientIp);
    return this.blog.archive(request.blogActor!, id, true);
  }

  @Post("posts/:id/restore")
  async restore(@Param("id", new ParseUUIDPipe({ version: "4" })) id: string, @Req() request: AuthenticatedRequest, @Ip() clientIp: string) {
    await this.rateLimits.consumeBlogMutation(request.authenticatedUser!.id, clientIp);
    return this.blog.archive(request.blogActor!, id, false);
  }

  @Post("posts/:id/withdraw")
  async withdraw(@Param("id", new ParseUUIDPipe({ version: "4" })) id: string, @Req() request: AuthenticatedRequest, @Ip() clientIp: string) {
    await this.rateLimits.consumeBlogMutation(request.authenticatedUser!.id, clientIp);
    return this.blog.withdraw(request.blogActor!, id);
  }

  @Get("product-options")
  products(@Query() query: ProductOptionsQueryDto, @Req() request: AuthenticatedRequest) {
    return this.blog.productOptions(request.blogActor!, query);
  }

  @Get("taxonomy")
  taxonomy() {
    return this.blog.listTaxonomy();
  }
}

@Controller("blog/manage")
@RequirePlatformPermission("blog_manage")
@UseGuards(PlatformPermissionGuard)
export class BlogTaxonomyController {
  constructor(private readonly blog: BlogService, private readonly rateLimits: AuthRateLimitService) {}

  @Post("categories")
  async createCategory(@Body() body: TaxonomyDto, @Req() request: AuthenticatedRequest, @Ip() clientIp: string) {
    await this.rateLimits.consumeBlogMutation(request.authenticatedUser!.id, clientIp);
    return this.blog.createTaxonomy("category", body);
  }

  @Patch("categories/:id")
  async updateCategory(@Param("id", new ParseUUIDPipe({ version: "4" })) id: string, @Body() body: TaxonomyDto, @Req() request: AuthenticatedRequest, @Ip() clientIp: string) {
    await this.rateLimits.consumeBlogMutation(request.authenticatedUser!.id, clientIp);
    return this.blog.updateTaxonomy("category", id, body);
  }

  @Delete("categories/:id")
  async deleteCategory(@Param("id", new ParseUUIDPipe({ version: "4" })) id: string, @Req() request: AuthenticatedRequest, @Ip() clientIp: string) {
    await this.rateLimits.consumeBlogMutation(request.authenticatedUser!.id, clientIp);
    return this.blog.deleteTaxonomy("category", id);
  }

  @Post("tags")
  async createTag(@Body() body: TaxonomyDto, @Req() request: AuthenticatedRequest, @Ip() clientIp: string) {
    await this.rateLimits.consumeBlogMutation(request.authenticatedUser!.id, clientIp);
    return this.blog.createTaxonomy("tag", body);
  }

  @Patch("tags/:id")
  async updateTag(@Param("id", new ParseUUIDPipe({ version: "4" })) id: string, @Body() body: TaxonomyDto, @Req() request: AuthenticatedRequest, @Ip() clientIp: string) {
    await this.rateLimits.consumeBlogMutation(request.authenticatedUser!.id, clientIp);
    return this.blog.updateTaxonomy("tag", id, body);
  }

  @Delete("tags/:id")
  async deleteTag(@Param("id", new ParseUUIDPipe({ version: "4" })) id: string, @Req() request: AuthenticatedRequest, @Ip() clientIp: string) {
    await this.rateLimits.consumeBlogMutation(request.authenticatedUser!.id, clientIp);
    return this.blog.deleteTaxonomy("tag", id);
  }
}

@Controller("blog/public")
export class BlogPublicController {
  constructor(private readonly blog: BlogService) {}

  @Get("sitemap")
  sitemap() {
    return this.blog.sitemapProjection();
  }

  @Get(":locale/posts")
  list(
    @Param("locale", new ParseEnumPipe(blog_locale)) locale: blog_locale,
    @Query() query: ListBlogPostsQueryDto
  ) {
    return this.blog.listPublic(locale, query);
  }

  @Get(":locale/posts/:slug")
  get(
    @Param("locale", new ParseEnumPipe(blog_locale)) locale: blog_locale,
    @Param("slug", new ParseConstrainedStringPipe({ label: "Blog slug", maxLength: 120, pattern: ROUTE_SLUG_PATTERN })) slug: string
  ) {
    return this.blog.getPublic(locale, slug);
  }

  @Get(":locale/categories/:slug")
  category(
    @Param("locale", new ParseEnumPipe(blog_locale)) locale: blog_locale,
    @Param("slug", new ParseConstrainedStringPipe({ label: "Category slug", maxLength: 120, pattern: ROUTE_SLUG_PATTERN })) slug: string,
    @Query() query: ListBlogPostsQueryDto
  ) {
    return this.blog.listPublicTaxonomy("category", locale, slug, query);
  }

  @Get(":locale/tags/:slug")
  tag(
    @Param("locale", new ParseEnumPipe(blog_locale)) locale: blog_locale,
    @Param("slug", new ParseConstrainedStringPipe({ label: "Tag slug", maxLength: 120, pattern: ROUTE_SLUG_PATTERN })) slug: string,
    @Query() query: ListBlogPostsQueryDto
  ) {
    return this.blog.listPublicTaxonomy("tag", locale, slug, query);
  }

  @Get(":locale/sellers/:sellerId")
  seller(
    @Param("locale", new ParseEnumPipe(blog_locale)) locale: blog_locale,
    @Param("sellerId", new ParseUUIDPipe({ version: "4" })) sellerId: string,
    @Query() query: ListBlogPostsQueryDto
  ) {
    return this.blog.listPublicSeller(locale, sellerId, query);
  }
}
