import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards
} from "@nestjs/common";
import { blog_locale } from "@prisma/client";
import type { AuthenticatedRequest } from "../auth/platform-admin.guard";
import { RequirePlatformPermission } from "../auth/platform-permission.decorator";
import { PlatformPermissionGuard } from "../auth/platform-permission.guard";
import { BlogManageGuard } from "./blog-manage.guard";
import { BlogService } from "./blog.service";
import {
  CreateBlogPostDto,
  ListBlogPostsQueryDto,
  ProductOptionsQueryDto,
  RejectBlogPostDto,
  TaxonomyDto,
  UpdateBlogPostDto
} from "./dto/blog-post.dto";

@Controller("blog/manage")
@UseGuards(BlogManageGuard)
export class BlogManageController {
  constructor(private readonly blog: BlogService) {}

  @Get("posts")
  list(@Query() query: ListBlogPostsQueryDto, @Req() request: AuthenticatedRequest) {
    return this.blog.listManaged(request.blogActor!, query);
  }

  @Post("posts")
  create(@Body() body: CreateBlogPostDto, @Req() request: AuthenticatedRequest) {
    return this.blog.create(request.blogActor!, body);
  }

  @Get("posts/:id")
  get(@Param("id", new ParseUUIDPipe({ version: "4" })) id: string, @Req() request: AuthenticatedRequest) {
    return this.blog.getManaged(request.blogActor!, id);
  }

  @Patch("posts/:id")
  update(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() body: UpdateBlogPostDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.blog.update(request.blogActor!, id, body);
  }

  @Post("posts/:id/submit")
  submit(@Param("id", new ParseUUIDPipe({ version: "4" })) id: string, @Req() request: AuthenticatedRequest) {
    return this.blog.submit(request.blogActor!, id);
  }

  @Post("posts/:id/publish")
  publish(@Param("id", new ParseUUIDPipe({ version: "4" })) id: string, @Req() request: AuthenticatedRequest) {
    return this.blog.publish(request.blogActor!, id);
  }

  @Post("posts/:id/reject")
  reject(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() body: RejectBlogPostDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.blog.reject(request.blogActor!, id, body.note);
  }

  @Post("posts/:id/archive")
  archive(@Param("id", new ParseUUIDPipe({ version: "4" })) id: string, @Req() request: AuthenticatedRequest) {
    return this.blog.archive(request.blogActor!, id, true);
  }

  @Post("posts/:id/restore")
  restore(@Param("id", new ParseUUIDPipe({ version: "4" })) id: string, @Req() request: AuthenticatedRequest) {
    return this.blog.archive(request.blogActor!, id, false);
  }

  @Post("posts/:id/withdraw")
  withdraw(@Param("id", new ParseUUIDPipe({ version: "4" })) id: string, @Req() request: AuthenticatedRequest) {
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
  constructor(private readonly blog: BlogService) {}

  @Post("categories")
  createCategory(@Body() body: TaxonomyDto) {
    return this.blog.createTaxonomy("category", body);
  }

  @Patch("categories/:id")
  updateCategory(@Param("id", new ParseUUIDPipe({ version: "4" })) id: string, @Body() body: TaxonomyDto) {
    return this.blog.updateTaxonomy("category", id, body);
  }

  @Delete("categories/:id")
  deleteCategory(@Param("id", new ParseUUIDPipe({ version: "4" })) id: string) {
    return this.blog.deleteTaxonomy("category", id);
  }

  @Post("tags")
  createTag(@Body() body: TaxonomyDto) {
    return this.blog.createTaxonomy("tag", body);
  }

  @Patch("tags/:id")
  updateTag(@Param("id", new ParseUUIDPipe({ version: "4" })) id: string, @Body() body: TaxonomyDto) {
    return this.blog.updateTaxonomy("tag", id, body);
  }

  @Delete("tags/:id")
  deleteTag(@Param("id", new ParseUUIDPipe({ version: "4" })) id: string) {
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
    @Param("slug") slug: string
  ) {
    return this.blog.getPublic(locale, slug);
  }

  @Get(":locale/categories/:slug")
  category(
    @Param("locale", new ParseEnumPipe(blog_locale)) locale: blog_locale,
    @Param("slug") slug: string,
    @Query() query: ListBlogPostsQueryDto
  ) {
    return this.blog.listPublicTaxonomy("category", locale, slug, query);
  }

  @Get(":locale/tags/:slug")
  tag(
    @Param("locale", new ParseEnumPipe(blog_locale)) locale: blog_locale,
    @Param("slug") slug: string,
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
